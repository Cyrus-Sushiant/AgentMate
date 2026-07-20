import { useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RemoteViewport } from '../components/RemoteViewport';
import { Toolbar } from '../components/Toolbar';
import type { useRemoteClient } from '../remote/useRemoteClient';
import { colors, radius, spacing } from '../theme';

type RemoteClient = ReturnType<typeof useRemoteClient>;

/**
 * The active-session screen. The host's display gets the entire phone screen;
 * the header is a translucent overlay toggled by the ⋯ button so it never
 * steals space from the remote desktop, and the key toolbar sits inside the
 * bottom safe-area inset so Android's navigation bar can't cover it.
 */
export function RemoteScreen({ client }: { client: RemoteClient }): React.JSX.Element {
  const {
    status,
    remoteDeviceName,
    remoteScreen,
    tiles,
    videoMode,
    remoteStream,
    sendInput,
    sendClipboardToHost,
    disconnect,
  } = client;
  const connected = status === 'connected';
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);

  const waitingForVideo =
    connected && videoMode === 'negotiating' && !remoteStream && tiles.size === 0;

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      <RemoteViewport
        screen={remoteScreen}
        stream={remoteStream}
        tiles={tiles}
        videoMode={videoMode}
        live={connected}
        onInput={sendInput}
      />

      {(!connected || waitingForVideo) && (
        <View style={styles.centerOverlay} pointerEvents="none">
          <Text style={styles.centerOverlayText}>
            {connected ? 'Starting video…' : 'Connecting…'}
          </Text>
        </View>
      )}

      {/* Floating menu toggle — the only permanent chrome over the screen. */}
      <Pressable
        style={[styles.menuButton, { top: insets.top + spacing(2), right: insets.right + spacing(2) }]}
        onPress={() => setMenuOpen((open) => !open)}
        hitSlop={8}
      >
        <Text style={styles.menuButtonText}>⋯</Text>
      </Pressable>

      {menuOpen && (
        <View style={[styles.header, { top: insets.top + spacing(2), right: insets.right + spacing(12) }]}>
          <View style={styles.headerLeft}>
            <View style={[styles.dot, { backgroundColor: connected ? colors.success : colors.warning }]} />
            <Text style={styles.deviceName} numberOfLines={1}>
              {remoteDeviceName ?? 'Remote device'}
            </Text>
            {remoteScreen && (
              <Text style={styles.resolution}>
                {remoteScreen.width}×{remoteScreen.height}
                {videoMode === 'tiles' ? ' · compat' : ''}
              </Text>
            )}
          </View>
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
      )}

      <Toolbar live={connected} onInput={sendInput} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerOverlayText: {
    color: colors.mutedForeground,
    fontSize: 14,
    fontWeight: '600',
  },
  menuButton: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(20, 20, 20, 0.75)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButtonText: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  header: {
    position: 'absolute',
    left: spacing(2),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(20, 20, 20, 0.92)',
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
});
