import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TileCanvas } from '../components/TileCanvas';
import { Toolbar } from '../components/Toolbar';
import type { useRemoteClient } from '../remote/useRemoteClient';
import { colors, radius, spacing } from '../theme';

type RemoteClient = ReturnType<typeof useRemoteClient>;

export function RemoteScreen({ client }: { client: RemoteClient }): React.JSX.Element {
  const { status, remoteDeviceName, remoteScreen, tiles, sendInput, sendClipboardToHost, disconnect } = client;
  const connected = status === 'connected';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.dot, { backgroundColor: connected ? colors.success : colors.warning }]} />
          <Text style={styles.deviceName} numberOfLines={1}>
            {remoteDeviceName ?? 'Remote device'}
          </Text>
          {remoteScreen && (
            <Text style={styles.resolution}>
              {remoteScreen.width}×{remoteScreen.height}
            </Text>
          )}
        </View>
        <View style={styles.headerRight}>
          <Pressable style={styles.headerButton} onPress={() => void sendClipboardToHost()} disabled={!connected}>
            <Text style={styles.headerButtonText}>Clipboard</Text>
          </Pressable>
          <Pressable
            style={[styles.headerButton, styles.disconnectButton]}
            onPress={() => disconnect('user disconnected')}
          >
            <Text style={styles.disconnectButtonText}>Disconnect</Text>
          </Pressable>
        </View>
      </View>

      <TileCanvas screen={remoteScreen} tiles={tiles} live={connected} onInput={sendInput} />

      {!connected && (
        <View style={styles.connectingOverlay} pointerEvents="none">
          <Text style={styles.connectingText}>Connecting…</Text>
        </View>
      )}

      <Toolbar live={connected} onInput={sendInput} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
    gap: spacing(2),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    flexShrink: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  deviceName: {
    color: colors.foreground,
    fontWeight: '600',
    fontSize: 14,
    flexShrink: 1,
  },
  resolution: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  headerRight: {
    flexDirection: 'row',
    gap: spacing(2),
  },
  headerButton: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: radius.md,
    backgroundColor: colors.secondary,
  },
  headerButtonText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: '600',
  },
  disconnectButton: {
    backgroundColor: colors.destructive,
  },
  disconnectButtonText: {
    color: colors.destructiveForeground,
    fontSize: 12,
    fontWeight: '600',
  },
  connectingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectingText: {
    color: colors.mutedForeground,
    fontSize: 14,
    fontWeight: '600',
  },
});
