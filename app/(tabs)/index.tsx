// StarTrade - Fan Market Screen
// FOR ENTERTAINMENT PURPOSES ONLY - All values are fictional
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useCelebrities, Celebrity } from '@/hooks/useMarkets';

const CATEGORIES = ['All', 'Music', 'Film', 'Sports', 'Social Media', 'TV', 'Gaming'];

export default function FanMarketScreen() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const { celebrities, loading, error, refetch } = useCelebrities({
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
        <Text className="text-gray-400 mt-4">Loading celebrities...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-dark-950 items-center justify-center px-4">
        <Text className="text-red-400 text-center">Failed to load fan market</Text>
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
        <Text className="text-white text-3xl font-bold">Fan Market</Text>
        <Text className="text-gray-400 mt-1">Trade fictional celebrity shares</Text>
      </View>

      {/* Entertainment Disclaimer */}
      <View className="mx-4 mb-3 bg-primary-500/10 rounded-lg px-3 py-2">
        <Text className="text-primary-400 text-xs text-center">
          For entertainment only. All values are fictional.
        </Text>
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

      {/* Celebrities List */}
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
        {celebrities.length === 0 ? (
          <View className="items-center py-12">
            <Text className="text-gray-400 text-lg">No celebrities found</Text>
          </View>
        ) : (
          celebrities.map((celebrity) => (
            <CelebrityCard 
              key={celebrity.id} 
              celebrity={celebrity} 
              onPress={() => router.push(`/celebrity/${celebrity.id}` as any)}
            />
          ))
        )}
        
        {/* Bottom spacing */}
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}

interface CelebrityCardProps {
  celebrity: Celebrity;
  onPress: () => void;
}

function CelebrityCard({ celebrity, onPress }: CelebrityCardProps) {
  const priceChange = celebrity.price_change_24h || 0;
  const isPositive = priceChange >= 0;
  const metrics = celebrity.metrics || {};

  // Format large numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <Pressable
      onPress={onPress}
      className="bg-dark-900 rounded-xl p-4 mb-3 border border-dark-800 active:opacity-80"
    >
      <View className="flex-row items-center mb-3">
        {/* Avatar */}
        <View className="w-14 h-14 bg-dark-700 rounded-full items-center justify-center mr-3 overflow-hidden">
          {celebrity.image_url ? (
            <Image 
              source={{ uri: celebrity.image_url }} 
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <Text className="text-white text-xl font-bold">
              {celebrity.name.charAt(0)}
            </Text>
          )}
        </View>

        {/* Name & Category */}
        <View className="flex-1">
          <Text className="text-white font-semibold text-lg">{celebrity.name}</Text>
          <View className="flex-row items-center mt-1">
            <View className="bg-primary-500/20 px-2 py-0.5 rounded-full mr-2">
              <Text className="text-primary-400 text-xs">{celebrity.category}</Text>
            </View>
            <Text className="text-gray-500 text-xs">Score: {celebrity.career_score}</Text>
          </View>
        </View>

        {/* Share Price (Fictional) */}
        <View className="items-end">
          <Text className="text-white text-xl font-bold">
            {celebrity.share_price?.toFixed(2)}
          </Text>
          <Text className="text-gray-500 text-xs">fictional tokens</Text>
          <View className={`flex-row items-center mt-1 px-2 py-0.5 rounded ${
            isPositive ? 'bg-green-500/20' : 'bg-red-500/20'
          }`}>
            <Text className={`text-sm font-medium ${
              isPositive ? 'text-green-400' : 'text-red-400'
            }`}>
              {isPositive ? '↑' : '↓'} {Math.abs(priceChange).toFixed(1)}%
            </Text>
          </View>
        </View>
      </View>

      {/* Entertainment Metrics */}
      <View className="flex-row gap-3 pt-3 border-t border-dark-800">
        {metrics.spotify_streams && (
          <View className="flex-1 items-center">
            <Text className="text-gray-500 text-xs">Streams</Text>
            <Text className="text-white font-medium">
              {formatNumber(metrics.spotify_streams)}
            </Text>
          </View>
        )}
        {metrics.instagram_followers && (
          <View className="flex-1 items-center">
            <Text className="text-gray-500 text-xs">Followers</Text>
            <Text className="text-white font-medium">
              {formatNumber(metrics.instagram_followers)}
            </Text>
          </View>
        )}
        {metrics.trend_score && (
          <View className="flex-1 items-center">
            <Text className="text-gray-500 text-xs">Trend</Text>
            <Text className={`font-medium ${
              metrics.trend_score >= 80 ? 'text-green-400' : 
              metrics.trend_score >= 50 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {metrics.trend_score}
            </Text>
          </View>
        )}
        {metrics.sentiment_score !== undefined && (
          <View className="flex-1 items-center">
            <Text className="text-gray-500 text-xs">Sentiment</Text>
            <Text className={`font-medium ${
              metrics.sentiment_score >= 50 ? 'text-green-400' : 
              metrics.sentiment_score >= 0 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {metrics.sentiment_score > 0 ? '+' : ''}{metrics.sentiment_score}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
