// StarTrade - Fan Leaderboard Screen
// FOR ENTERTAINMENT PURPOSES ONLY
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { FanProfile } from '@/types/database';

export default function LeaderboardScreen() {
  const [leaders, setLeaders] = useState<FanProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<'accuracy' | 'tokens' | 'predictions'>('accuracy');

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from('fan_profiles').select('*').limit(50);

      if (sortBy === 'accuracy') {
        query = query.order('prediction_accuracy', { ascending: false });
      } else if (sortBy === 'tokens') {
        query = query.order('lifetime_tokens_earned', { ascending: false });
      } else {
        query = query.order('correct_predictions', { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      setLeaders((data as FanProfile[]) || []);
    } catch (e) {
      console.error('Error fetching leaderboard:', e);
    } finally {
      setLoading(false);
    }
  }, [sortBy]);

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
      <View className="flex-1 bg-dark-950 items-center justify-center">
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text className="text-gray-400 mt-4">Loading leaderboard...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-dark-950 pt-14">
      <View className="px-4 mb-4">
        <Text className="text-white text-3xl font-bold">Fan Leaderboard</Text>
        <Text className="text-gray-400 mt-1">Top prediction masters</Text>
      </View>

      {/* Entertainment Disclaimer */}
      <View className="mx-4 mb-3 bg-primary-500/10 rounded-lg px-3 py-2">
        <Text className="text-primary-400 text-xs text-center">
          For entertainment only. Rankings based on prediction accuracy.
        </Text>
      </View>

      {/* Sort Tabs */}
      <View className="flex-row px-4 mb-4 gap-2">
        <Pressable
          onPress={() => setSortBy('accuracy')}
          className={`flex-1 py-2 rounded-lg ${
            sortBy === 'accuracy' ? 'bg-primary-500' : 'bg-dark-800'
          }`}
        >
          <Text className={`text-center font-medium ${
            sortBy === 'accuracy' ? 'text-white' : 'text-gray-400'
          }`}>
            Accuracy
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSortBy('tokens')}
          className={`flex-1 py-2 rounded-lg ${
            sortBy === 'tokens' ? 'bg-primary-500' : 'bg-dark-800'
          }`}
        >
          <Text className={`text-center font-medium ${
            sortBy === 'tokens' ? 'text-white' : 'text-gray-400'
          }`}>
            Tokens
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSortBy('predictions')}
          className={`flex-1 py-2 rounded-lg ${
            sortBy === 'predictions' ? 'bg-primary-500' : 'bg-dark-800'
          }`}
        >
          <Text className={`text-center font-medium ${
            sortBy === 'predictions' ? 'text-white' : 'text-gray-400'
          }`}>
            Wins
          </Text>
        </Pressable>
      </View>

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
        {leaders.length === 0 ? (
          <View className="items-center py-12">
            <Text className="text-gray-400 text-lg">No fans yet</Text>
            <Text className="text-gray-500 text-sm mt-2">Be the first!</Text>
          </View>
        ) : (
          leaders.map((leader, index) => (
            <LeaderCard key={leader.id} leader={leader} rank={index + 1} sortBy={sortBy} />
          ))
        )}
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}

interface LeaderCardProps {
  leader: FanProfile;
  rank: number;
  sortBy: 'accuracy' | 'tokens' | 'predictions';
}

function LeaderCard({ leader, rank, sortBy }: LeaderCardProps) {
  const isTop3 = rank <= 3;
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';

  return (
    <View className={`bg-dark-900 rounded-xl p-4 mb-3 border ${
      isTop3 ? 'border-primary-500/50' : 'border-dark-800'
    }`}>
      <View className="flex-row items-center">
        {/* Rank */}
        <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
          isTop3 ? 'bg-primary-500/20' : 'bg-dark-800'
        }`}>
          {medal ? (
            <Text className="text-xl">{medal}</Text>
          ) : (
            <Text className="text-gray-400 font-bold">{rank}</Text>
          )}
        </View>

        {/* User Info */}
        <View className="flex-1">
          <Text className="text-white font-semibold">{leader.username}</Text>
          <View className="flex-row items-center mt-1">
            <View className={`px-2 py-0.5 rounded ${
              leader.rank_title === 'Legend' ? 'bg-yellow-500/20' :
              leader.rank_title === 'Celebrity Expert' ? 'bg-purple-500/20' :
              leader.rank_title === 'Super Fan' ? 'bg-blue-500/20' :
              'bg-gray-500/20'
            }`}>
              <Text className={`text-xs ${
                leader.rank_title === 'Legend' ? 'text-yellow-400' :
                leader.rank_title === 'Celebrity Expert' ? 'text-purple-400' :
                leader.rank_title === 'Super Fan' ? 'text-blue-400' :
                'text-gray-400'
              }`}>
                {leader.rank_title}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View className="items-end">
          {sortBy === 'accuracy' && (
            <>
              <Text className="text-green-400 text-xl font-bold">
                {leader.prediction_accuracy?.toFixed(0) || 0}%
              </Text>
              <Text className="text-gray-500 text-xs">accuracy</Text>
            </>
          )}
          {sortBy === 'tokens' && (
            <>
              <Text className="text-primary-400 text-xl font-bold">
                🎫 {leader.lifetime_tokens_earned?.toLocaleString() || 0}
              </Text>
              <Text className="text-gray-500 text-xs">lifetime</Text>
            </>
          )}
          {sortBy === 'predictions' && (
            <>
              <Text className="text-white text-xl font-bold">
                {leader.correct_predictions || 0}
              </Text>
              <Text className="text-gray-500 text-xs">correct</Text>
            </>
          )}
        </View>
      </View>

      {/* Additional Stats */}
      <View className="flex-row justify-between mt-3 pt-3 border-t border-dark-800">
        <Text className="text-gray-500 text-xs">
          {leader.total_predictions || 0} predictions
        </Text>
        <Text className="text-gray-500 text-xs">
          {leader.correct_predictions || 0}/{leader.total_predictions || 0} correct
        </Text>
      </View>
    </View>
  );
}
