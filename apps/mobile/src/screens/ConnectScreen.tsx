import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QRScannerModal } from '../components/QRScannerModal';
import type { useRemoteClient } from '../remote/useRemoteClient';
import { colors, radius, spacing } from '../theme';

type RemoteClient = ReturnType<typeof useRemoteClient>;

export function ConnectScreen({ client }: { client: RemoteClient }): React.JSX.Element {
  const { status, error, connect } = client;
  const [code, setCode] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const connecting = status === 'connecting';

  const handleScanned = (data: string) => {
    setScannerOpen(false);
    setCode(data);
    connect(data);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            {/* eslint-disable-next-line @typescript-eslint/no-require-imports */}
            <Image source={require('../../assets/splash-icon.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.title}>AgentMate</Text>
            <Text style={styles.subtitle}>Remote Control</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Pairing code</Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="AGENTMATE1:…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.codeInput}
            />

            {status === 'error' && error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.buttonRow}>
              <Pressable style={styles.secondaryButton} onPress={() => setScannerOpen(true)}>
                <Text style={styles.secondaryButtonText}>Scan QR</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, (!code.trim() || connecting) && styles.buttonDisabled]}
                disabled={!code.trim() || connecting}
                onPress={() => connect(code.trim())}
              >
                <Text style={styles.primaryButtonText}>{connecting ? 'Connecting…' : 'Connect'}</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.hint}>
            On the computer you want to control, open AgentMate → Remote → Host tab, then start hosting
            and share its pairing code or QR here. Both devices need to be on the same network.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <QRScannerModal visible={scannerOpen} onClose={() => setScannerOpen(false)} onScanned={handleScanned} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: spacing(6),
    justifyContent: 'center',
    gap: spacing(6),
  },
  hero: {
    alignItems: 'center',
    gap: spacing(1),
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: spacing(2),
  },
  title: {
    color: colors.foreground,
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.mutedForeground,
    fontSize: 14,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    gap: spacing(3),
  },
  label: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  codeInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    color: colors.foreground,
    padding: spacing(3),
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 13,
    textAlignVertical: 'top',
  },
  errorText: {
    color: colors.destructive,
    fontSize: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing(3),
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing(3),
    borderRadius: radius.md,
    backgroundColor: colors.secondary,
  },
  secondaryButtonText: {
    color: colors.foreground,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing(3),
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: colors.primaryForeground,
    fontWeight: '700',
  },
  hint: {
    color: colors.mutedForeground,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
