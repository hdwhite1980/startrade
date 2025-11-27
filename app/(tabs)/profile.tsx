// StarTrade - Profile Screen  
// Real USDC Betting on Base (Coinbase L2)
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { usePortfolioStats, useUserStats } from '@/hooks/useBets';
import { useWallet } from '@/hooks/useWallet';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const { stats, loading } = usePortfolioStats(user?.id || '');
  const { profile } = useUserStats();
  const { address: walletAddress } = useWallet();

  if (!user) {
    return (
      <View className="flex-1 bg-dark-950 items-center justify-center px-6">
        <Text className="text-4xl mb-4">👤</Text>
        <Text className="text-white text-2xl font-bold mb-2">My Account</Text>
        <Text className="text-gray-400 text-center mb-6">
          Sign in to access your wallet and betting profile
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

  // Determine badges based on real betting performance
  const badges = [];
  if (stats.activeBets >= 3) badges.push('🎯 Active Bettor');
  if (stats.winRate >= 60) badges.push('�� Winning Streak');
  if (stats.totalBets >= 10) badges.push('📈 Experienced');
  if (stats.totalBets >= 50) badges.push('💎 Veteran');
  if (stats.netProfit > 0) badges.push('💰 Profitable');

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]
    );
  };

  return (
    <View className="flex-1 bg-dark-950 pt-14">
      <ScrollView className="flex-1 px-4">
        {/* Profile Header */}
        <View className="items-center mb-6">
          <View className="w-24 h-24 bg-primary-500/20 rounded-full items-center justify-center mb-4">
            <Text className="text-4xl">
              {stats.rankTitle === 'Legend' ? '👑' :
               stats.rankTitle === 'High Roller' ? '💎' :
               stats.rankTitle === 'Pro Bettor' ? '🎯' :
               stats.rankTitle === 'Rising Star' ? '⭐' : '🎮'}
            </Text>
          </View>
          <Text className="text-white text-2xl font-bold mb-1">
            {user.email?.split('@')[0] || 'Bettor'}
          </Text>
          <View className="bg-primary-500/20 px-3 py-1 rounded-full">
            <Text className="text-primary-400 font-medium">{stats.rankTitle}</Text>
          </View>
        </View>

        {/* Wallet Address */}
        {walletAddress && (
          <View className="bg-dark-900 rounded-xl p-4 mb-4">
            <Text className="text-gray-400 text-sm mb-2">Wallet Address</Text>
            <Text className="text-white font-mono text-sm" numberOfLines={1}>
              {walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}
            </Text>
            <Text className="text-gray-600 text-xs mt-1">Base Network (Coinbase L2)</Text>
          </View>
        )}

        {/* Balance Overview */}
        <View className="bg-gradient-to-br from-primary-600/20 to-primary-800/20 rounded-xl p-6 mb-4 border border-primary-500/20">
          <Text className="text-gray-400 text-sm mb-2">Total Balance</Text>
          <Text className="text-white text-4xl font-bold">
            ${(stats.usdcBalance + stats.escrowedBalance).toFixed(2)}
          </Text>
          <View className="flex-row mt-3 gap-4">
            <View>
              <Text className="text-gray-500 text-xs">Available</Text>
              <Text className="text-green-400 font-medium">${stats.usdcBalance.toFixed(2)}</Text>
            </View>
            <View>
              <Text className="text-gray-500 text-xs">In Bets</Text>
              <Text className="text-yellow-400 font-medium">${stats.escrowedBalance.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        <View className="flex-row flex-wrap gap-3 mb-6">
          <View className="bg-dark-900 rounded-xl p-4 flex-1 min-w-[45%]">
            <Text className="text-gray-400 text-sm">Win Rate</Text>
            <Text className="text-green-400 text-2xl font-bold">
              {stats.winRate.toFixed(0)}%
            </Text>
          </View>
          <View className="bg-dark-900 rounded-xl p-4 flex-1 min-w-[45%]">
            <Text className="text-gray-400 text-sm">Total Bets</Text>
            <Text className="text-white text-2xl font-bold">
              {stats.totalBets}
            </Text>
          </View>
          <View className="bg-dark-900 rounded-xl p-4 flex-1 min-w-[45%]">
            <Text className="text-gray-400 text-sm">Net Profit</Text>
            <Text className={`text-2xl font-bold ${stats.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.netProfit >= 0 ? '+' : ''}${stats.netProfit.toFixed(2)}
            </Text>
          </View>
          <View className="bg-dark-900 rounded-xl p-4 flex-1 min-w-[45%]">
            <Text className="text-gray-400 text-sm">Active Bets</Text>
            <Text className="text-yellow-400 text-2xl font-bold">
              {stats.activeBets}
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
            {['Rookie', 'Rising Star', 'Pro Bettor', 'High Roller', 'Legend'].map((rank) => {
              const ranks = ['Rookie', 'Rising Star', 'Pro Bettor', 'High Roller', 'Legend'];
              const currentIndex = ranks.indexOf(stats.rankTitle);
              const rankIndex = ranks.indexOf(rank);
              const isCurrentOrPast = rankIndex <= currentIndex;
              
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

        {/* Deposit / Withdraw Buttons */}
        <View className="flex-row gap-3 mb-6">
          <Pressable
            onPress={() => Alert.alert('Deposit', 'Deposit functionality coming soon!')}
            className="flex-1 bg-green-500/20 border border-green-500/30 rounded-xl py-4"
          >
            <Text className="text-green-400 text-center font-medium">Deposit USDC</Text>
          </Pressable>
          <Pressable
            onPress={() => Alert.alert('Withdraw', 'Withdraw functionality coming soon!')}
            className="flex-1 bg-blue-500/20 border border-blue-500/30 rounded-xl py-4"
          >
            <Text className="text-blue-400 text-center font-medium">Withdraw</Text>
          </Pressable>
        </View>

        {/* Sign Out */}
        <Pressable
          onPress={handleSignOut}
          className="bg-dark-800 rounded-xl py-4 mb-8"
        >
          <Text className="text-red-400 text-center font-medium">Sign Out</Text>
        </Pressable>

        {/* Legal Disclaimer */}
        <View className="bg-dark-900 rounded-xl p-4 mb-8">
          <Text className="text-gray-500 text-xs text-center leading-5">
            StarTrade is a prediction market platform using real USDC on Base 
            (Coinbase L2). All bets involve real cryptocurrency. Please bet 
            responsibly and only with funds you can afford to lose. Must be 
            18+ to participate.
          </Text>
        </View>

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
