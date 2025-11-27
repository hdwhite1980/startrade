import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface LeaderboardUser {
  id: string;
  username: string;
  avatar_url?: string;
  total_winnings: number;
  win_rate: number;
  total_bets: number;
}

export default function LeaderboardScreen() {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'all' | 'week' | 'month'>('all');

  useEffect(() => {
    fetchLeaderboard();
  }, [timeframe]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    
    // This would typically be a database function or view
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('total_winnings', { ascending: false })
      .limit(50);

    if (!error && data) {
      setUsers(data as LeaderboardUser[]);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-dark-950 items-center justify-center">
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-dark-950 pt-14">
      <Text className="text-white text-3xl font-bold px-4 mb-2">Rankings</Text>
      <Text className="text-gray-400 px-4 mb-6">Top performers this week</Text>

      {/* Timeframe Filter */}
      <View className="flex-row px-4 mb-6 gap-2">
        {(['all', 'month', 'week'] as const).map((tf) => (
          <View
            key={tf}
            className={`px-4 py-2 rounded-full ${
              timeframe === tf ? 'bg-primary-500' : 'bg-dark-800'
            }`}
          >
            <Text
              className={`font-medium capitalize ${
                timeframe === tf ? 'text-white' : 'text-gray-400'
              }`}
              onPress={() => setTimeframe(tf)}
            >
              {tf === 'all' ? 'All Time' : tf}
            </Text>
          </View>
        ))}
      </View>

      {/* Top 3 Podium */}
      {users.length >= 3 && (
        <View className="flex-row justify-center items-end px-4 mb-8">
          {/* 2nd Place */}
          <View className="items-center mx-2">
            <View className="w-16 h-16 rounded-full bg-dark-800 items-center justify-center mb-2">
              <Text className="text-2xl">🥈</Text>
            </View>
            <Text className="text-gray-300 font-medium" numberOfLines={1}>
              {users[1]?.username || 'User'}
            </Text>
            <Text className="text-gray-500 text-sm">
              ${users[1]?.total_winnings?.toLocaleString() || '0'}
            </Text>
          </View>

          {/* 1st Place */}
          <View className="items-center mx-2 -mt-4">
            <View className="w-20 h-20 rounded-full bg-yellow-500/20 items-center justify-center mb-2 border-2 border-yellow-500">
              <Text className="text-3xl">🥇</Text>
            </View>
            <Text className="text-white font-bold text-lg" numberOfLines={1}>
              {users[0]?.username || 'User'}
            </Text>
            <Text className="text-yellow-500 font-medium">
              ${users[0]?.total_winnings?.toLocaleString() || '0'}
            </Text>
          </View>

          {/* 3rd Place */}
          <View className="items-center mx-2">
            <View className="w-16 h-16 rounded-full bg-dark-800 items-center justify-center mb-2">
              <Text className="text-2xl">🥉</Text>
            </View>
            <Text className="text-gray-300 font-medium" numberOfLines={1}>
              {users[2]?.username || 'User'}
            </Text>
            <Text className="text-gray-500 text-sm">
              ${users[2]?.total_winnings?.toLocaleString() || '0'}
            </Text>
          </View>
        </View>
      )}

      {/* Rest of Leaderboard */}
      <ScrollView className="flex-1 px-4">
        {users.slice(3).map((user, index) => (
          <View
            key={user.id}
            className="flex-row items-center bg-dark-900 rounded-xl p-4 mb-2"
          >
            <Text className="text-gray-500 font-bold w-8">{index + 4}</Text>
            <View className="w-10 h-10 rounded-full bg-dark-800 items-center justify-center mr-3">
              <Text className="text-lg">👤</Text>
            </View>
            <View className="flex-1">
              <Text className="text-white font-medium">{user.username}</Text>
              <Text className="text-gray-500 text-sm">
                {user.total_bets} bets • {user.win_rate}% win rate
              </Text>
            </View>
            <Text className="text-green-400 font-bold">
              ${user.total_winnings.toLocaleString()}
            </Text>
          </View>
        ))}

        {users.length === 0 && (
          <View className="items-center py-12">
            <Text className="text-gray-400">No rankings yet</Text>
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
