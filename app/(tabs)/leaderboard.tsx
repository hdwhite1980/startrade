// StarTrade - Virtual Currency Leaderboard
// Compete for prizes with virtual currency!
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

interface LeaderboardEntry {
  id: string;
  username: string;
  avatar_url?: string;
  total_virtual_value: number;
  virtual_winnings: number;
  virtual_wins: number;
  virtual_total_bets: number;
  virtual_win_rate: number;
  rank: number;
}

export default function LeaderboardScreen() {
  const user = useAuthStore((state) => state.user);
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<'value' | 'winnings' | 'winrate'>('value');

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch from virtual_leaderboard view
      const { data, error } = await supabase
        .from('virtual_leaderboard')
        .select('*')
        .order(
          sortBy === 'value' ? 'total_virtual_value' : 
          sortBy === 'winnings' ? 'virtual_winnings' : 
          'virtual_win_rate', 
          { ascending: false }
        )
        .limit(50);

      if (error) throw error;
      setLeaders((data as LeaderboardEntry[]) || []);

      // Find current user's rank
      if (user && data) {
        const myEntry = data.find((entry: LeaderboardEntry) => entry.id === user.id);
        setMyRank(myEntry || null);
      }
    } catch (e) {
      console.error('Error fetching leaderboard:', e);
    } finally {
      setLoading(false);
    }
  }, [sortBy, user]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLeaderboard();
    setRefreshing(false);
  }, [fetchLeaderboard]);

  if (loading && !refreshing) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0f', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={{ color: '#9ca3af', marginTop: 16 }}>Loading leaderboard...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0f', paddingTop: 56 }}>
      <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
        <Text style={{ color: 'white', fontSize: 28, fontWeight: 'bold' }}>🏆 Leaderboard</Text>
        <Text style={{ color: '#9ca3af', marginTop: 4 }}>Top virtual currency players</Text>
      </View>

      {/* Prize Pool Banner */}
      <View style={{ 
        marginHorizontal: 16, 
        marginBottom: 16, 
        backgroundColor: 'rgba(234, 179, 8, 0.15)', 
        borderRadius: 12, 
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(234, 179, 8, 0.3)',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 24, marginRight: 8 }}>🎁</Text>
          <View>
            <Text style={{ color: '#fcd34d', fontSize: 16, fontWeight: 'bold', textAlign: 'center' }}>
              Monthly Prize Pool
            </Text>
            <Text style={{ color: '#fef3c7', fontSize: 12, textAlign: 'center' }}>
              Top 3 win real prizes at month end!
            </Text>
          </View>
        </View>
      </View>

      {/* My Rank Card (if logged in) */}
      {user && myRank && (
        <View style={{ 
          marginHorizontal: 16, 
          marginBottom: 16, 
          backgroundColor: 'rgba(139, 92, 246, 0.2)', 
          borderRadius: 12, 
          padding: 16,
          borderWidth: 1,
          borderColor: 'rgba(139, 92, 246, 0.4)',
        }}>
          <Text style={{ color: '#a78bfa', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>YOUR RANKING</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ 
                width: 48, 
                height: 48, 
                borderRadius: 24, 
                backgroundColor: '#8b5cf6',
                alignItems: 'center', 
                justifyContent: 'center', 
                marginRight: 12,
              }}>
                <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>#{myRank.rank}</Text>
              </View>
              <View>
                <Text style={{ color: 'white', fontWeight: '600' }}>{myRank.username || 'You'}</Text>
                <Text style={{ color: '#9ca3af', fontSize: 12 }}>{myRank.virtual_wins} wins</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: '#22c55e', fontSize: 20, fontWeight: 'bold' }}>
                ${(myRank.total_virtual_value / 100).toLocaleString()}
              </Text>
              <Text style={{ color: '#6b7280', fontSize: 12 }}>virtual balance</Text>
            </View>
          </View>
        </View>
      )}

      {/* Sort Tabs */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16, gap: 8 }}>
        <Pressable
          onPress={() => setSortBy('value')}
          style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: sortBy === 'value' ? '#8b5cf6' : '#1a1a24' }}
        >
          <Text style={{ textAlign: 'center', fontWeight: '500', color: sortBy === 'value' ? 'white' : '#9ca3af', fontSize: 13 }}>
            💰 Balance
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSortBy('winnings')}
          style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: sortBy === 'winnings' ? '#8b5cf6' : '#1a1a24' }}
        >
          <Text style={{ textAlign: 'center', fontWeight: '500', color: sortBy === 'winnings' ? 'white' : '#9ca3af', fontSize: 13 }}>
            📈 Profit
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSortBy('winrate')}
          style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: sortBy === 'winrate' ? '#8b5cf6' : '#1a1a24' }}
        >
          <Text style={{ textAlign: 'center', fontWeight: '500', color: sortBy === 'winrate' ? 'white' : '#9ca3af', fontSize: 13 }}>
            🎯 Win Rate
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1, paddingHorizontal: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8b5cf6"
          />
        }
      >
        {leaders.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🎮</Text>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>No players yet</Text>
            <Text style={{ color: '#6b7280', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
              Place virtual bets to climb the leaderboard!
            </Text>
          </View>
        ) : (
          leaders.map((leader, index) => (
            <LeaderCard 
              key={leader.id} 
              leader={leader} 
              rank={index + 1} 
              sortBy={sortBy}
              isCurrentUser={user?.id === leader.id}
            />
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

interface LeaderCardProps {
  leader: LeaderboardEntry;
  rank: number;
  sortBy: 'value' | 'winnings' | 'winrate';
  isCurrentUser: boolean;
}

function LeaderCard({ leader, rank, sortBy, isCurrentUser }: LeaderCardProps) {
  const isTop3 = rank <= 3;
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';

  // Tier based on balance
  const getTier = () => {
    const balance = leader.total_virtual_value / 100;
    if (balance >= 5000) return { name: 'Diamond', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.2)' };
    if (balance >= 2500) return { name: 'Platinum', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.2)' };
    if (balance >= 1500) return { name: 'Gold', color: '#fcd34d', bg: 'rgba(252, 211, 77, 0.2)' };
    if (balance >= 1000) return { name: 'Silver', color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.2)' };
    return { name: 'Bronze', color: '#d97706', bg: 'rgba(217, 119, 6, 0.2)' };
  };

  const tier = getTier();

  return (
    <View style={{ 
      backgroundColor: isCurrentUser ? 'rgba(139, 92, 246, 0.15)' : '#1a1a24', 
      borderRadius: 12, 
      padding: 16, 
      marginBottom: 12, 
      borderWidth: 1, 
      borderColor: isCurrentUser ? 'rgba(139, 92, 246, 0.5)' : isTop3 ? 'rgba(234, 179, 8, 0.3)' : '#2a2a3a' 
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Rank */}
        <View style={{ 
          width: 44, 
          height: 44, 
          borderRadius: 22, 
          alignItems: 'center', 
          justifyContent: 'center', 
          marginRight: 12, 
          backgroundColor: isTop3 ? 'rgba(234, 179, 8, 0.2)' : '#2a2a3a' 
        }}>
          {medal ? (
            <Text style={{ fontSize: 22 }}>{medal}</Text>
          ) : (
            <Text style={{ color: '#9ca3af', fontWeight: 'bold', fontSize: 16 }}>{rank}</Text>
          )}
        </View>

        {/* User Info */}
        <View style={{ flex: 1 }}>
          <Text style={{ color: 'white', fontWeight: '600', fontSize: 15 }}>
            {leader.username || 'Anonymous'}
            {isCurrentUser && <Text style={{ color: '#a78bfa' }}> (You)</Text>}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, backgroundColor: tier.bg }}>
              <Text style={{ fontSize: 11, color: tier.color, fontWeight: '600' }}>
                {tier.name}
              </Text>
            </View>
            <Text style={{ color: '#6b7280', fontSize: 12 }}>
              {leader.virtual_wins}W / {leader.virtual_total_bets - leader.virtual_wins}L
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={{ alignItems: 'flex-end' }}>
          {sortBy === 'value' && (
            <>
              <Text style={{ color: '#22c55e', fontSize: 18, fontWeight: 'bold' }}>
                ${(leader.total_virtual_value / 100).toLocaleString()}
              </Text>
              <Text style={{ color: '#6b7280', fontSize: 11 }}>balance</Text>
            </>
          )}
          {sortBy === 'winnings' && (
            <>
              <Text style={{ 
                color: leader.virtual_winnings >= 0 ? '#22c55e' : '#ef4444', 
                fontSize: 18, 
                fontWeight: 'bold' 
              }}>
                {leader.virtual_winnings >= 0 ? '+' : ''}${(leader.virtual_winnings / 100).toLocaleString()}
              </Text>
              <Text style={{ color: '#6b7280', fontSize: 11 }}>profit</Text>
            </>
          )}
          {sortBy === 'winrate' && (
            <>
              <Text style={{ color: '#22c55e', fontSize: 18, fontWeight: 'bold' }}>
                {leader.virtual_win_rate?.toFixed(0) || 0}%
              </Text>
              <Text style={{ color: '#6b7280', fontSize: 11 }}>win rate</Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
}
