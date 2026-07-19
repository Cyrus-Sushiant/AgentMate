import { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { ConnectScreen } from './src/screens/ConnectScreen';
import { RemoteScreen } from './src/screens/RemoteScreen';
import { useRemoteClient } from './src/remote/useRemoteClient';
import { colors } from './src/theme';

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App(): React.JSX.Element {
  const client = useRemoteClient();
  const { status } = client;

  const onRootLayout = useCallback(() => {
    void SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  const active = status === 'connecting' || status === 'connected';

  return (
    <SafeAreaProvider>
      <View style={styles.root} onLayout={onRootLayout}>
        {active ? <RemoteScreen client={client} /> : <ConnectScreen client={client} />}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
