import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useBets, usePortfolioStats, Bet } from '@/hooks/useBets';

export default function PortfolioScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { bets, loading } = useBets({ userId: user?.id });
  const { stats } = usePortfolioStats(user?.id || '');

  if (!user) {
    return (
      <View className="flex-1 bg-dark-950 items-center justify-center px-6">
        <Text className="text-white text-2xl font-bold mb-2">Your Portfolio</Text>
        <Text className="text-gray-400 text-center mb-6">
          Sign in to track your bets and winnings
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

  const activeBets = bets.filter((b) => b.status === 'PENDING');
  const settledBets = bets.filter((b) => b.status !== 'PENDING');

  return (
    <View className="flex-1 bg-dark-950 pt-14">
      <Text className="text-white text-3xl font-bold px-4 mb-4">Portfolio</Text>

      {/* Stats Cards */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 mb-6">
        <View className="bg-dark-900 rounded-xl p-4 mr-3 min-w-[140px]">
          <Text className="text-gray-400 text-sm">Total Value</Text>
          <Text className="text-white text-2xl font-bold">
            ${stats.totalValue.toFixed(2)}
          </Text>
        </View>
        <View className="bg-dark-900 rounded-xl p-4 mr-3 min-w-[140px]">
          <Text className="text-gray-400 text-sm">Winnings</Text>
          <Text className="text-green-400 text-2xl font-bold">
            +${stats.totalWinnings.toFixed(2)}
          </Text>
        </View>
        <View className="bg-dark-900 rounded-xl p-4 mr-3 min-w-[140px]">
          <Text className="text-gray-400 text-sm">Win Rate</Text>
          <Text className="text-primary-500 text-2xl font-bold">
            {stats.winRate.toFixed(0)}%
          </Text>
        </View>
        <View className="bg-dark-900 rounded-xl p-4 min-w-[140px]">
          <Text className="text-gray-400 text-sm">Active Bets</Text>
          <Text className="text-white text-2xl font-bold">
            {stats.activeBets}
          </Text>
        </View>
      </ScrollView>

      <ScrollView className="flex-1 px-4">
        {/* Active Bets */}
        <Text className="text-white text-xl font-bold mb-3">Active Bets</Text>
        {activeBets.length === 0 ? (
          <View className="bg-dark-900 rounded-xl p-6 items-center mb-6">
            <Text className="text-gray-400">No active bets</Text>
            <Pressable
              onPress={() => router.push('/')}
              className="mt-3 bg-primary-500 px-6 py-2 rounded-lg"
            >
              <Text className="text-white font-medium">Browse Markets</Text>
            </Pressable>
          </View>
        ) : (
          activeBets.map((bet) => (
            <BetCard key={bet.id} bet={bet} />
          ))
        )}

        {/* Settled Bets */}
        <Text className="text-white text-xl font-bold mb-3 mt-4">History</Text>
        {settledBets.length === 0 ? (
          <View className="bg-dark-900 rounded-xl p-6 items-center">
            <Text className="text-gray-400">No settled bets yet</Text>
          </View>
        ) : (
          settledBets.map((bet) => (
            <BetCard key={bet.id} bet={bet} />
          ))
        )}

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}

function BetCard({ bet }: { bet: Bet }) {
  const isWon = bet.status === 'WON';
  const isLost = bet.status === 'LOST';
  const isPending = bet.status === 'PENDING';

  return (
    <View className="bg-dark-900 rounded-xl p-4 mb-3 border border-dark-800">
      <View className="flex-row justify-between items-start mb-2">
        <Text className="text-white font-medium flex-1 mr-2">
          {bet.market?.title || 'Unknown Market'}
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
            bet.position === 'YES' ? 'text-green-400' : 'text-red-400'
          }`}>
            {bet.position}
          </Text>
        </View>
        <View>
          <Text className="text-gray-400 text-sm">Stake</Text>
          <Text className="text-white font-bold">${bet.amount}</Text>
        </View>
        <View>
          <Text className="text-gray-400 text-sm">
            {isPending ? 'Potential' : 'Payout'}
          </Text>
          <Text className={`font-bold ${
            isWon ? 'text-green-400' : 
            isLost ? 'text-red-400' : 
            'text-white'
          }`}>
            {isLost ? '-$' + bet.amount : '+$' + bet.potential_payout.toFixed(2)}
          </Text>
        </View>
      </View>
    </View>
  );
}
