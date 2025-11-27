import { View, Text, TextInput, Pressable, Keyboard } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useBets } from '@/hooks/useBets';
import type { Market } from '@/types/database';
import type { BetSide } from '@/hooks/useBets';

interface BetSlipProps {
  market: Market;
  position: BetSide;
  odds: number;
  onClose: () => void;
}

export default function BetSlip({ market, position, odds, onClose }: BetSlipProps) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { placeBet } = useBets();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numAmount = parseFloat(amount) || 0;
  const potentialPayout = numAmount > 0 ? numAmount / odds : 0;
  const profit = potentialPayout - numAmount;

  const quickAmounts = [1, 5, 10, 25];

  const handlePlaceBet = async () => {
    if (!user) {
      router.push('/auth');
      return;
    }

    if (numAmount < 1) {
      setError('Minimum bet is $1');
      return;
    }

    if (numAmount > 25) {
      setError('Maximum bet is $25');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await placeBet(market.id, position, numAmount, odds);

    setLoading(false);

    if (result.error) {
      setError(result.error.message);
    } else {
      onClose();
    }
  };

  return (
    <View className="absolute bottom-0 left-0 right-0 bg-dark-900 rounded-t-3xl p-4 pb-8 border-t border-dark-800">
      {/* Handle */}
      <View className="w-12 h-1 bg-dark-700 rounded-full self-center mb-4" />
      
      {/* Header */}
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-white text-lg font-bold">Place Bet</Text>
        <Pressable onPress={onClose}>
          <Text className="text-gray-400 text-xl">✕</Text>
        </Pressable>
      </View>

      {/* Position */}
      <View className="flex-row items-center mb-4">
        <View className={`px-3 py-1 rounded-full ${
          position === 'YES' ? 'bg-green-500/20' : 'bg-red-500/20'
        }`}>
          <Text className={`font-bold ${
            position === 'YES' ? 'text-green-400' : 'text-red-400'
          }`}>
            {position}
          </Text>
        </View>
        <Text className="text-gray-400 ml-2">at {(odds * 100).toFixed(0)}¢</Text>
      </View>

      {/* Amount Input */}
      <View className="mb-4">
        <Text className="text-gray-400 mb-2">Amount</Text>
        <View className="flex-row items-center bg-dark-800 rounded-xl px-4">
          <Text className="text-gray-400 text-2xl">$</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor="#6b7280"
            keyboardType="decimal-pad"
            className="flex-1 text-white text-2xl py-4 ml-1"
          />
        </View>
      </View>

      {/* Quick Amounts */}
      <View className="flex-row gap-2 mb-4">
        {quickAmounts.map((qa) => (
          <Pressable
            key={qa}
            onPress={() => {
              setAmount(qa.toString());
              Keyboard.dismiss();
            }}
            className={`flex-1 py-2 rounded-lg ${
              numAmount === qa ? 'bg-primary-500' : 'bg-dark-800'
            }`}
          >
            <Text className={`text-center font-medium ${
              numAmount === qa ? 'text-white' : 'text-gray-400'
            }`}>
              ${qa}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Payout Info */}
      <View className="bg-dark-800 rounded-xl p-4 mb-4">
        <View className="flex-row justify-between mb-2">
          <Text className="text-gray-400">Potential Payout</Text>
          <Text className="text-white font-bold">${potentialPayout.toFixed(2)}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-gray-400">Potential Profit</Text>
          <Text className="text-green-400 font-bold">+${profit.toFixed(2)}</Text>
        </View>
      </View>

      {/* Error */}
      {error && (
        <View className="bg-red-500/20 rounded-lg p-3 mb-4">
          <Text className="text-red-400 text-center">{error}</Text>
        </View>
      )}

      {/* Place Bet Button */}
      <Pressable
        onPress={handlePlaceBet}
        disabled={loading || numAmount <= 0}
        className={`rounded-xl py-4 ${
          loading || numAmount <= 0 
            ? 'bg-primary-500/50' 
            : 'bg-primary-500'
        }`}
      >
        <Text className="text-white text-center font-bold text-lg">
          {loading 
            ? 'Placing Bet...' 
            : !user 
              ? 'Sign In to Bet'
              : numAmount <= 0 
                ? 'Enter Amount' 
                : `Bet $${numAmount.toFixed(2)} on ${position}`}
        </Text>
      </Pressable>
    </View>
  );
}
