import '../global.css';
import 'react-native-get-random-values';
import '@ethersproject/shims';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useWalletStore } from '@/stores/walletStore';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { user, initialized, loading } = useAuthStore();
  const initializeAuth = useAuthStore((state) => state.initialize);
  const initializeWallet = useWalletStore((state) => state.initialize);

  useEffect(() => {
    initializeAuth();
    initializeWallet();
  }, []);

  // Auth gate - redirect based on auth state
  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === 'auth' || segments[0] === ('onboarding' as any);

    if (!user && !inAuthGroup) {
      // Not logged in, redirect to auth
      router.replace('/auth');
    } else if (user && segments[0] === 'auth') {
      // Logged in but on auth screen, go to main app
      router.replace('/(tabs)');
    }
  }, [user, initialized, segments]);

  // Show loading screen while initializing
  if (!initialized || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0f', alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

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
            presentation: 'fullScreenModal',
            animation: 'fade',
            gestureEnabled: false,
          }} 
        />
        <Stack.Screen 
          name="onboarding" 
          options={{ 
            presentation: 'fullScreenModal',
            animation: 'slide_from_right',
            gestureEnabled: false,
          }} 
        />
      </Stack>
    </>
  );
}
