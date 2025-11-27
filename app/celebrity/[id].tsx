// StarTrade - Celebrity Detail Screen
// FOR ENTERTAINMENT PURPOSES ONLY - All values are fictional
import { View, Text, ScrollView, Pressable, ActivityIndicator, Image } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCelebrity, useChallenges, PredictionChallenge } from '@/hooks/useMarkets';
import { useAuthStore } from '@/stores/authStore';
import PredictionSlip from '@/components/PredictionSlip';

export default function CelebrityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { celebrity, loading, error } = useCelebrity(id);
  const { challenges } = useChallenges({ celebrityId: id });
  const user = useAuthStore((state) => state.user);
  const [selectedChallenge, setSelectedChallenge] = useState<PredictionChallenge | null>(null);
  const [selectedPrediction, setSelectedPrediction] = useState<'YES' | 'NO' | null>(null);

  if (loading) {
    return (
      <View className="flex-1 bg-dark-950 items-center justify-center">
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  if (error || !celebrity) {
    return (
      <View className="flex-1 bg-dark-950 items-center justify-center px-4">
        <Text className="text-red-400 text-center mb-4">Failed to load celebrity</Text>
        <Pressable 
          onPress={() => router.back()}
          className="bg-dark-800 px-6 py-3 rounded-lg"
        >
          <Text className="text-white">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const metrics = celebrity.metrics || {};
  const priceChange = celebrity.price_change_24h || 0;
  const isPositive = priceChange >= 0;

  // Format large numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

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
        {/* Celebrity Header */}
        <View className="items-center mb-6">
          <View className="w-24 h-24 bg-dark-700 rounded-full items-center justify-center mb-4 overflow-hidden">
            {celebrity.image_url ? (
              <Image 
                source={{ uri: celebrity.image_url }} 
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <Text className="text-white text-3xl font-bold">
                {celebrity.name.charAt(0)}
              </Text>
            )}
          </View>
          <Text className="text-white text-2xl font-bold mb-1">{celebrity.name}</Text>
          <View className="bg-primary-500/20 px-3 py-1 rounded-full">
            <Text className="text-primary-400 text-sm">{celebrity.category}</Text>
          </View>
        </View>

        {/* Entertainment Disclaimer */}
        <View className="bg-yellow-500/10 rounded-lg px-3 py-2 mb-4">
          <Text className="text-yellow-400 text-xs text-center">
            For entertainment only. All share prices are fictional.
          </Text>
        </View>

        {/* Fictional Share Price */}
        <View className="bg-dark-900 rounded-xl p-4 mb-4">
          <Text className="text-gray-400 text-sm mb-2 text-center">Fictional Share Price</Text>
          <Text className="text-white text-4xl font-bold text-center">
            {celebrity.share_price?.toFixed(2)} tokens
          </Text>
          <View className={`flex-row items-center justify-center mt-2 px-3 py-1 rounded-full self-center ${
            isPositive ? 'bg-green-500/20' : 'bg-red-500/20'
          }`}>
            <Text className={`font-medium ${
              isPositive ? 'text-green-400' : 'text-red-400'
            }`}>
              {isPositive ? '↑' : '↓'} {Math.abs(priceChange).toFixed(1)}% today
            </Text>
          </View>
        </View>

        {/* Career Performance Score */}
        <View className="bg-dark-900 rounded-xl p-4 mb-4">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-gray-400">Career Performance Score</Text>
            <Text className="text-primary-400 text-2xl font-bold">{celebrity.career_score}/100</Text>
          </View>
          {/* Score Bar */}
          <View className="h-3 bg-dark-700 rounded-full overflow-hidden">
            <View 
              className={`h-full rounded-full ${
                celebrity.career_score >= 80 ? 'bg-green-500' :
                celebrity.career_score >= 60 ? 'bg-yellow-500' :
                celebrity.career_score >= 40 ? 'bg-orange-500' : 'bg-red-500'
              }`}
              style={{ width: `${celebrity.career_score}%` }}
            />
          </View>
          <Text className="text-gray-500 text-xs mt-2 text-center">
            Based on public entertainment metrics (fictional algorithm)
          </Text>
        </View>

        {/* Bio */}
        {celebrity.bio && (
          <View className="bg-dark-900 rounded-xl p-4 mb-4">
            <Text className="text-gray-400 text-sm mb-2">About</Text>
            <Text className="text-white leading-6">{celebrity.bio}</Text>
          </View>
        )}

        {/* Public Entertainment Metrics */}
        <View className="bg-dark-900 rounded-xl p-4 mb-4">
          <Text className="text-gray-400 text-sm mb-3">Entertainment Metrics</Text>
          <View className="gap-3">
            {metrics.spotify_streams && (
              <View className="flex-row justify-between">
                <Text className="text-gray-400">Spotify Streams</Text>
                <Text className="text-white font-medium">{formatNumber(metrics.spotify_streams)}</Text>
              </View>
            )}
            {metrics.youtube_views && (
              <View className="flex-row justify-between">
                <Text className="text-gray-400">YouTube Views</Text>
                <Text className="text-white font-medium">{formatNumber(metrics.youtube_views)}</Text>
              </View>
            )}
            {metrics.instagram_followers && (
              <View className="flex-row justify-between">
                <Text className="text-gray-400">Instagram Followers</Text>
                <Text className="text-white font-medium">{formatNumber(metrics.instagram_followers)}</Text>
              </View>
            )}
            {metrics.twitter_followers && (
              <View className="flex-row justify-between">
                <Text className="text-gray-400">Twitter/X Followers</Text>
                <Text className="text-white font-medium">{formatNumber(metrics.twitter_followers)}</Text>
              </View>
            )}
            {metrics.engagement_rate && (
              <View className="flex-row justify-between">
                <Text className="text-gray-400">Engagement Rate</Text>
                <Text className="text-white font-medium">{metrics.engagement_rate}%</Text>
              </View>
            )}
            {metrics.trend_score && (
              <View className="flex-row justify-between">
                <Text className="text-gray-400">Trend Score</Text>
                <Text className={`font-medium ${
                  metrics.trend_score >= 80 ? 'text-green-400' : 
                  metrics.trend_score >= 50 ? 'text-yellow-400' : 'text-red-400'
                }`}>{metrics.trend_score}</Text>
              </View>
            )}
            {metrics.sentiment_score !== undefined && (
              <View className="flex-row justify-between">
                <Text className="text-gray-400">Fan Sentiment</Text>
                <Text className={`font-medium ${
                  metrics.sentiment_score >= 50 ? 'text-green-400' : 
                  metrics.sentiment_score >= 0 ? 'text-yellow-400' : 'text-red-400'
                }`}>{metrics.sentiment_score > 0 ? '+' : ''}{metrics.sentiment_score}</Text>
              </View>
            )}
          </View>
          <Text className="text-gray-600 text-xs mt-3 text-center">
            Data from public APIs. For entertainment only.
          </Text>
        </View>

        {/* Collect Fictional Shares Button */}
        <Pressable
          onPress={() => user ? null : router.push('/auth')} // TODO: Add buy modal
          className="bg-primary-500 rounded-xl py-4 mb-4"
        >
          <Text className="text-white text-center font-bold text-lg">
            {user ? 'Collect Fictional Shares' : 'Sign In to Collect'}
          </Text>
        </Pressable>

        {/* Prediction Challenges */}
        {challenges.length > 0 && (
          <View className="mb-4">
            <Text className="text-white text-xl font-bold mb-3">Prediction Challenges</Text>
            <Text className="text-gray-500 text-xs mb-3">
              Test your prediction skills - uses fan tokens only, not real money
            </Text>
            {challenges.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                onSelect={(prediction) => {
                  setSelectedChallenge(challenge);
                  setSelectedPrediction(prediction);
                }}
              />
            ))}
          </View>
        )}

        <View className="h-32" />
      </ScrollView>

      {/* Prediction Slip */}
      {selectedChallenge && selectedPrediction && (
        <PredictionSlip
          challenge={selectedChallenge}
          prediction={selectedPrediction}
          sentiment={selectedPrediction === 'YES' 
            ? selectedChallenge.fan_sentiment.yes 
            : selectedChallenge.fan_sentiment.no}
          onClose={() => {
            setSelectedChallenge(null);
            setSelectedPrediction(null);
          }}
        />
      )}
    </View>
  );
}

interface ChallengeCardProps {
  challenge: PredictionChallenge;
  onSelect: (prediction: 'YES' | 'NO') => void;
}

function ChallengeCard({ challenge, onSelect }: ChallengeCardProps) {
  const sentiment = challenge.fan_sentiment || { yes: 50, no: 50 };
  const endsDate = new Date(challenge.challenge_ends_at);
  const isEnding = endsDate.getTime() - Date.now() < 24 * 60 * 60 * 1000;
  const isClosed = challenge.status !== 'ACTIVE';

  return (
    <View className="bg-dark-900 rounded-xl p-4 mb-3 border border-dark-800">
      {/* Category & Status */}
      <View className="flex-row justify-between items-center mb-2">
        <View className="bg-primary-500/20 px-2 py-1 rounded-full">
          <Text className="text-primary-400 text-xs">{challenge.category}</Text>
        </View>
        {isEnding && !isClosed && (
          <View className="bg-yellow-500/20 px-2 py-1 rounded-full">
            <Text className="text-yellow-400 text-xs">Ending Soon</Text>
          </View>
        )}
        {isClosed && (
          <View className="bg-red-500/20 px-2 py-1 rounded-full">
            <Text className="text-red-400 text-xs">Closed</Text>
          </View>
        )}
      </View>

      {/* Title */}
      <Text className="text-white font-medium mb-3">{challenge.title}</Text>

      {/* Fan Sentiment - NOT odds */}
      <View className="flex-row gap-2 mb-3">
        <Pressable
          onPress={() => !isClosed && onSelect('YES')}
          disabled={isClosed}
          className={`flex-1 rounded-lg p-3 items-center bg-dark-800 ${isClosed ? 'opacity-50' : 'active:opacity-80'}`}
        >
          <Text className="text-gray-400 text-xs mb-1">Fans say Yes</Text>
          <Text className="text-green-400 text-xl font-bold">{sentiment.yes}%</Text>
        </Pressable>
        <Pressable
          onPress={() => !isClosed && onSelect('NO')}
          disabled={isClosed}
          className={`flex-1 rounded-lg p-3 items-center bg-dark-800 ${isClosed ? 'opacity-50' : 'active:opacity-80'}`}
        >
          <Text className="text-gray-400 text-xs mb-1">Fans say No</Text>
          <Text className="text-red-400 text-xl font-bold">{sentiment.no}%</Text>
        </Pressable>
      </View>

      {/* Info */}
      <View className="flex-row justify-between pt-2 border-t border-dark-800">
        <Text className="text-gray-500 text-xs">
          {challenge.total_predictions} predictions
        </Text>
        <Text className="text-gray-500 text-xs">
          Ends: {endsDate.toLocaleDateString()}
        </Text>
      </View>

      {/* Resolved Outcome */}
      {challenge.resolved_outcome !== null && (
        <View className={`mt-3 rounded-lg p-2 ${
          challenge.resolved_outcome ? 'bg-green-500/20' : 'bg-red-500/20'
        }`}>
          <Text className="text-center">
            <Text className="text-gray-300 text-sm">Outcome: </Text>
            <Text className={`font-bold ${
              challenge.resolved_outcome ? 'text-green-400' : 'text-red-400'
            }`}>
              {challenge.resolved_outcome ? 'YES' : 'NO'}
            </Text>
          </Text>
        </View>
      )}
    </View>
  );
}
