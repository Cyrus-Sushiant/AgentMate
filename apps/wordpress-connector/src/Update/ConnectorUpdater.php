<?php
/**
 * Replaces the connector's own folder with a newer release the desktop app sends, so a site does
 * not need the zip uploaded by hand. The app sends the files of the plugin zip it ships with;
 * nothing is fetched from the internet, and the release can only come from a paired write key.
 *
 * What keeps a bad update from hurting the site, in order:
 * - every file is hashed, its path checked, and every PHP file parsed before anything is written;
 * - the new folder is built beside the plugin (a dot folder WordPress does not list), then swapped
 *   in with two renames, so the plugin folder is whole before and after;
 * - every class of the running version is loaded first, so the rest of this request never mixes
 *   old and new code;
 * - loopback health checks run before and after; a check that passed before and fails now puts the
 *   old folder back, and the reply says so;
 * - no deploy may be open, and none can start meanwhile (the deploy mutex is held throughout).
 *
 * @package AgentMate\Connector
 */

namespace AgentMate\Connector\Update;

use AgentMate\Connector\Audit\AuditLog;
use AgentMate\Connector\Deploy\DeployService;
use AgentMate\Connector\Deploy\SyntaxCheck;
use AgentMate\Connector\Env\Environment;
use AgentMate\Connector\Files\PathPolicy;
use AgentMate\Connector\Guard\Rescue;
use AgentMate\Connector\Http\ApiError;
use AgentMate\Connector\Http\Frame;
use AgentMate\Connector\Protocol;
use AgentMate\Connector\Support\Text;

final class ConnectorUpdater
{
    const MAIN = 'agentmate-connector.php';

    /** Without these the new folder is not a connector. */
    const REQUIRED = array(
        'agentmate-connector.php',
        'src/Autoloader.php',
        'src/Plugin.php',
        'guard/00-agentmate-connector-guard.php',
    );

    const VERSION = '/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/D';

    /** Folders this class makes beside the plugin; a crash can leave one behind. */
    const SIBLING = '/^\.agentmate-connector-(?:new|old|failed)-[0-9a-f]{12}$/D';

    /** WordPress reads plugin headers from the first 8 KiB. */
    const HEADER_BYTES = 8192;

    /** @var Environment */
    private $env;

    /** @var AuditLog */
    private $audit;

    /** @var DeployService */
    private $deploys;

    /** @var callable */
    private $rename;

    /**
     * @param callable|null $rename rename(from, to): bool; tests pass one that fails on purpose
     */
    public function __construct(Environment $env, AuditLog $audit, DeployService $deploys, ?callable $rename = null)
    {
        $this->env = $env;
        $this->audit = $audit;
        $this->deploys = $deploys;
        $this->rename = $rename !== null ? $rename : function (string $from, string $to): bool {
            return @rename($from, $to); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.WP.AlternativeFunctions.rename_rename
        };
    }

    /** The connector's folder, where it lives under the plugins folder. */
    public static function pluginDir(Environment $env): string
    {
        return $env->itemRoot('plugin') . '/' . $env->connectorSlug();
    }

    /**
     * Whether PHP could swap the plugin folder: a real folder of its own, in a folder PHP may
     * write to. Says nothing about DISALLOW_FILE_MODS and friends; the dispatcher checks those.
     */
    public static function replaceable(Environment $env): bool
    {
        $slug = $env->connectorSlug();
        if (!PathPolicy::isValidSlug($slug)) {
            return false;
        }
        $root = $env->itemRoot('plugin');
        $dir = $root . '/' . $slug;
        return is_dir($dir) && !is_link($dir) && is_writable($root) && is_writable($dir);
    }

    /**
     * @param mixed $body
     * @param array<string, mixed> $connection
     * @return array<string, mixed> WpConnectorUpdateResponse
     */
    public function update($body, Frame $frame, array $connection, string $ip): array
    {
        $request = $this->readRequest($body, $frame);
        return $this->deploys->whileIdle(function () use ($request, $connection, $ip) {
            return $this->run($request, $connection, $ip);
        });
    }

    // Reading the request ---------------------------------------------------------------------

    /**
     * @param mixed $body
     * @return array{version: string, files: array<string, string>} the files by path, with their bytes
     */
    private function readRequest($body, Frame $frame): array
    {
        $version = is_array($body) && isset($body['version']) && is_string($body['version']) ? $body['version'] : '';
        $files = is_array($body) && isset($body['files']) ? $body['files'] : null;
        if (strlen($version) > 40 || preg_match(self::VERSION, $version) !== 1) {
            throw ApiError::badRequest('An update names the version it installs, like 1.58.0.');
        }
        if (!is_array($files) || array_keys($files) !== range(0, count($files) - 1) || count($files) < 1 || count($files) > Protocol::UPDATE_MAX_FILES) {
            throw ApiError::badRequest('An update lists 1 to ' . Protocol::UPDATE_MAX_FILES . ' files.');
        }
        if (count($files) !== $frame->blobCount()) {
            throw ApiError::badRequest('Send one blob for each file of the update.');
        }
        $out = array();
        $lowered = array();
        $total = 0;
        foreach ($files as $index => $file) {
            $path = is_array($file) && isset($file['path']) && is_string($file['path']) ? $file['path'] : null;
            $size = is_array($file) && isset($file['size']) && is_int($file['size']) ? $file['size'] : -1;
            $sha = is_array($file) && isset($file['sha256']) && is_string($file['sha256']) ? $file['sha256'] : '';
            if ($path === null || $size < 0 || preg_match(DeployService::SHA, $sha) !== 1) {
                throw ApiError::badRequest('Each file of an update has a path, a size and a sha256.');
            }
            $shown = Text::clean($path, 120);
            if (PathPolicy::validate($path) !== null || preg_match(Protocol::UPDATE_FILE_PATTERN, $path) !== 1 || $path === Rescue::CONFIG) {
                throw $this->badPackage('The update holds a file this site will not take: ' . $shown . '.');
            }
            $key = Text::lower($path);
            if (isset($lowered[$key])) {
                throw $this->badPackage('The update holds ' . $shown . ' twice.');
            }
            $lowered[$key] = true;
            $total += $size;
            if ($size > Protocol::UPDATE_MAX_FILE_BYTES || $total > Protocol::UPDATE_MAX_TOTAL_BYTES) {
                throw $this->badPackage('The update is larger than a connector can be.');
            }
            if ($frame->blobLength($index) !== $size) {
                throw $this->badPackage($shown . ' is not the size the update says it is.');
            }
            $bytes = $frame->blob($index);
            if (!hash_equals($sha, hash('sha256', $bytes))) {
                throw $this->badPackage($shown . ' did not match its sha256.');
            }
            $out[$path] = $bytes;
        }
        foreach (array_keys($out) as $path) {
            $parts = explode('/', $path);
            for ($length = 1; $length < count($parts); $length++) {
                if (isset($out[implode('/', array_slice($parts, 0, $length))])) {
                    throw $this->badPackage('The update holds ' . Text::clean($path, 120) . ' inside a file.');
                }
            }
        }
        foreach (self::REQUIRED as $required) {
            if (!isset($out[$required])) {
                throw $this->badPackage('The update is missing ' . $required . ', so it is not a complete connector.');
            }
        }
        $this->checkMain($out[self::MAIN], $version);
        return array('version' => $version, 'files' => $out);
    }

    /** The main file must be this connector and say it is the version the request names. */
    private function checkMain(string $main, string $version): void
    {
        $head = substr($main, 0, self::HEADER_BYTES);
        if (self::header($head, 'Plugin Name') !== 'AgentMate Connector') {
            throw $this->badPackage('The update is not the AgentMate Connector plugin.');
        }
        if (self::header($head, 'Version') !== $version) {
            throw $this->badPackage('The plugin header in the update does not say version ' . $version . '.');
        }
        $constant = preg_match("/define\\(\\s*'AGENTMATE_CONNECTOR_VERSION'\\s*,\\s*'([^']+)'\\s*\\)/", $main, $match) === 1 ? $match[1] : '';
        if ($constant !== $version) {
            throw $this->badPackage('The version constant in the update does not say version ' . $version . '.');
        }
    }

    /** A plugin header field the way WordPress reads it, or null. */
    private static function header(string $text, string $name): ?string
    {
        if (preg_match('/^[ \t\/*#@]*' . preg_quote($name, '/') . ':(.*)$/mi', $text, $match) !== 1) {
            return null;
        }
        $value = trim($match[1]);
        return $value === '' ? null : $value;
    }

    // Doing it --------------------------------------------------------------------------------

    /**
     * @param array{version: string, files: array<string, string>} $request
     * @param array<string, mixed> $connection
     * @return array<string, mixed>
     */
    private function run(array $request, array $connection, string $ip): array
    {
        $env = $this->env;
        $from = $env->pluginVersion();
        $to = $request['version'];
        $files = $request['files'];
        if (version_compare($to, $from, '<')) {
            throw $this->refused('downgrade', 'This site already runs AgentMate Connector ' . $from . ', which is newer than ' . $to . '.');
        }
        $this->checkRequirements($files[self::MAIN], $to);
        foreach ($files as $path => $bytes) {
            $error = SyntaxCheck::isPhp($path) ? SyntaxCheck::check($bytes) : null;
            if ($error !== null) {
                throw new ApiError('syntaxError', 'A PHP file in the update does not parse on this site\'s PHP: ' . Text::clean($path, 120) . ' line ' . $error['line'] . '.', array(
                    'path' => $path,
                    'line' => $error['line'],
                    'message' => Text::clean($error['message'], 300),
                ));
            }
        }
        if (!self::replaceable($env)) {
            throw $this->refused('notReplaceable', 'WordPress cannot replace the connector\'s folder here (it is a symlink, or PHP may not rename it). Upload the plugin in wp-admin instead.');
        }

        $root = $env->itemRoot('plugin');
        $dir = self::pluginDir($env);
        $this->sweep($root);
        $suffix = bin2hex(random_bytes(6));
        $new = $root . '/.agentmate-connector-new-' . $suffix;
        $old = $root . '/.agentmate-connector-old-' . $suffix;
        $failed = $root . '/.agentmate-connector-failed-' . $suffix;
        $before = $this->listFiles($dir);

        try {
            $this->stage($new, $files, $dir);
            $this->preload($dir);
            $baseline = $env->healthChecks();
        } catch (\Throwable $error) {
            $this->remove($new);
            throw $error;
        }
        $this->swap($dir, $new, $old);
        $this->refresh($dir, array_merge(array_keys($files), $before));

        $checks = $env->healthChecks();
        if (DeployService::health($baseline, $checks) === false) {
            $this->restore($dir, $old, $failed);
            $this->refresh($dir, array_merge(array_keys($files), $before));
            $this->audit->add('connectorRolledBack', $env->now(), $ip, 'Tried AgentMate Connector ' . $to . '; the site failed its health check, so ' . $from . ' was put back.', $connection);
            return array('state' => 'rolledBack', 'fromVersion' => $from, 'version' => $to, 'files' => count($files), 'checks' => $checks);
        }
        $this->remove($old);
        $this->audit->add('connectorUpdated', $env->now(), $ip, 'Updated AgentMate Connector from ' . $from . ' to ' . $to . ' (' . count($files) . ' files).', $connection);
        return array('state' => 'updated', 'fromVersion' => $from, 'version' => $to, 'files' => count($files), 'checks' => $checks);
    }

    /** The new release must run on this PHP and WordPress. */
    private function checkRequirements(string $main, string $version): void
    {
        $head = substr($main, 0, self::HEADER_BYTES);
        $php = self::header($head, 'Requires PHP');
        if ($php !== null && version_compare(PHP_VERSION, $php, '<')) {
            throw $this->refused('requirements', 'AgentMate Connector ' . $version . ' needs PHP ' . Text::clean($php, 20) . ' or newer, and this site runs ' . PHP_VERSION . '.');
        }
        $wp = self::header($head, 'Requires at least');
        if ($wp !== null && version_compare($this->env->wpVersion(), $wp, '<')) {
            throw $this->refused('requirements', 'AgentMate Connector ' . $version . ' needs WordPress ' . Text::clean($wp, 20) . ' or newer, and this site runs ' . $this->env->wpVersion() . '.');
        }
    }

    /**
     * Builds the new plugin folder at $new. Files the plugin writes for itself (rescue-config.php)
     * come across from the folder it replaces.
     *
     * @param array<string, string> $files
     */
    private function stage(string $new, array $files, string $dir): void
    {
        $dirMode = $this->env->dirMode();
        $fileMode = $this->env->fileMode();
        if (!@mkdir($new, $dirMode)) { // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.WP.AlternativeFunctions.file_system_operations_mkdir
            throw $this->refused('notReplaceable', 'WordPress cannot make a folder next to the connector, so it cannot be replaced from here. Upload the plugin in wp-admin instead.');
        }
        foreach ($files as $path => $bytes) {
            $target = $new . '/' . $path;
            $parent = dirname($target);
            if (!is_dir($parent) && !@mkdir($parent, $dirMode, true) && !is_dir($parent)) { // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.WP.AlternativeFunctions.file_system_operations_mkdir
                throw new ApiError('internal', 'The site could not make the folders for the new connector. Is its disk full?');
            }
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
            if (file_put_contents($target, $bytes) !== strlen($bytes)) {
                throw new ApiError('internal', 'The site could not write the new connector. Is its disk full?');
            }
            @chmod($target, $fileMode); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.WP.AlternativeFunctions.file_system_operations_chmod
        }
        $config = $dir . '/' . Rescue::CONFIG;
        if (!isset($files[Rescue::CONFIG]) && is_file($config)) {
            @copy($config, $new . '/' . Rescue::CONFIG); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
        }
    }

    /**
     * Loads every class of the running version, so the rest of the request (the reply, the audit
     * row) never pulls a half-new class from the folder that is about to change.
     */
    private function preload(string $dir): void
    {
        foreach ($this->listFiles($dir . '/src') as $relative) {
            if (substr($relative, -4) !== '.php') {
                continue;
            }
            $class = 'AgentMate\\Connector\\' . str_replace('/', '\\', substr($relative, 0, -4));
            try {
                class_exists($class) || interface_exists($class) || trait_exists($class);
            } catch (\Throwable $ignored) {
                unset($ignored);
            }
        }
    }

    /**
     * The folder swap: the plugin folder moves aside, the new one takes its place. Leaves things
     * as they were when either step fails.
     */
    private function swap(string $dir, string $new, string $old): void
    {
        if (!$this->move($dir, $old)) {
            $this->remove($new);
            throw $this->refused('notReplaceable', 'PHP could not move the connector\'s folder aside. Upload the plugin in wp-admin instead.');
        }
        if (!$this->move($new, $dir)) {
            if (!$this->move($old, $dir)) {
                // Neither folder could be put in place; both stay on disk for the site owner.
                throw new ApiError('internal', 'The connector\'s folder was moved aside and the new one could not take its place. The old files are in ' . basename($old) . ' and the new ones in ' . basename($new) . ', next to the plugin folder. Rename one of them to ' . basename($dir) . '.');
            }
            $this->remove($new);
            throw $this->refused('notReplaceable', 'PHP could not put the new connector in place, so the old one stays. Upload the plugin in wp-admin instead.');
        }
    }

    /** Undoes the swap: the new folder out, the old one back. */
    private function restore(string $dir, string $old, string $failed): void
    {
        if (!$this->move($dir, $failed)) {
            throw new ApiError('internal', 'The new connector made the site fail its health check and PHP could not undo the update. The old files are in ' . basename($old) . ' next to the plugin folder.');
        }
        if (!$this->move($old, $dir)) {
            $this->move($failed, $dir);
            throw new ApiError('internal', 'The new connector made the site fail its health check and PHP could not put the old files back. They are in ' . basename($old) . ' next to the plugin folder.');
        }
        $this->remove($failed);
    }

    private function move(string $from, string $to): bool
    {
        return (bool) call_user_func($this->rename, $from, $to);
    }

    /**
     * Opcode caches and WordPress's plugin list must forget the files that changed.
     *
     * @param string[] $paths relative to the plugin folder
     */
    private function refresh(string $dir, array $paths): void
    {
        foreach (array_unique($paths) as $path) {
            if (SyntaxCheck::isPhp($path)) {
                $this->env->invalidateOpcache($dir . '/' . $path);
            }
        }
        $this->env->cleanCaches();
    }

    // Files -----------------------------------------------------------------------------------

    /**
     * Every file under $dir, relative and `/`-separated. Symlinks are not followed.
     *
     * @return string[]
     */
    private function listFiles(string $dir, string $prefix = ''): array
    {
        $names = is_dir($dir) && !is_link($dir) ? @scandir($dir) : false; // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
        $out = array();
        foreach (is_array($names) ? $names : array() as $name) {
            if ($name === '.' || $name === '..') {
                continue;
            }
            $path = $dir . '/' . $name;
            if (is_link($path)) {
                continue;
            }
            if (is_dir($path)) {
                $out = array_merge($out, $this->listFiles($path, $prefix . $name . '/'));
            } else {
                $out[] = $prefix . $name;
            }
        }
        return $out;
    }

    /** Removes the folders a crashed update left beside the plugin. */
    private function sweep(string $root): void
    {
        $names = @scandir($root); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
        foreach (is_array($names) ? $names : array() as $name) {
            if (preg_match(self::SIBLING, $name) === 1) {
                $this->remove($root . '/' . $name);
            }
        }
    }

    /** Deletes a file or folder this class made. Never follows a symlink. */
    private function remove(string $path): void
    {
        if (is_link($path) || is_file($path)) {
            @unlink($path); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
            return;
        }
        if (!is_dir($path)) {
            return;
        }
        $names = @scandir($path); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
        foreach (is_array($names) ? $names : array() as $name) {
            if ($name !== '.' && $name !== '..') {
                $this->remove($path . '/' . $name);
            }
        }
        @rmdir($path); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.WP.AlternativeFunctions.file_system_operations_rmdir
    }

    // Errors ----------------------------------------------------------------------------------

    private function badPackage(string $message): ApiError
    {
        return $this->refused('badPackage', $message);
    }

    private function refused(string $reason, string $message): ApiError
    {
        return new ApiError('updateRefused', $message, array('reason' => $reason));
    }
}
