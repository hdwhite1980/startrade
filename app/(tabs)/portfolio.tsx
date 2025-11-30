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
  const { bets, loading: betsLoading, refetch: refreshBets } = useBets();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshStats(), refreshBets()]);
    setRefreshing(false);
  }, [refreshStats, refreshBets]);

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0f', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Text style={{ fontSize: 40, marginBottom: 16 }}>💰</Text>
        <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>My Portfolio</Text>
        <Text style={{ color: '#9ca3af', textAlign: 'center', marginBottom: 24 }}>
          Sign in to view your betting history and stats
        </Text>
        <Pressable
          onPress={() => router.push('/auth')}
          style={{ backgroundColor: '#8b5cf6', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12 }}
        >
          <Text style={{ color: 'white', fontWeight: '600', fontSize: 18 }}>Sign In</Text>
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
      <View style={{ flex: 1, backgroundColor: '#0a0a0f', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0f', paddingTop: 56 }}>
      <Text style={{ color: 'white', fontSize: 28, fontWeight: 'bold', paddingHorizontal: 16, marginBottom: 8 }}>Portfolio</Text>
      <Text style={{ color: '#6b7280', fontSize: 14, paddingHorizontal: 16, marginBottom: 16 }}>Real USDC on Base</Text>

      <ScrollView 
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8b5cf6" />
        }
      >
        {/* Balance Cards */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginBottom: 24 }}>
          <View style={{ backgroundColor: '#7c3aed', borderRadius: 12, padding: 16, marginRight: 12, minWidth: 160 }}>
            <Text style={{ color: '#c4b5fd', fontSize: 14 }}>Available Balance</Text>
            <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>
              ${stats.usdcBalance.toFixed(2)}
            </Text>
            <Text style={{ color: '#a78bfa', fontSize: 12 }}>USDC</Text>
          </View>
          <View style={{ backgroundColor: '#1a1a24', borderRadius: 12, padding: 16, marginRight: 12, minWidth: 140 }}>
            <Text style={{ color: '#9ca3af', fontSize: 14 }}>In Bets</Text>
            <Text style={{ color: '#facc15', fontSize: 24, fontWeight: 'bold' }}>
              ${stats.escrowedBalance.toFixed(2)}
            </Text>
            <Text style={{ color: '#6b7280', fontSize: 12 }}>Escrowed</Text>
          </View>
          <View style={{ backgroundColor: '#1a1a24', borderRadius: 12, padding: 16, marginRight: 12, minWidth: 140 }}>
            <Text style={{ color: '#9ca3af', fontSize: 14 }}>Net Profit</Text>
            <Text style={{ color: stats.netProfit >= 0 ? '#22c55e' : '#ef4444', fontSize: 24, fontWeight: 'bold' }}>
              {stats.netProfit >= 0 ? '+' : ''}${stats.netProfit.toFixed(2)}
            </Text>
          </View>
          <View style={{ backgroundColor: '#1a1a24', borderRadius: 12, padding: 16, minWidth: 140 }}>
            <Text style={{ color: '#9ca3af', fontSize: 14 }}>Win Rate</Text>
            <Text style={{ color: '#22c55e', fontSize: 24, fontWeight: 'bold' }}>
              {stats.winRate.toFixed(0)}%
            </Text>
            <Text style={{ color: '#6b7280', fontSize: 12 }}>{stats.totalBets} bets</Text>
          </View>
        </ScrollView>

        {/* Quick Stats */}
        <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
          <View style={{ backgroundColor: '#1a1a24', borderRadius: 12, padding: 16 }}>
            <Text style={{ color: 'white', fontWeight: 'bold', marginBottom: 12 }}>Betting Stats</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <StatItem label="Total Won" value={`$${stats.totalWinnings.toFixed(2)}`} color="#22c55e" />
              <StatItem label="Total Lost" value={`$${stats.totalLosses.toFixed(2)}`} color="#ef4444" />
              <StatItem label="Active Bets" value={String(stats.activeBets)} color="#facc15" />
              <StatItem label="Rank" value={stats.rankTitle} color="#8b5cf6" />
            </View>
          </View>
        </View>

        {/* Active Bets */}
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>Active Bets ({activeBets.length})</Text>
          {activeBets.length === 0 ? (
            <View style={{ backgroundColor: '#1a1a24', borderRadius: 12, padding: 24, alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ color: '#9ca3af', marginBottom: 8 }}>No active bets</Text>
              <Pressable
                onPress={() => router.push('/')}
                style={{ marginTop: 8, backgroundColor: '#8b5cf6', paddingHorizontal: 24, paddingVertical: 8, borderRadius: 8 }}
              >
                <Text style={{ color: 'white', fontWeight: '500' }}>Browse Markets</Text>
              </Pressable>
            </View>
          ) : (
            activeBets.map((bet) => <BetCard key={bet.id} bet={bet} />)
          )}
        </View>

        {/* Recent Bets */}
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>Recent Results</Text>
          {recentBets.length === 0 ? (
            <View style={{ backgroundColor: '#1a1a24', borderRadius: 12, padding: 24, alignItems: 'center' }}>
              <Text style={{ color: '#9ca3af' }}>No completed bets yet</Text>
            </View>
          ) : (
            recentBets.map((bet) => <BetCard key={bet.id} bet={bet} />)
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function StatItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ width: '50%', paddingVertical: 8 }}>
      <Text style={{ color: '#9ca3af', fontSize: 14 }}>{label}</Text>
      <Text style={{ color, fontWeight: 'bold', fontSize: 18 }}>{value}</Text>
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
    <View style={{ backgroundColor: '#1a1a24', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2a2a3a' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <Text style={{ color: 'white', fontWeight: '500', flex: 1, marginRight: 8 }} numberOfLines={2}>
          {market?.title || 'Unknown Market'}
        </Text>
        <View style={{ 
          paddingHorizontal: 8, 
          paddingVertical: 4, 
          borderRadius: 4,
          backgroundColor: isWon ? 'rgba(34, 197, 94, 0.2)' : isLost ? 'rgba(239, 68, 68, 0.2)' : 'rgba(250, 204, 21, 0.2)'
        }}>
          <Text style={{ 
            fontSize: 12, 
            fontWeight: '500',
            color: isWon ? '#22c55e' : isLost ? '#ef4444' : '#facc15'
          }}>
            {bet.status}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        <View>
          <Text style={{ color: '#9ca3af', fontSize: 14 }}>Position</Text>
          <Text style={{ fontWeight: 'bold', color: bet.side === 'YES' ? '#22c55e' : '#ef4444' }}>
            {bet.side} @ {odds}%
          </Text>
        </View>
        <View>
          <Text style={{ color: '#9ca3af', fontSize: 14 }}>Stake</Text>
          <Text style={{ color: 'white', fontWeight: 'bold' }}>${amountUSD}</Text>
        </View>
        <View>
          <Text style={{ color: '#9ca3af', fontSize: 14 }}>
            {isActive ? 'Potential' : 'Payout'}
          </Text>
          <Text style={{ fontWeight: 'bold', color: isWon ? '#22c55e' : isLost ? '#ef4444' : 'white' }}>
            ${isActive ? potentialPayoutUSD : actualPayoutUSD}
          </Text>
        </View>
      </View>
    </View>
  );
}
