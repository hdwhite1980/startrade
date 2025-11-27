import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useMarkets, Market } from '@/hooks/useMarkets';

const CATEGORIES = ['All', 'Sports', 'Politics', 'Entertainment', 'Crypto', 'Tech'];

export default function MarketsScreen() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const { markets, loading, error, refetch } = useMarkets({
    category: selectedCategory === 'All' ? undefined : selectedCategory,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-dark-950 items-center justify-center">
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text className="text-gray-400 mt-4">Loading markets...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-dark-950 items-center justify-center px-4">
        <Text className="text-red-400 text-center">Failed to load markets</Text>
        <Pressable 
          onPress={refetch}
          className="mt-4 bg-primary-500 px-6 py-3 rounded-lg"
        >
          <Text className="text-white font-semibold">Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-dark-950 pt-14">
      {/* Header */}
      <View className="px-4 mb-4">
        <Text className="text-white text-3xl font-bold">Markets</Text>
        <Text className="text-gray-400 mt-1">Predict the future, win big</Text>
      </View>

      {/* Category Filter */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        className="px-4 mb-4"
        contentContainerStyle={{ gap: 8 }}
      >
        {CATEGORIES.map((category) => (
          <Pressable
            key={category}
            onPress={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-full ${
              selectedCategory === category 
                ? 'bg-primary-500' 
                : 'bg-dark-800'
            }`}
          >
            <Text className={`font-medium ${
              selectedCategory === category 
                ? 'text-white' 
                : 'text-gray-400'
            }`}>
              {category}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Markets List */}
      <ScrollView 
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8b5cf6"
          />
        }
      >
        {markets.length === 0 ? (
          <View className="items-center py-12">
            <Text className="text-gray-400 text-lg">No markets found</Text>
          </View>
        ) : (
          markets.map((market) => (
            <MarketCard 
              key={market.id} 
              market={market} 
              onPress={() => router.push(`/market/${market.id}`)}
            />
          ))
        )}
        
        {/* Bottom spacing */}
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}

interface MarketCardProps {
  market: Market;
  onPress: () => void;
}

function MarketCard({ market, onPress }: MarketCardProps) {
  const odds = market.current_odds || { yes: 0.5, no: 0.5 };
  const closingDate = new Date(market.betting_closes_at);
  const isClosingSoon = closingDate.getTime() - Date.now() < 24 * 60 * 60 * 1000;

  return (
    <Pressable
      onPress={onPress}
      className="bg-dark-900 rounded-xl p-4 mb-3 border border-dark-800 active:opacity-80"
    >
      {/* Category & Status */}
      <View className="flex-row justify-between items-center mb-3">
        <View className="bg-primary-500/20 px-3 py-1 rounded-full">
          <Text className="text-primary-500 text-xs font-medium">
            {market.category}
          </Text>
        </View>
        {isClosingSoon && (
          <View className="bg-yellow-500/20 px-3 py-1 rounded-full">
            <Text className="text-yellow-500 text-xs font-medium">
              Closing Soon
            </Text>
          </View>
        )}
      </View>

      {/* Title */}
      <Text className="text-white font-semibold text-lg mb-4 leading-6">
        {market.title}
      </Text>

      {/* Odds Display */}
      <View className="flex-row gap-3">
        <View className="flex-1 bg-dark-800 rounded-lg p-3 items-center">
          <Text className="text-gray-400 text-sm mb-1">Yes</Text>
          <Text className="text-green-400 text-2xl font-bold">
            {(odds.yes * 100).toFixed(0)}¢
          </Text>
          <Text className="text-gray-500 text-xs mt-1">
            {(odds.yes * 100).toFixed(0)}% chance
          </Text>
        </View>
        <View className="flex-1 bg-dark-800 rounded-lg p-3 items-center">
          <Text className="text-gray-400 text-sm mb-1">No</Text>
          <Text className="text-red-400 text-2xl font-bold">
            {(odds.no * 100).toFixed(0)}¢
          </Text>
          <Text className="text-gray-500 text-xs mt-1">
            {(odds.no * 100).toFixed(0)}% chance
          </Text>
        </View>
      </View>

      {/* Volume */}
      <View className="flex-row justify-between mt-3 pt-3 border-t border-dark-800">
        <Text className="text-gray-500 text-sm">
          Volume: ${market.total_volume?.toLocaleString() || '0'}
        </Text>
        <Text className="text-gray-500 text-sm">
          Closes: {closingDate.toLocaleDateString()}
        </Text>
      </View>
    </Pressable>
  );
}
