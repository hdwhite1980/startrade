// StarTrade - Fan Profile Screen  
// FOR ENTERTAINMENT PURPOSES ONLY
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { usePortfolioStats } from '@/hooks/useBets';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const { stats, loading } = usePortfolioStats(user?.id || '');

  if (!user) {
    return (
      <View className="flex-1 bg-dark-950 items-center justify-center px-6">
        <Text className="text-4xl mb-4">🎮</Text>
        <Text className="text-white text-2xl font-bold mb-2">Join the Fun!</Text>
        <Text className="text-gray-400 text-center mb-6">
          Sign in to track your predictions and compete on the leaderboard
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

  if (loading) {
    return (
      <View className="flex-1 bg-dark-950 items-center justify-center">
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  // Determine badges
  const badges = [];
  if (stats.activePredictions >= 5) badges.push('🎯 Active Predictor');
  if (stats.predictionAccuracy >= 70) badges.push('🎖️ High Accuracy');
  if (stats.winRate >= 60) badges.push('🏆 Winning Streak');
  if (stats.fanTokens >= 2000) badges.push('💰 Token Master');

  return (
    <View className="flex-1 bg-dark-950 pt-14">
      <ScrollView className="flex-1 px-4">
        {/* Profile Header */}
        <View className="items-center mb-6">
          <View className="w-24 h-24 bg-primary-500/20 rounded-full items-center justify-center mb-4">
            <Text className="text-4xl">
              {stats.rankTitle === 'Legend' ? '👑' :
               stats.rankTitle === 'Celebrity Expert' ? '⭐' :
               stats.rankTitle === 'Super Fan' ? '🌟' :
               stats.rankTitle === 'Rising Star' ? '✨' : '🎮'}
            </Text>
          </View>
          <Text className="text-white text-2xl font-bold mb-1">
            {user.email?.split('@')[0] || 'Fan'}
          </Text>
          <View className="bg-primary-500/20 px-3 py-1 rounded-full">
            <Text className="text-primary-400 font-medium">{stats.rankTitle}</Text>
          </View>
        </View>

        {/* Entertainment Disclaimer */}
        <View className="bg-yellow-500/10 rounded-lg px-3 py-2 mb-6">
          <Text className="text-yellow-400 text-xs text-center">
            This app is for entertainment purposes only. All values are fictional.
          </Text>
        </View>

        {/* Fan Tokens */}
        <View className="bg-dark-900 rounded-xl p-6 mb-4 items-center">
          <Text className="text-gray-400 text-sm mb-2">Your Fan Tokens</Text>
          <Text className="text-primary-400 text-4xl font-bold">
            🎫 {stats.fanTokens.toLocaleString()}
          </Text>
          <Text className="text-gray-600 text-xs mt-2">
            Virtual tokens for entertainment only
          </Text>
        </View>

        {/* Stats Grid */}
        <View className="flex-row flex-wrap gap-3 mb-6">
          <View className="bg-dark-900 rounded-xl p-4 flex-1 min-w-[45%]">
            <Text className="text-gray-400 text-sm">Prediction Accuracy</Text>
            <Text className="text-green-400 text-2xl font-bold">
              {stats.predictionAccuracy.toFixed(0)}%
            </Text>
          </View>
          <View className="bg-dark-900 rounded-xl p-4 flex-1 min-w-[45%]">
            <Text className="text-gray-400 text-sm">Active Predictions</Text>
            <Text className="text-white text-2xl font-bold">
              {stats.activePredictions}
            </Text>
          </View>
          <View className="bg-dark-900 rounded-xl p-4 flex-1 min-w-[45%]">
            <Text className="text-gray-400 text-sm">Collection Value</Text>
            <Text className="text-white text-2xl font-bold">
              {stats.totalValue.toFixed(0)}
            </Text>
            <Text className="text-gray-600 text-xs">fictional tokens</Text>
          </View>
          <View className="bg-dark-900 rounded-xl p-4 flex-1 min-w-[45%]">
            <Text className="text-gray-400 text-sm">Lifetime Earned</Text>
            <Text className="text-primary-400 text-2xl font-bold">
              {stats.totalWinnings > 0 ? `+${stats.totalWinnings}` : '0'}
            </Text>
          </View>
        </View>

        {/* Achievement Badges */}
        {badges.length > 0 && (
          <View className="bg-dark-900 rounded-xl p-4 mb-6">
            <Text className="text-gray-400 text-sm mb-3">Achievements</Text>
            <View className="flex-row flex-wrap gap-2">
              {badges.map((badge, index) => (
                <View key={index} className="bg-dark-800 px-3 py-2 rounded-lg">
                  <Text className="text-white text-sm">{badge}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Rank Progress */}
        <View className="bg-dark-900 rounded-xl p-4 mb-6">
          <Text className="text-gray-400 text-sm mb-3">Rank Progress</Text>
          <View className="gap-2">
            {['Rookie Fan', 'Rising Star', 'Super Fan', 'Celebrity Expert', 'Legend'].map((rank, index) => {
              const isCurrentOrPast = 
                rank === stats.rankTitle || 
                ['Rookie Fan', 'Rising Star', 'Super Fan', 'Celebrity Expert', 'Legend']
                  .indexOf(rank) < 
                ['Rookie Fan', 'Rising Star', 'Super Fan', 'Celebrity Expert', 'Legend']
                  .indexOf(stats.rankTitle);
              
              return (
                <View key={rank} className="flex-row items-center">
                  <View className={`w-6 h-6 rounded-full items-center justify-center mr-3 ${
                    isCurrentOrPast ? 'bg-primary-500' : 'bg-dark-700'
                  }`}>
                    {isCurrentOrPast && <Text className="text-white text-xs">✓</Text>}
                  </View>
                  <Text className={`${
                    rank === stats.rankTitle ? 'text-primary-400 font-bold' : 
                    isCurrentOrPast ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {rank}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Sign Out */}
        <Pressable
          onPress={signOut}
          className="bg-dark-800 rounded-xl py-4 mb-8"
        >
          <Text className="text-red-400 text-center font-medium">Sign Out</Text>
        </Pressable>

        {/* Legal Disclaimer */}
        <View className="bg-dark-900 rounded-xl p-4 mb-8">
          <Text className="text-gray-500 text-xs text-center leading-5">
            This app is for entertainment purposes only. All "shares," "tokens," 
            and "values" are fictional and have no real monetary value. This is 
            not a gambling app, financial platform, or investment tool. All 
            celebrity performance data is based on publicly available 
            entertainment metrics.
          </Text>
        </View>

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
