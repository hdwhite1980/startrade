import '../global.css';
import 'react-native-get-random-values';
import '@ethersproject/shims';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/stores/authStore';
import { useWalletStore } from '@/stores/walletStore';

export default function RootLayout() {
  const initializeAuth = useAuthStore((state) => state.initialize);
  const initializeWallet = useWalletStore((state) => state.initialize);

  useEffect(() => {
    initializeAuth();
    initializeWallet();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen 
          name="market/[id]" 
          options={{ 
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }} 
        />
        <Stack.Screen 
          name="auth" 
          options={{ 
            presentation: 'modal',
            animation: 'fade',
          }} 
        />
      </Stack>
    </>
  );
}
