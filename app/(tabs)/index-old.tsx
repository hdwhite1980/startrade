// StarTrade - Prediction Markets Screen
// Real USDC Betting on Base (Coinbase L2)
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useMarkets, Market, MarketCategory } from '@/hooks/useMarkets';

// Categories that match the database schema
const CATEGORIES: { label: string; value: MarketCategory | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Music', value: 'MUSIC' },
  { label: 'Film', value: 'FILM' },
  { label: 'Sports', value: 'SPORTS' },
  { label: 'Social', value: 'SOCIAL' },
  { label: 'Awards', value: 'AWARDS' },
  { label: 'Streaming', value: 'STREAMING' },
];

export default function MarketsScreen() {
  const [selectedCategory, setSelectedCategory] = useState<MarketCategory | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const { markets, loading, error, refresh } = useMarkets({
    status: 'ACTIVE',
    category: selectedCategory,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  if (loading && !refreshing) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0f', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={{ color: '#9ca3af', marginTop: 16 }}>Loading markets...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0f', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
        <Text style={{ color: '#f87171', textAlign: 'center' }}>Failed to load markets</Text>
        <Pressable 
          onPress={refresh}
          style={{ marginTop: 16, backgroundColor: '#8b5cf6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
        >
          <Text style={{ color: 'white', fontWeight: '600' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0f', paddingTop: 56 }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
        <Text style={{ color: 'white', fontSize: 28, fontWeight: 'bold' }}>Prediction Markets</Text>
        <Text style={{ color: '#9ca3af', marginTop: 4 }}>Bet with real USDC on Base</Text>
      </View>

      {/* Category Filter */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={{ paddingHorizontal: 16, marginBottom: 16, maxHeight: 44 }}
        contentContainerStyle={{ gap: 8 }}
      >
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat.label}
            onPress={() => setSelectedCategory(cat.value)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: selectedCategory === cat.value ? '#8b5cf6' : '#1f1f2e',
            }}
          >
            <Text style={{
              fontWeight: '500',
              color: selectedCategory === cat.value ? 'white' : '#9ca3af',
            }}>
              {cat.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Markets List */}
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
        {markets.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <Text style={{ color: '#9ca3af', fontSize: 18 }}>No markets found</Text>
            <Text style={{ color: '#6b7280', marginTop: 8, textAlign: 'center' }}>
              Markets are generated from celebrity news
            </Text>
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
        
        {/* Bottom spacing */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

interface MarketCardProps {
  market: Market;
  onPress: () => void;
}

function MarketCard({ market, onPress }: MarketCardProps) {
  const celebrity = market.celebrity as any;
  const yesOdds = market.yes_odds / 100;
  const noOdds = market.no_odds / 100;

  // Format date
  const formatEndDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'TBD';
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return 'Ending soon';
    if (diffDays === 1) return '1 day left';
    if (diffDays <= 7) return `${diffDays} days left`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

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
      {/* Celebrity Info */}
      {celebrity && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <View style={{
            width: 40,
            height: 40,
            backgroundColor: '#2a2a3a',
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
            overflow: 'hidden',
          }}>
            {celebrity.image_url ? (
              <Image 
                source={{ uri: celebrity.image_url }} 
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            ) : (
              <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
                {celebrity.name?.charAt(0) || '?'}
              </Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'white', fontWeight: '600' }}>{celebrity.name}</Text>
            <Text style={{ color: '#6b7280', fontSize: 12 }}>{celebrity.category}</Text>
          </View>
          <View style={{ backgroundColor: 'rgba(139, 92, 246, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
            <Text style={{ color: '#a78bfa', fontSize: 12, fontWeight: '500' }}>
              {formatEndDate((market as any).closes_at)}
            </Text>
          </View>
        </View>
      )}

      {/* Market Title */}
      <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', marginBottom: 12, lineHeight: 22 }}>
        {market.title}
      </Text>

      {/* Odds Display */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderRadius: 8,
          padding: 12,
          alignItems: 'center',
        }}>
          <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>YES</Text>
          <Text style={{ color: '#22c55e', fontSize: 24, fontWeight: 'bold' }}>{yesOdds}%</Text>
          <Text style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>
            ${((100 / yesOdds) - 1).toFixed(2)} to win $1
          </Text>
        </View>
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderRadius: 8,
          padding: 12,
          alignItems: 'center',
        }}>
          <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>NO</Text>
          <Text style={{ color: '#ef4444', fontSize: 24, fontWeight: 'bold' }}>{noOdds}%</Text>
          <Text style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>
            ${((100 / noOdds) - 1).toFixed(2)} to win $1
          </Text>
        </View>
      </View>

      {/* Total Volume */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#2a2a3a' }}>
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Total Volume</Text>
        <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '500' }}>
          ${((market.total_volume || 0) / 100).toFixed(2)} USDC
        </Text>
      </View>
    </Pressable>
  );
}
