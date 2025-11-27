// StarTrade - My Collection Screen
// FOR ENTERTAINMENT PURPOSES ONLY - All values are fictional
import { View, Text, ScrollView, Pressable, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { usePredictions, useHoldings, usePortfolioStats, Prediction, ShareHolding } from '@/hooks/useBets';

export default function MyCollectionScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { predictions, loading: predictionsLoading } = usePredictions({ userId: user?.id });
  const { holdings, loading: holdingsLoading } = useHoldings(user?.id);
  const { stats } = usePortfolioStats(user?.id || '');

  if (!user) {
    return (
      <View className="flex-1 bg-dark-950 items-center justify-center px-6">
        <Text className="text-4xl mb-4">🎫</Text>
        <Text className="text-white text-2xl font-bold mb-2">My Collection</Text>
        <Text className="text-gray-400 text-center mb-6">
          Sign in to collect fictional shares and make predictions
        </Text>
        <Pressable
          onPress={() => router.push('/auth')}
          className="bg-primary-500 px-8 py-4 rounded-xl"
        >
          <Text className="text-white font-semibold text-lg">Sign In</Text>
        </Pressable>
      </View>
    );
  }

  const loading = predictionsLoading || holdingsLoading;

  if (loading) {
    return (
      <View className="flex-1 bg-dark-950 items-center justify-center">
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  const activePredictions = predictions.filter((p) => p.status === 'ACTIVE');
  const settledPredictions = predictions.filter((p) => p.status !== 'ACTIVE');

  return (
    <View className="flex-1 bg-dark-950 pt-14">
      <Text className="text-white text-3xl font-bold px-4 mb-2">My Collection</Text>
      <Text className="text-gray-500 text-sm px-4 mb-4">For entertainment purposes only</Text>

      {/* Stats Cards */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 mb-6">
        <View className="bg-dark-900 rounded-xl p-4 mr-3 min-w-[140px]">
          <Text className="text-gray-400 text-sm">Fan Tokens</Text>
          <Text className="text-primary-400 text-2xl font-bold">
            🎫 {stats.fanTokens.toLocaleString()}
          </Text>
        </View>
        <View className="bg-dark-900 rounded-xl p-4 mr-3 min-w-[140px]">
          <Text className="text-gray-400 text-sm">Collection Value</Text>
          <Text className="text-white text-2xl font-bold">
            {stats.totalValue.toFixed(0)}
          </Text>
          <Text className="text-gray-500 text-xs">fictional tokens</Text>
        </View>
        <View className="bg-dark-900 rounded-xl p-4 mr-3 min-w-[140px]">
          <Text className="text-gray-400 text-sm">Accuracy</Text>
          <Text className="text-green-400 text-2xl font-bold">
            {stats.predictionAccuracy.toFixed(0)}%
          </Text>
        </View>
        <View className="bg-dark-900 rounded-xl p-4 min-w-[140px]">
          <Text className="text-gray-400 text-sm">Rank</Text>
          <Text className="text-primary-400 text-lg font-bold">
            {stats.rankTitle}
          </Text>
        </View>
      </ScrollView>

      <ScrollView className="flex-1 px-4">
        {/* Fictional Share Holdings */}
        <Text className="text-white text-xl font-bold mb-3">Fictional Shares</Text>
        {holdings.length === 0 ? (
          <View className="bg-dark-900 rounded-xl p-6 items-center mb-6">
            <Text className="text-gray-400 mb-2">No shares collected yet</Text>
            <Text className="text-gray-600 text-xs mb-3">
              Collect fictional celebrity shares for fun!
            </Text>
            <Pressable
              onPress={() => router.push('/')}
              className="mt-2 bg-primary-500 px-6 py-2 rounded-lg"
            >
              <Text className="text-white font-medium">Browse Fan Market</Text>
            </Pressable>
          </View>
        ) : (
          holdings.map((holding) => (
            <HoldingCard key={holding.id} holding={holding} />
          ))
        )}

        {/* Active Predictions */}
        <Text className="text-white text-xl font-bold mb-3 mt-4">Active Predictions</Text>
        {activePredictions.length === 0 ? (
          <View className="bg-dark-900 rounded-xl p-6 items-center mb-6">
            <Text className="text-gray-400 mb-2">No active predictions</Text>
            <Text className="text-gray-600 text-xs mb-3">
              Make predictions on entertainment challenges!
            </Text>
            <Pressable
              onPress={() => router.push('/')}
              className="mt-2 bg-primary-500 px-6 py-2 rounded-lg"
            >
              <Text className="text-white font-medium">Find Challenges</Text>
            </Pressable>
          </View>
        ) : (
          activePredictions.map((prediction) => (
            <PredictionCard key={prediction.id} prediction={prediction} />
          ))
        )}

        {/* Prediction History */}
        <Text className="text-white text-xl font-bold mb-3 mt-4">Prediction History</Text>
        {settledPredictions.length === 0 ? (
          <View className="bg-dark-900 rounded-xl p-6 items-center">
            <Text className="text-gray-400">No completed predictions yet</Text>
          </View>
        ) : (
          settledPredictions.slice(0, 10).map((prediction) => (
            <PredictionCard key={prediction.id} prediction={prediction} />
          ))
        )}

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}

function HoldingCard({ holding }: { holding: ShareHolding }) {
  const celebrity = holding.celebrity as any;
  const currentValue = holding.shares_owned * (celebrity?.share_price || 0);
  const profit = currentValue - holding.total_invested_tokens;
  const profitPercent = holding.total_invested_tokens > 0 
    ? (profit / holding.total_invested_tokens) * 100 
    : 0;

  return (
    <View className="bg-dark-900 rounded-xl p-4 mb-3 border border-dark-800">
      <View className="flex-row items-center mb-3">
        <View className="w-12 h-12 bg-dark-700 rounded-full items-center justify-center mr-3 overflow-hidden">
          {celebrity?.image_url ? (
            <Image 
              source={{ uri: celebrity.image_url }} 
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <Text className="text-white text-lg font-bold">
              {celebrity?.name?.charAt(0) || '?'}
            </Text>
          )}
        </View>
        <View className="flex-1">
          <Text className="text-white font-medium">{celebrity?.name || 'Unknown'}</Text>
          <Text className="text-gray-500 text-sm">
            {holding.shares_owned.toFixed(2)} fictional shares
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-white font-bold">{currentValue.toFixed(0)}</Text>
          <View className={`px-2 py-0.5 rounded ${
            profit >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'
          }`}>
            <Text className={`text-xs font-medium ${
              profit >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {profit >= 0 ? '+' : ''}{profitPercent.toFixed(1)}%
            </Text>
          </View>
        </View>
      </View>
      <View className="flex-row justify-between pt-2 border-t border-dark-800">
        <Text className="text-gray-500 text-xs">
          Avg: {holding.average_purchase_price.toFixed(2)} tokens
        </Text>
        <Text className="text-gray-500 text-xs">
          Invested: {holding.total_invested_tokens} tokens
        </Text>
      </View>
    </View>
  );
}

function PredictionCard({ prediction }: { prediction: Prediction }) {
  const isCorrect = prediction.status === 'CORRECT';
  const isIncorrect = prediction.status === 'INCORRECT';
  const isActive = prediction.status === 'ACTIVE';
  const challenge = prediction.challenge as any;

  return (
    <View className="bg-dark-900 rounded-xl p-4 mb-3 border border-dark-800">
      <View className="flex-row justify-between items-start mb-2">
        <Text className="text-white font-medium flex-1 mr-2" numberOfLines={2}>
          {challenge?.title || 'Unknown Challenge'}
        </Text>
        <View className={`px-2 py-1 rounded ${
          isCorrect ? 'bg-green-500/20' : 
          isIncorrect ? 'bg-red-500/20' : 
          'bg-yellow-500/20'
        }`}>
          <Text className={`text-xs font-medium ${
            isCorrect ? 'text-green-400' : 
            isIncorrect ? 'text-red-400' : 
            'text-yellow-400'
          }`}>
            {prediction.status}
          </Text>
        </View>
      </View>

      <View className="flex-row justify-between mt-2">
        <View>
          <Text className="text-gray-400 text-sm">Prediction</Text>
          <Text className={`font-bold ${
            prediction.prediction === 'YES' ? 'text-green-400' : 'text-red-400'
          }`}>
            {prediction.prediction}
          </Text>
        </View>
        <View>
          <Text className="text-gray-400 text-sm">Staked</Text>
          <Text className="text-white font-bold">🎫 {prediction.fan_tokens_staked}</Text>
        </View>
        <View>
          <Text className="text-gray-400 text-sm">
            {isActive ? 'Potential' : 'Reward'}
          </Text>
          <Text className={`font-bold ${
            isCorrect ? 'text-green-400' : 
            isIncorrect ? 'text-red-400' : 
            'text-white'
          }`}>
            {isIncorrect ? '0' : `🎫 ${prediction.potential_reward}`}
          </Text>
        </View>
      </View>
    </View>
  );
}
