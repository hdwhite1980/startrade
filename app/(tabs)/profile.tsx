import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useWalletStore } from '@/stores/walletStore';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, loading: authLoading } = useAuthStore();
  const { address, balance, availableBalance, connect, disconnect } = useWalletStore();
  const [depositAmount, setDepositAmount] = useState('');

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            await signOut();
            await disconnect();
          }
        },
      ]
    );
  };

  const handleExportKey = async () => {
    Alert.alert(
      'Export Private Key',
      'Warning: Never share your private key with anyone. Anyone with your private key can access your funds.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Export', 
          style: 'destructive',
          onPress: async () => {
            // Would export key here
            Alert.alert('Private Key', 'Feature coming soon');
          }
        },
      ]
    );
  };

  if (!user) {
    return (
      <View className="flex-1 bg-dark-950 items-center justify-center px-6">
        <Text className="text-6xl mb-4">👤</Text>
        <Text className="text-white text-2xl font-bold mb-2">Welcome to StarTrade</Text>
        <Text className="text-gray-400 text-center mb-8">
          Sign in to start trading on prediction markets
        </Text>
        <Pressable
          onPress={() => router.push('/auth')}
          className="bg-primary-500 px-8 py-4 rounded-xl w-full"
        >
          <Text className="text-white font-semibold text-lg text-center">Sign In</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/auth?mode=signup')}
          className="mt-4 px-8 py-4"
        >
          <Text className="text-primary-500 font-semibold">Create Account</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-dark-950 pt-14">
      <View className="px-4">
        <Text className="text-white text-3xl font-bold mb-6">Profile</Text>

        {/* User Info */}
        <View className="bg-dark-900 rounded-xl p-4 mb-4">
          <View className="flex-row items-center">
            <View className="w-16 h-16 rounded-full bg-primary-500/20 items-center justify-center mr-4">
              <Text className="text-3xl">👤</Text>
            </View>
            <View className="flex-1">
              <Text className="text-white text-lg font-bold">
                {user.email?.split('@')[0] || 'User'}
              </Text>
              <Text className="text-gray-400 text-sm">{user.email}</Text>
            </View>
          </View>
        </View>

        {/* Wallet Section */}
        <Text className="text-white text-xl font-bold mb-3">Wallet</Text>
        
        {!address ? (
          <View className="bg-dark-900 rounded-xl p-6 items-center mb-4">
            <Text className="text-gray-400 mb-4">Connect your wallet to start betting</Text>
            <Pressable
              onPress={connect}
              className="bg-primary-500 px-6 py-3 rounded-lg"
            >
              <Text className="text-white font-semibold">Create Wallet</Text>
            </Pressable>
          </View>
        ) : (
          <View className="bg-dark-900 rounded-xl p-4 mb-4">
            <View className="flex-row justify-between mb-4">
              <Text className="text-gray-400">Address</Text>
              <Text className="text-white font-mono text-sm">
                {address.slice(0, 6)}...{address.slice(-4)}
              </Text>
            </View>
            <View className="flex-row justify-between mb-4">
              <Text className="text-gray-400">ETH Balance</Text>
              <Text className="text-white font-bold">{parseFloat(balance).toFixed(4)} ETH</Text>
            </View>
            <View className="flex-row justify-between mb-4">
              <Text className="text-gray-400">Available to Bet</Text>
              <Text className="text-green-400 font-bold">${availableBalance}</Text>
            </View>

            {/* Deposit Input */}
            <View className="border-t border-dark-800 pt-4 mt-2">
              <Text className="text-gray-400 mb-2">Deposit ETH</Text>
              <View className="flex-row gap-2">
                <TextInput
                  value={depositAmount}
                  onChangeText={setDepositAmount}
                  placeholder="0.01"
                  placeholderTextColor="#6b7280"
                  keyboardType="decimal-pad"
                  className="flex-1 bg-dark-800 rounded-lg px-4 py-3 text-white"
                />
                <Pressable className="bg-primary-500 px-6 rounded-lg items-center justify-center">
                  <Text className="text-white font-semibold">Deposit</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Settings */}
        <Text className="text-white text-xl font-bold mb-3 mt-4">Settings</Text>
        
        <View className="bg-dark-900 rounded-xl overflow-hidden mb-4">
          <Pressable className="flex-row justify-between items-center p-4 border-b border-dark-800">
            <Text className="text-white">Notifications</Text>
            <Text className="text-gray-400">→</Text>
          </Pressable>
          <Pressable className="flex-row justify-between items-center p-4 border-b border-dark-800">
            <Text className="text-white">Security</Text>
            <Text className="text-gray-400">→</Text>
          </Pressable>
          {address && (
            <Pressable 
              onPress={handleExportKey}
              className="flex-row justify-between items-center p-4 border-b border-dark-800"
            >
              <Text className="text-white">Export Private Key</Text>
              <Text className="text-gray-400">→</Text>
            </Pressable>
          )}
          <Pressable className="flex-row justify-between items-center p-4">
            <Text className="text-white">Help & Support</Text>
            <Text className="text-gray-400">→</Text>
          </Pressable>
        </View>

        {/* Sign Out */}
        <Pressable
          onPress={handleSignOut}
          disabled={authLoading}
          className="bg-red-500/20 rounded-xl p-4 items-center mb-8"
        >
          <Text className="text-red-400 font-semibold">Sign Out</Text>
        </Pressable>

        {/* App Version */}
        <Text className="text-gray-600 text-center mb-8">Version 1.0.0</Text>
      </View>
    </ScrollView>
  );
}
