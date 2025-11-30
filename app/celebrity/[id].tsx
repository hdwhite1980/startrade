// StarTrade - Celebrity Markets Screen
// Shows all markets for a specific celebrity
import { View, Text, ScrollView, Pressable, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useState, useCallback } from 'react';
import { useCelebrity, useMarkets, Market } from '@/hooks/useMarkets';

export default function CelebrityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  
  const { celebrity, loading: celebLoading, refetch: refetchCeleb } = useCelebrity(id || '');
  const { markets, loading: marketsLoading, refresh: refreshMarkets } = useMarkets({
    celebrityId: id,
    status: 'ACTIVE',
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchCeleb(), refreshMarkets()]);
    setRefreshing(false);
  }, [refetchCeleb, refreshMarkets]);

  const loading = celebLoading || marketsLoading;

  if (loading && !refreshing) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0f', alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen options={{ title: 'Loading...', headerShown: true, headerStyle: { backgroundColor: '#0a0a0f' }, headerTintColor: 'white' }} />
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  if (!celebrity) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0f', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Stack.Screen options={{ title: 'Not Found', headerShown: true, headerStyle: { backgroundColor: '#0a0a0f' }, headerTintColor: 'white' }} />
        <Text style={{ color: '#f87171', textAlign: 'center' }}>Celebrity not found</Text>
        <Pressable 
          onPress={() => router.back()}
          style={{ marginTop: 16, backgroundColor: '#8b5cf6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
        >
          <Text style={{ color: 'white', fontWeight: '600' }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const metrics = celebrity.metrics || {};

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0f' }}>
      <Stack.Screen 
        options={{ 
          title: celebrity.name,
          headerShown: true,
          headerStyle: { backgroundColor: '#0a0a0f' },
          headerTintColor: 'white',
        }} 
      />

      <ScrollView 
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8b5cf6" />
        }
      >
        {/* Celebrity Header */}
        <View style={{ alignItems: 'center', padding: 24 }}>
          <View style={{
            width: 100,
            height: 100,
            backgroundColor: '#2a2a3a',
            borderRadius: 50,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            overflow: 'hidden',
          }}>
            {celebrity.image_url ? (
              <Image 
                source={{ uri: celebrity.image_url }} 
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            ) : (
              <Text style={{ color: 'white', fontSize: 40, fontWeight: 'bold' }}>
                {celebrity.name.charAt(0)}
              </Text>
            )}
          </View>
          <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>{celebrity.name}</Text>
          <View style={{ backgroundColor: 'rgba(139, 92, 246, 0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 8 }}>
            <Text style={{ color: '#a78bfa', fontWeight: '500' }}>{celebrity.category}</Text>
          </View>
        </View>

        {/* Metrics */}
        {Object.keys(metrics).length > 0 && (
          <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
            <Text style={{ color: '#9ca3af', fontSize: 14, marginBottom: 12 }}>Stats</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {metrics.instagram_followers && (
                <View style={{ backgroundColor: '#1a1a24', borderRadius: 12, padding: 12, minWidth: '45%', flex: 1 }}>
                  <Text style={{ color: '#6b7280', fontSize: 12 }}>Instagram</Text>
                  <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
                    {formatNumber(metrics.instagram_followers)}
                  </Text>
                </View>
              )}
              {metrics.spotify_streams && (
                <View style={{ backgroundColor: '#1a1a24', borderRadius: 12, padding: 12, minWidth: '45%', flex: 1 }}>
                  <Text style={{ color: '#6b7280', fontSize: 12 }}>Spotify Streams</Text>
                  <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
                    {formatNumber(metrics.spotify_streams)}
                  </Text>
                </View>
              )}
              {metrics.trend_score && (
                <View style={{ backgroundColor: '#1a1a24', borderRadius: 12, padding: 12, minWidth: '45%', flex: 1 }}>
                  <Text style={{ color: '#6b7280', fontSize: 12 }}>Trend Score</Text>
                  <Text style={{ color: metrics.trend_score >= 70 ? '#22c55e' : '#facc15', fontSize: 18, fontWeight: 'bold' }}>
                    {metrics.trend_score}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Markets Section */}
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>
            Active Markets ({markets.length})
          </Text>
          
          {markets.length === 0 ? (
            <View style={{ backgroundColor: '#1a1a24', borderRadius: 12, padding: 24, alignItems: 'center' }}>
              <Text style={{ color: '#9ca3af' }}>No active markets</Text>
            </View>
          ) : (
            markets.map((market) => (
              <MarketCard 
                key={market.id} 
                market={market} 
                onPress={() => router.push(`/market/${market.id}` as any)}
              />
            ))
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function MarketCard({ market, onPress }: { market: Market; onPress: () => void }) {
  const yesOdds = market.yes_odds / 100;
  const noOdds = market.no_odds / 100;

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: '#1a1a24',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#2a2a3a',
      }}
    >
      <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
        {market.title}
      </Text>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: 8, padding: 8, alignItems: 'center' }}>
          <Text style={{ color: '#22c55e', fontSize: 18, fontWeight: 'bold' }}>{yesOdds}%</Text>
          <Text style={{ color: '#6b7280', fontSize: 11 }}>YES</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 8, padding: 8, alignItems: 'center' }}>
          <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: 'bold' }}>{noOdds}%</Text>
          <Text style={{ color: '#6b7280', fontSize: 11 }}>NO</Text>
        </View>
      </View>
    </Pressable>
  );
}
