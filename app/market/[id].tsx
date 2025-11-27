import { View, Text, ScrollView, Pressable, ActivityIndicator, TextInput } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMarket } from '@/hooks/useMarkets';
import { useAuthStore } from '@/stores/authStore';
import { useBets } from '@/hooks/useBets';
import BetSlip from '@/components/BetSlip';

export default function MarketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { market, loading, error } = useMarket(id);
  const user = useAuthStore((state) => state.user);
  const [selectedPosition, setSelectedPosition] = useState<'YES' | 'NO' | null>(null);

  if (loading) {
    return (
      <View className="flex-1 bg-dark-950 items-center justify-center">
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  if (error || !market) {
    return (
      <View className="flex-1 bg-dark-950 items-center justify-center px-4">
        <Text className="text-red-400 text-center mb-4">Failed to load market</Text>
        <Pressable 
          onPress={() => router.back()}
          className="bg-dark-800 px-6 py-3 rounded-lg"
        >
          <Text className="text-white">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const odds = market.current_odds || { yes: 0.5, no: 0.5 };
  const closingDate = new Date(market.betting_closes_at);
  const resolvesDate = new Date(market.resolves_at);
  const isClosed = market.status !== 'OPEN';

  return (
    <View className="flex-1 bg-dark-950">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-14 pb-4">
        <Pressable 
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center"
        >
          <Text className="text-white text-2xl">←</Text>
        </Pressable>
        <View className="flex-1" />
        <Pressable className="w-10 h-10 items-center justify-center">
          <Text className="text-white text-xl">⋮</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-4">
        {/* Category Badge */}
        <View className="flex-row mb-3">
          <View className="bg-primary-500/20 px-3 py-1 rounded-full">
            <Text className="text-primary-500 text-sm font-medium">
              {market.category}
            </Text>
          </View>
          {isClosed && (
            <View className="bg-red-500/20 px-3 py-1 rounded-full ml-2">
              <Text className="text-red-400 text-sm font-medium">Closed</Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text className="text-white text-2xl font-bold mb-4">
          {market.title}
        </Text>

        {/* Description */}
        {market.description && (
          <Text className="text-gray-400 mb-6 leading-6">
            {market.description}
          </Text>
        )}

        {/* Current Odds */}
        <View className="bg-dark-900 rounded-xl p-4 mb-4">
          <Text className="text-gray-400 mb-3">Current Odds</Text>
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => !isClosed && setSelectedPosition('YES')}
              disabled={isClosed}
              className={`flex-1 rounded-xl p-4 items-center border-2 ${
                selectedPosition === 'YES' 
                  ? 'border-green-500 bg-green-500/10' 
                  : 'border-transparent bg-dark-800'
              } ${isClosed ? 'opacity-50' : ''}`}
            >
              <Text className="text-gray-400 mb-1">Yes</Text>
              <Text className="text-green-400 text-3xl font-bold">
                {(odds.yes * 100).toFixed(0)}¢
              </Text>
              <Text className="text-gray-500 text-sm mt-1">
                {(odds.yes * 100).toFixed(0)}% implied
              </Text>
            </Pressable>
            <Pressable
              onPress={() => !isClosed && setSelectedPosition('NO')}
              disabled={isClosed}
              className={`flex-1 rounded-xl p-4 items-center border-2 ${
                selectedPosition === 'NO' 
                  ? 'border-red-500 bg-red-500/10' 
                  : 'border-transparent bg-dark-800'
              } ${isClosed ? 'opacity-50' : ''}`}
            >
              <Text className="text-gray-400 mb-1">No</Text>
              <Text className="text-red-400 text-3xl font-bold">
                {(odds.no * 100).toFixed(0)}¢
              </Text>
              <Text className="text-gray-500 text-sm mt-1">
                {(odds.no * 100).toFixed(0)}% implied
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Market Info */}
        <View className="bg-dark-900 rounded-xl p-4 mb-4">
          <View className="flex-row justify-between py-2 border-b border-dark-800">
            <Text className="text-gray-400">Total Volume</Text>
            <Text className="text-white font-medium">
              ${market.total_volume?.toLocaleString() || '0'}
            </Text>
          </View>
          <View className="flex-row justify-between py-2 border-b border-dark-800">
            <Text className="text-gray-400">Betting Closes</Text>
            <Text className="text-white font-medium">
              {closingDate.toLocaleDateString()} {closingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View className="flex-row justify-between py-2">
            <Text className="text-gray-400">Resolution Date</Text>
            <Text className="text-white font-medium">
              {resolvesDate.toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Resolved Value */}
        {market.resolved_value !== undefined && (
          <View className={`rounded-xl p-4 mb-4 ${
            market.resolved_value ? 'bg-green-500/20' : 'bg-red-500/20'
          }`}>
            <Text className="text-center">
              <Text className="text-gray-300">Resolved: </Text>
              <Text className={`font-bold ${
                market.resolved_value ? 'text-green-400' : 'text-red-400'
              }`}>
                {market.resolved_value ? 'YES' : 'NO'}
              </Text>
            </Text>
          </View>
        )}

        <View className="h-32" />
      </ScrollView>

      {/* Bet Slip */}
      {selectedPosition && !isClosed && (
        <BetSlip
          market={market}
          position={selectedPosition}
          odds={selectedPosition === 'YES' ? odds.yes : odds.no}
          onClose={() => setSelectedPosition(null)}
        />
      )}
    </View>
  );
}
