import { View, Text, TextInput, Pressable } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function AuthScreen() {
  const router = useRouter();
  const { signIn, signUp, loading } = useAuthStore();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    const action = mode === 'signin' ? signIn : signUp;
    const result = await action(email, password);

    if (result.error) {
      setError(result.error.message);
    } else {
      router.back();
    }
  };

  return (
    <View className="flex-1 bg-dark-950 px-6 pt-20">
      {/* Close Button */}
      <Pressable 
        onPress={() => router.back()}
        className="absolute top-14 right-4 w-10 h-10 items-center justify-center"
      >
        <Text className="text-white text-2xl">✕</Text>
      </Pressable>

      {/* Header */}
      <Text className="text-white text-3xl font-bold mb-2">
        {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
      </Text>
      <Text className="text-gray-400 mb-8">
        {mode === 'signin' 
          ? 'Sign in to continue trading' 
          : 'Join the prediction market'}
      </Text>

      {/* Error Message */}
      {error && (
        <View className="bg-red-500/20 rounded-lg p-3 mb-4">
          <Text className="text-red-400 text-center">{error}</Text>
        </View>
      )}

      {/* Form */}
      <View className="gap-4">
        <View>
          <Text className="text-gray-400 mb-2">Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor="#6b7280"
            autoCapitalize="none"
            keyboardType="email-address"
            className="bg-dark-800 rounded-xl px-4 py-4 text-white text-lg"
          />
        </View>

        <View>
          <Text className="text-gray-400 mb-2">Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#6b7280"
            secureTextEntry
            className="bg-dark-800 rounded-xl px-4 py-4 text-white text-lg"
          />
        </View>
      </View>

      {/* Submit Button */}
      <Pressable
        onPress={handleSubmit}
        disabled={loading}
        className={`mt-8 rounded-xl py-4 ${
          loading ? 'bg-primary-500/50' : 'bg-primary-500'
        }`}
      >
        <Text className="text-white text-center font-semibold text-lg">
          {loading 
            ? 'Loading...' 
            : mode === 'signin' 
              ? 'Sign In' 
              : 'Create Account'}
        </Text>
      </Pressable>

      {/* Toggle Mode */}
      <View className="flex-row justify-center mt-6">
        <Text className="text-gray-400">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
        </Text>
        <Pressable onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          <Text className="text-primary-500 font-semibold">
            {mode === 'signin' ? 'Sign Up' : 'Sign In'}
          </Text>
        </Pressable>
      </View>

      {/* Terms */}
      {mode === 'signup' && (
        <Text className="text-gray-500 text-center text-sm mt-8 px-4">
          By creating an account, you agree to our Terms of Service and Privacy Policy
        </Text>
      )}
    </View>
  );
}
