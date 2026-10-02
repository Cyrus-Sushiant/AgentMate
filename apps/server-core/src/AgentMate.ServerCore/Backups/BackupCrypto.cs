using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace AgentMate.ServerCore.Backups;

/// <summary>A backup the core will not open: a wrong passphrase, a damaged file, or not a backup at all.</summary>
internal sealed class BackupRefusedException(string message, Exception? inner = null) : Exception(message, inner);

/// <summary>What a backup file says about itself in the clear: how to derive its key, and nothing about what it holds.</summary>
internal sealed record BackupHeader(
    int Format,
    string Kdf,
    int Iterations,
    string Salt,
    string Cipher,
    int ChunkBytes,
    string NoncePrefix,
    long CreatedAtUnixMs);

[JsonSerializable(typeof(BackupHeader))]
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
internal sealed partial class BackupHeaderJson : JsonSerializerContext;

/// <summary>
/// The backup file format, with proven pieces from the BCL only:
/// <list type="bullet">
/// <item>The key: PBKDF2-HMAC-SHA256 over the passphrase with a random 16-byte salt and 600,000
/// iterations (OWASP's figure for that hash). A file asking for fewer is refused, so nobody can hand
/// the core a weaker one.</item>
/// <item>The contents: AES-256-GCM in chunks (the STREAM construction). Each chunk's nonce is a random
/// 7-byte prefix, the chunk's number and a last-chunk flag, and every chunk authenticates the header
/// too. A changed byte, a chunk moved, dropped or added, a file cut short or a changed header all
/// fail the tag. A wrong passphrase fails on the first chunk.</item>
/// </list>
/// Layout: "AMBACKUP", a version byte, the header's length (4 bytes, big-endian) and the header as
/// JSON, then chunks, each its plaintext length (4 bytes), ciphertext and 16-byte tag.
/// </summary>
internal static class BackupCrypto
{
    public const int Iterations = 600_000;
    public const int MaxIterations = 10_000_000;
    public const int DefaultChunkBytes = 1024 * 1024;
    public const int MinPassphraseLength = 12;
    public const int MaxPassphraseLength = 1024;

    private const int FormatVersion = 1;
    private const int SaltBytes = 16;
    private const int KeyBytes = 32;
    private const int TagBytes = 16;
    private const int NoncePrefixBytes = 7;
    private const int MaxHeaderBytes = 4096;
    private const string KdfName = "PBKDF2-HMAC-SHA256";
    private const string CipherName = "AES-256-GCM";

    private static readonly byte[] _magic = "AMBACKUP"u8.ToArray();

    /// <summary>Why a passphrase will not do, or null.</summary>
    public static string? PassphraseProblem(string? passphrase) => passphrase switch
    {
        null or "" => "Choose a passphrase for the backup.",
        { Length: < MinPassphraseLength } => $"A backup passphrase needs at least {MinPassphraseLength} characters.",
        { Length: > MaxPassphraseLength } => $"A backup passphrase can be at most {MaxPassphraseLength} characters.",
        _ => null,
    };

    public static async Task EncryptAsync(
        Stream plaintext,
        Stream output,
        string passphrase,
        long createdAtUnixMs,
        CancellationToken cancellationToken,
        int chunkBytes = DefaultChunkBytes)
    {
        ArgumentNullException.ThrowIfNull(plaintext);
        ArgumentNullException.ThrowIfNull(output);
        if (PassphraseProblem(passphrase) is { } problem)
        {
            throw new BackupRefusedException(problem);
        }

        var header = new BackupHeader(
            FormatVersion,
            KdfName,
            Iterations,
            Convert.ToBase64String(RandomNumberGenerator.GetBytes(SaltBytes)),
            CipherName,
            chunkBytes,
            Convert.ToBase64String(RandomNumberGenerator.GetBytes(NoncePrefixBytes)),
            createdAtUnixMs);
        var preamble = Preamble(header);
        await output.WriteAsync(preamble, cancellationToken);
        var associated = SHA256.HashData(preamble);
        using var gcm = new AesGcm(DeriveKey(passphrase, header), TagBytes);
        var prefix = Convert.FromBase64String(header.NoncePrefix);

        var current = new byte[chunkBytes];
        var next = new byte[chunkBytes];
        var currentLength = await FillAsync(plaintext, current, cancellationToken);
        var cipher = new byte[chunkBytes];
        var tag = new byte[TagBytes];
        var lengthBytes = new byte[4];
        for (uint counter = 0; ; counter++)
        {
            // One chunk read ahead, so the last chunk is known to be the last when it is sealed.
            var nextLength = currentLength == chunkBytes ? await FillAsync(plaintext, next, cancellationToken) : 0;
            var last = nextLength == 0;
            gcm.Encrypt(Nonce(prefix, counter, last), current.AsSpan(0, currentLength), cipher.AsSpan(0, currentLength), tag, associated);
            BinaryPrimitives.WriteUInt32BigEndian(lengthBytes, (uint)currentLength);
            await output.WriteAsync(lengthBytes, cancellationToken);
            await output.WriteAsync(cipher.AsMemory(0, currentLength), cancellationToken);
            await output.WriteAsync(tag, cancellationToken);
            if (last)
            {
                break;
            }

            (current, next) = (next, current);
            currentLength = nextLength;
        }

        CryptographicOperations.ZeroMemory(current);
        CryptographicOperations.ZeroMemory(next);
    }

    /// <summary>
    /// Decrypts into <paramref name="output"/>. What reaches it before a failure is not to be
    /// trusted: write to a scratch file and use it only once this returns.
    /// </summary>
    public static async Task<BackupHeader> DecryptAsync(Stream input, Stream output, string passphrase, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);
        ArgumentNullException.ThrowIfNull(output);
        if (string.IsNullOrEmpty(passphrase) || passphrase.Length > MaxPassphraseLength)
        {
            throw new BackupRefusedException("Enter the backup's passphrase.");
        }

        var (header, preamble) = await ReadPreambleAsync(input, cancellationToken);
        var associated = SHA256.HashData(preamble);
        using var gcm = new AesGcm(DeriveKey(passphrase, header), TagBytes);
        var prefix = Convert.FromBase64String(header.NoncePrefix);
        var cipher = new byte[header.ChunkBytes];
        var plain = new byte[header.ChunkBytes];
        var tag = new byte[TagBytes];
        var lengthBytes = new byte[4];
        for (uint counter = 0; ; counter++)
        {
            if (await FillAsync(input, lengthBytes, cancellationToken) != 4)
            {
                throw Damaged();
            }

            var length = BinaryPrimitives.ReadUInt32BigEndian(lengthBytes);
            if (length > header.ChunkBytes
                || await FillAsync(input, cipher.AsMemory(0, (int)length), cancellationToken) != length
                || await FillAsync(input, tag, cancellationToken) != TagBytes)
            {
                throw Damaged();
            }

            // A full chunk may be followed by more; a shorter one has to be the last.
            var last = length < header.ChunkBytes || IsAtEnd(input);
            try
            {
                gcm.Decrypt(Nonce(prefix, counter, last), cipher.AsSpan(0, (int)length), tag, plain.AsSpan(0, (int)length), associated);
            }
            catch (AuthenticationTagMismatchException error)
            {
                throw counter == 0
                    ? new BackupRefusedException("The passphrase is wrong, or the backup file is damaged.", error)
                    : new BackupRefusedException("The backup file is damaged: part of it does not match what was written.", error);
            }

            await output.WriteAsync(plain.AsMemory(0, (int)length), cancellationToken);
            if (last)
            {
                if (await FillAsync(input, lengthBytes.AsMemory(0, 1), cancellationToken) != 0)
                {
                    throw Damaged();
                }

                CryptographicOperations.ZeroMemory(plain);
                return header;
            }
        }
    }

    private static async Task<(BackupHeader Header, byte[] Preamble)> ReadPreambleAsync(Stream input, CancellationToken cancellationToken)
    {
        var start = new byte[_magic.Length + 1 + 4];
        if (await FillAsync(input, start, cancellationToken) != start.Length || !start.AsSpan(0, _magic.Length).SequenceEqual(_magic))
        {
            throw new BackupRefusedException("This is not an AgentMate server backup.");
        }

        if (start[_magic.Length] != FormatVersion)
        {
            throw new BackupRefusedException("This backup was made by a newer AgentMate. Update the server core first.");
        }

        var headerLength = BinaryPrimitives.ReadInt32BigEndian(start.AsSpan(_magic.Length + 1));
        if (headerLength is <= 0 or > MaxHeaderBytes)
        {
            throw Damaged();
        }

        var headerBytes = new byte[headerLength];
        if (await FillAsync(input, headerBytes, cancellationToken) != headerLength)
        {
            throw Damaged();
        }

        BackupHeader? header;
        try
        {
            header = JsonSerializer.Deserialize(headerBytes, BackupHeaderJson.Default.BackupHeader);
        }
        catch (JsonException error)
        {
            throw new BackupRefusedException("The backup file is damaged.", error);
        }

        if (header is null
            || header.Format != FormatVersion
            || header.Kdf != KdfName
            || header.Cipher != CipherName
            || header.Iterations is < Iterations or > MaxIterations
            || header.ChunkBytes is < 4096 or > 16 * 1024 * 1024
            || !TryBase64(header.Salt, SaltBytes, 64)
            || !TryBase64(header.NoncePrefix, NoncePrefixBytes, NoncePrefixBytes))
        {
            throw new BackupRefusedException("The backup's header asks for settings the core does not accept.");
        }

        return (header, [.. start, .. headerBytes]);
    }

    private static byte[] Preamble(BackupHeader header)
    {
        var json = JsonSerializer.SerializeToUtf8Bytes(header, BackupHeaderJson.Default.BackupHeader);
        var preamble = new byte[_magic.Length + 1 + 4 + json.Length];
        _magic.CopyTo(preamble, 0);
        preamble[_magic.Length] = FormatVersion;
        BinaryPrimitives.WriteInt32BigEndian(preamble.AsSpan(_magic.Length + 1), json.Length);
        json.CopyTo(preamble, _magic.Length + 5);
        return preamble;
    }

    private static byte[] DeriveKey(string passphrase, BackupHeader header) =>
        Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(passphrase),
            Convert.FromBase64String(header.Salt),
            header.Iterations,
            HashAlgorithmName.SHA256,
            KeyBytes);

    private static byte[] Nonce(byte[] prefix, uint counter, bool last)
    {
        var nonce = new byte[12];
        prefix.CopyTo(nonce, 0);
        BinaryPrimitives.WriteUInt32BigEndian(nonce.AsSpan(NoncePrefixBytes), counter);
        nonce[11] = last ? (byte)1 : (byte)0;
        return nonce;
    }

    private static bool TryBase64(string? text, int minBytes, int maxBytes)
    {
        if (string.IsNullOrEmpty(text))
        {
            return false;
        }

        var buffer = new byte[(text.Length * 3 / 4) + 3];
        return Convert.TryFromBase64String(text, buffer, out var written) && written >= minBytes && written <= maxBytes;
    }

    private static BackupRefusedException Damaged() => new("The backup file is damaged or cut short.");

    private static bool IsAtEnd(Stream input)
    {
        if (input.CanSeek)
        {
            return input.Position >= input.Length;
        }

        throw new NotSupportedException("Backups are read from files, which can seek.");
    }

    private static Task<int> FillAsync(Stream stream, byte[] buffer, CancellationToken cancellationToken) =>
        FillAsync(stream, buffer.AsMemory(), cancellationToken);

    /// <summary>Reads until the buffer is full or the stream ends; returns how much it read.</summary>
    private static async Task<int> FillAsync(Stream stream, Memory<byte> buffer, CancellationToken cancellationToken)
    {
        var total = 0;
        while (total < buffer.Length)
        {
            var read = await stream.ReadAsync(buffer[total..], cancellationToken);
            if (read == 0)
            {
                break;
            }

            total += read;
        }

        return total;
    }
}
