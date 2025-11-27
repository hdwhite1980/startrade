// StarTrade - Portfolio Screen
// Real USDC Betting on Base (Coinbase L2)
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { usePortfolioStats, useBets, calculateBettingStats, Bet } from '@/hooks/useBets';

export default function PortfolioScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { stats, loading: statsLoading, refresh: refreshStats } = usePortfolioStats(user?.id || '');
  const { bets, loading: betsLoading, refresh: refreshBets } = useBets();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshStats(), refreshBets()]);
    setRefreshing(false);
  }, [refreshStats, refreshBets]);

  if (!user) {
    return (
      <View className="flex-1 bg-dark-950 items-center justify-center px-6">
        <Text className="text-4xl mb-4">💰</Text>
        <Text className="text-white text-2xl font-bold mb-2">My Portfolio</Text>
        <Text className="text-gray-400 text-center mb-6">
          Sign in to view your betting history and stats
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

  const loading = statsLoading || betsLoading;
  const betStats = calculateBettingStats(bets);
  const activeBets = bets.filter(b => b.status === 'ACTIVE');
  const recentBets = bets.filter(b => b.status === 'WON' || b.status === 'LOST').slice(0, 10);

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-dark-950 items-center justify-center">
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-dark-950 pt-14">
      <Text className="text-white text-3xl font-bold px-4 mb-2">Portfolio</Text>
      <Text className="text-gray-500 text-sm px-4 mb-4">Real USDC on Base</Text>

      <ScrollView 
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8b5cf6" />
        }
      >
        {/* Balance Cards */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 mb-6">
          <View className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl p-4 mr-3 min-w-[160px]">
            <Text className="text-primary-200 text-sm">Available Balance</Text>
            <Text className="text-white text-2xl font-bold">
              ${stats.usdcBalance.toFixed(2)}
            </Text>
            <Text className="text-primary-300 text-xs">USDC</Text>
          </View>
          <View className="bg-dark-900 rounded-xl p-4 mr-3 min-w-[140px]">
            <Text className="text-gray-400 text-sm">In Bets</Text>
            <Text className="text-yellow-400 text-2xl font-bold">
              ${stats.escrowedBalance.toFixed(2)}
            </Text>
            <Text className="text-gray-500 text-xs">Escrowed</Text>
          </View>
          <View className="bg-dark-900 rounded-xl p-4 mr-3 min-w-[140px]">
            <Text className="text-gray-400 text-sm">Net Profit</Text>
            <Text className={`text-2xl font-bold ${stats.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.netProfit >= 0 ? '+' : ''}${stats.netProfit.toFixed(2)}
            </Text>
          </View>
          <View className="bg-dark-900 rounded-xl p-4 min-w-[140px]">
            <Text className="text-gray-400 text-sm">Win Rate</Text>
            <Text className="text-green-400 text-2xl font-bold">
              {stats.winRate.toFixed(0)}%
            </Text>
            <Text className="text-gray-500 text-xs">{stats.totalBets} bets</Text>
          </View>
        </ScrollView>

        {/* Quick Stats */}
        <View className="px-4 mb-6">
          <View className="bg-dark-900 rounded-xl p-4">
            <Text className="text-white font-bold mb-3">Betting Stats</Text>
            <View className="flex-row flex-wrap">
              <StatItem label="Total Won" value={`$${stats.totalWinnings.toFixed(2)}`} color="text-green-400" />
              <StatItem label="Total Lost" value={`$${stats.totalLosses.toFixed(2)}`} color="text-red-400" />
              <StatItem label="Active Bets" value={String(stats.activeBets)} color="text-yellow-400" />
              <StatItem label="Rank" value={stats.rankTitle} color="text-primary-400" />
            </View>
          </View>
        </View>

        {/* Active Bets */}
        <View className="px-4">
          <Text className="text-white text-xl font-bold mb-3">Active Bets ({activeBets.length})</Text>
          {activeBets.length === 0 ? (
            <View className="bg-dark-900 rounded-xl p-6 items-center mb-6">
              <Text className="text-gray-400 mb-2">No active bets</Text>
              <Pressable
                onPress={() => router.push('/')}
                className="mt-2 bg-primary-500 px-6 py-2 rounded-lg"
              >
                <Text className="text-white font-medium">Browse Markets</Text>
              </Pressable>
            </View>
          ) : (
            activeBets.map((bet) => <BetCard key={bet.id} bet={bet} />)
          )}
        </View>

        {/* Recent Bets */}
        <View className="px-4 mt-4">
          <Text className="text-white text-xl font-bold mb-3">Recent Results</Text>
          {recentBets.length === 0 ? (
            <View className="bg-dark-900 rounded-xl p-6 items-center">
              <Text className="text-gray-400">No completed bets yet</Text>
            </View>
          ) : (
            recentBets.map((bet) => <BetCard key={bet.id} bet={bet} />)
          )}
        </View>

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}

function StatItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View className="w-1/2 py-2">
      <Text className="text-gray-400 text-sm">{label}</Text>
      <Text className={`${color} font-bold text-lg`}>{value}</Text>
    </View>
  );
}

function BetCard({ bet }: { bet: Bet }) {
  const market = bet.market as any;
  const isWon = bet.status === 'WON';
  const isLost = bet.status === 'LOST';
  const isActive = bet.status === 'ACTIVE';

  // Convert cents to dollars
  const amountUSD = (bet.amount / 100).toFixed(2);
  const potentialPayoutUSD = (bet.potential_payout / 100).toFixed(2);
  const actualPayoutUSD = bet.actual_payout ? (bet.actual_payout / 100).toFixed(2) : '0.00';
  const odds = (bet.odds_at_placement / 100).toFixed(0);

  return (
    <View className="bg-dark-900 rounded-xl p-4 mb-3 border border-dark-800">
      <View className="flex-row justify-between items-start mb-2">
        <Text className="text-white font-medium flex-1 mr-2" numberOfLines={2}>
          {market?.title || 'Unknown Market'}
        </Text>
        <View className={`px-2 py-1 rounded ${
          isWon ? 'bg-green-500/20' : 
          isLost ? 'bg-red-500/20' : 
          'bg-yellow-500/20'
        }`}>
          <Text className={`text-xs font-medium ${
            isWon ? 'text-green-400' : 
            isLost ? 'text-red-400' : 
            'text-yellow-400'
          }`}>
            {bet.status}
          </Text>
        </View>
      </View>

      <View className="flex-row justify-between mt-2">
        <View>
          <Text className="text-gray-400 text-sm">Position</Text>
          <Text className={`font-bold ${
            bet.side === 'YES' ? 'text-green-400' : 'text-red-400'
          }`}>
            {bet.side} @ {odds}%
          </Text>
        </View>
        <View>
          <Text className="text-gray-400 text-sm">Stake</Text>
          <Text className="text-white font-bold">${amountUSD}</Text>
        </View>
        <View>
          <Text className="text-gray-400 text-sm">
            {isActive ? 'Potential' : 'Payout'}
          </Text>
          <Text className={`font-bold ${
            isWon ? 'text-green-400' : 
            isLost ? 'text-red-400' : 
            'text-white'
          }`}>
            ${isActive ? potentialPayoutUSD : actualPayoutUSD}
          </Text>
        </View>
      </View>
    </View>
  );
}
