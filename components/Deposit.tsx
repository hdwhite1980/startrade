import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useWalletStore } from '@/stores/walletStore';

interface DepositProps {
  onClose: () => void;
}

export default function Deposit({ onClose }: DepositProps) {
  const { deposit, balance, loading } = useWalletStore();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const quickAmounts = ['0.01', '0.05', '0.1', '0.25'];

  const handleDeposit = async () => {
    const numAmount = parseFloat(amount);
    
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (numAmount > parseFloat(balance)) {
      setError('Insufficient ETH balance');
      return;
    }

    setError(null);
    const result = await deposit(amount);

    if (result.error) {
      setError(result.error.message);
    } else {
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    }
  };

  if (success) {
    return (
      <View className="bg-dark-900 rounded-2xl p-6 items-center">
        <Text className="text-4xl mb-4">✓</Text>
        <Text className="text-white text-xl font-bold mb-2">Deposit Successful!</Text>
        <Text className="text-gray-400">Your funds are now available</Text>
      </View>
    );
  }

  return (
    <View className="bg-dark-900 rounded-2xl p-4">
      {/* Header */}
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-white text-xl font-bold">Deposit ETH</Text>
        <Pressable onPress={onClose}>
          <Text className="text-gray-400 text-xl">✕</Text>
        </Pressable>
      </View>

      {/* Balance */}
      <View className="bg-dark-800 rounded-xl p-4 mb-4">
        <Text className="text-gray-400 text-sm">Available ETH</Text>
        <Text className="text-white text-2xl font-bold">
          {parseFloat(balance).toFixed(4)} ETH
        </Text>
      </View>

      {/* Amount Input */}
      <View className="mb-4">
        <Text className="text-gray-400 mb-2">Amount to Deposit</Text>
        <View className="flex-row items-center bg-dark-800 rounded-xl px-4">
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor="#6b7280"
            keyboardType="decimal-pad"
            className="flex-1 text-white text-xl py-4"
          />
          <Text className="text-gray-400">ETH</Text>
        </View>
      </View>

      {/* Quick Amounts */}
      <View className="flex-row gap-2 mb-4">
        {quickAmounts.map((qa) => (
          <Pressable
            key={qa}
            onPress={() => setAmount(qa)}
            className={`flex-1 py-2 rounded-lg ${
              amount === qa ? 'bg-primary-500' : 'bg-dark-800'
            }`}
          >
            <Text className={`text-center font-medium ${
              amount === qa ? 'text-white' : 'text-gray-400'
            }`}>
              {qa}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Error */}
      {error && (
        <View className="bg-red-500/20 rounded-lg p-3 mb-4">
          <Text className="text-red-400 text-center">{error}</Text>
        </View>
      )}

      {/* Deposit Button */}
      <Pressable
        onPress={handleDeposit}
        disabled={loading || !amount}
        className={`rounded-xl py-4 flex-row items-center justify-center ${
          loading || !amount ? 'bg-primary-500/50' : 'bg-primary-500'
        }`}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white text-center font-bold text-lg">
            Deposit {amount || '0'} ETH
          </Text>
        )}
      </Pressable>

      {/* Info */}
      <Text className="text-gray-500 text-center text-sm mt-4">
        Deposits are converted to betting credits at current ETH/USD rate
      </Text>
    </View>
  );
}
