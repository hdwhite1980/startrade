// StarTrade - 3 Curated Markets Home Screen
// Weekly / Mid-Term / Yearly prediction markets
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, Dimensions } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Market {
  id: string;
  title: string;
  description: string;
  category: string;
  tier: 'WEEKLY' | 'MIDTERM' | 'YEARLY';
  status: string;
  yes_odds: number;
  no_odds: number;
  yes_pool: number;
  no_pool: number;
  total_volume: number;
  total_bets: number;
  closes_at: string;
  resolves_at: string;
  details_json: {
    summary: string;
    key_dates: Array<{ date: string; event: string }>;
    sources: Array<{ name: string; url: string; excerpt: string }>;
    latest_updates: Array<{ date: string; update: string; source: string }>;
    resolution_criteria: string;
  };
  celebrity?: {
    name: string;
    image_url: string;
    category: string;
  };
}

const TIER_CONFIG: Record<string, { label: string; color: string; gradient: [string, string]; description: string }> = {
  WEEKLY: {
    label: '🔥 This Week',
    color: '#ef4444',
    gradient: ['#ef4444', '#dc2626'],
    description: 'Resolves in ~7 days',
  },
  MIDTERM: {
    label: '📊 Mid-Term',
    color: '#8b5cf6',
    gradient: ['#8b5cf6', '#7c3aed'],
    description: 'Resolves in 2-3 months',
  },
  YEARLY: {
    label: '🎯 The Big One',
    color: '#f59e0b',
    gradient: ['#f59e0b', '#d97706'],
    description: 'Resolves in ~1 year',
  },
};

export default function HomeScreen() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);

  const fetchMarkets = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('markets')
        .select('*, celebrity:celebrities(*)')
        .eq('status', 'ACTIVE')
        .not('tier', 'is', null)
        .order('tier');

      if (fetchError) throw fetchError;
      setMarkets(data || []);
      setError(null);
    } catch (e) {
      console.error('Error fetching markets:', e);
      setError('Failed to load markets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarkets();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMarkets();
    setRefreshing(false);
  }, []);

  // Get market by tier
  const getMarketByTier = (tier: 'WEEKLY' | 'MIDTERM' | 'YEARLY') => {
    return markets.find(m => m.tier === tier);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0f', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={{ color: '#9ca3af', marginTop: 16 }}>Loading markets...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: '#0a0a0f' }}
      contentContainerStyle={{ paddingTop: 60, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8b5cf6" />
      }
    >
      {/* Header */}
      <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
        <Text style={{ color: 'white', fontSize: 32, fontWeight: 'bold' }}>StarTrade</Text>
        <Text style={{ color: '#9ca3af', marginTop: 4, fontSize: 16 }}>
          3 Questions. Real Stakes. Pick Your Side.
        </Text>
      </View>

      {/* Currency Toggle */}
      <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
        <View style={{ 
          flexDirection: 'row', 
          backgroundColor: '#1a1a24', 
          borderRadius: 12, 
          padding: 4,
        }}>
          <Pressable 
            style={{ 
              flex: 1, 
              paddingVertical: 12, 
              borderRadius: 10,
              backgroundColor: profile?.preferred_currency === 'VIRTUAL' ? '#8b5cf6' : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text style={{ 
              color: profile?.preferred_currency === 'VIRTUAL' ? 'white' : '#9ca3af', 
              fontWeight: '600' 
            }}>
              🎮 Virtual (${((profile?.virtual_balance || 100000) / 100).toFixed(0)})
            </Text>
          </Pressable>
          <Pressable 
            style={{ 
              flex: 1, 
              paddingVertical: 12, 
              borderRadius: 10,
              backgroundColor: profile?.preferred_currency === 'REAL' ? '#22c55e' : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text style={{ 
              color: profile?.preferred_currency === 'REAL' ? 'white' : '#9ca3af', 
              fontWeight: '600' 
            }}>
              💵 Real USDC (${((profile?.usdc_balance || 0) / 100).toFixed(2)})
            </Text>
          </Pressable>
        </View>
      </View>

      {/* The 3 Markets */}
      {(['WEEKLY', 'MIDTERM', 'YEARLY'] as const).map((tier, index) => {
        const market = getMarketByTier(tier);
        const config = TIER_CONFIG[tier];

        return (
          <View key={tier} style={{ paddingHorizontal: 20, marginBottom: 24 }}>
            {/* Tier Label */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: config.color, fontSize: 18, fontWeight: 'bold' }}>
                {config.label}
              </Text>
              <Text style={{ color: '#6b7280', marginLeft: 8, fontSize: 12 }}>
                {config.description}
              </Text>
            </View>

            {market ? (
              <TierMarketCard market={market} config={config} onPress={() => router.push(`/market/${market.id}` as any)} />
            ) : (
              <View style={{ 
                backgroundColor: '#1a1a24', 
                borderRadius: 16, 
                padding: 24, 
                alignItems: 'center',
                borderWidth: 2,
                borderColor: '#2a2a3a',
                borderStyle: 'dashed',
              }}>
                <Text style={{ color: '#6b7280', fontSize: 16 }}>Coming Soon</Text>
                <Text style={{ color: '#4b5563', fontSize: 14, marginTop: 4 }}>
                  A new {tier.toLowerCase()} question will be posted shortly
                </Text>
              </View>
            )}
          </View>
        );
      })}

      {/* Prize Pool Info */}
      <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
        <Pressable
          onPress={() => router.push('/leaderboard' as any)}
          style={{
            backgroundColor: '#1a1a24',
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: '#2a2a3a',
          }}
        >
          <Text style={{ color: '#f59e0b', fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>
            🏆 Virtual Leaderboard Prizes
          </Text>
          <Text style={{ color: '#9ca3af', fontSize: 14, lineHeight: 20 }}>
            Top 3 virtual players each week win bonuses. Monthly champions win real USDC!
          </Text>
          <Text style={{ color: '#8b5cf6', marginTop: 12, fontWeight: '600' }}>
            View Leaderboard →
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

interface TierMarketCardProps {
  market: Market;
  config: { label: string; color: string; gradient: [string, string]; description: string };
  onPress: () => void;
}

function TierMarketCard({ market, config, onPress }: TierMarketCardProps) {
  const yesOdds = market.yes_odds / 100;
  const noOdds = market.no_odds / 100;

  // Calculate time remaining
  const getTimeRemaining = () => {
    const closes = new Date(market.closes_at);
    const now = new Date();
    const diff = closes.getTime() - now.getTime();
    
    if (diff <= 0) return 'Closing soon';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 30) {
      const months = Math.floor(days / 30);
      return `${months} month${months > 1 ? 's' : ''} left`;
    }
    if (days > 0) return `${days}d ${hours}h left`;
    return `${hours}h left`;
  };

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: '#1a1a24',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: config.color + '40',
      }}
    >
      {/* Gradient Header */}
      <LinearGradient
        colors={config.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ padding: 16 }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: 'white', fontSize: 12, fontWeight: '600', opacity: 0.9 }}>
            {market.category}
          </Text>
          <View style={{ 
            backgroundColor: 'rgba(255,255,255,0.2)', 
            paddingHorizontal: 10, 
            paddingVertical: 4, 
            borderRadius: 12 
          }}>
            <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>
              ⏱️ {getTimeRemaining()}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Content */}
      <View style={{ padding: 16 }}>
        {/* Question */}
        <Text style={{ 
          color: 'white', 
          fontSize: 20, 
          fontWeight: 'bold', 
          marginBottom: 12,
          lineHeight: 26,
        }}>
          {market.title}
        </Text>

        {/* Latest Update Preview */}
        {market.details_json?.latest_updates?.[0] && (
          <View style={{ 
            backgroundColor: '#0f0f14', 
            borderRadius: 8, 
            padding: 12, 
            marginBottom: 16,
            borderLeftWidth: 3,
            borderLeftColor: config.color,
          }}>
            <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>
              📰 Latest: {market.details_json.latest_updates[0].source}
            </Text>
            <Text style={{ color: '#d1d5db', fontSize: 14 }} numberOfLines={2}>
              {market.details_json.latest_updates[0].update}
            </Text>
          </View>
        )}

        {/* Odds */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderRadius: 12,
            padding: 16,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: 'rgba(34, 197, 94, 0.3)',
          }}>
            <Text style={{ color: '#6b7280', fontSize: 14, marginBottom: 4 }}>YES</Text>
            <Text style={{ color: '#22c55e', fontSize: 32, fontWeight: 'bold' }}>{yesOdds}%</Text>
            <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
              ${(market.yes_pool / 100).toFixed(0)} pool
            </Text>
          </View>
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderRadius: 12,
            padding: 16,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: 'rgba(239, 68, 68, 0.3)',
          }}>
            <Text style={{ color: '#6b7280', fontSize: 14, marginBottom: 4 }}>NO</Text>
            <Text style={{ color: '#ef4444', fontSize: 32, fontWeight: 'bold' }}>{noOdds}%</Text>
            <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
              ${(market.no_pool / 100).toFixed(0)} pool
            </Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={{ 
          flexDirection: 'row', 
          justifyContent: 'space-between', 
          borderTopWidth: 1, 
          borderTopColor: '#2a2a3a',
          paddingTop: 12,
        }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: '#6b7280', fontSize: 11 }}>TOTAL BETS</Text>
            <Text style={{ color: 'white', fontWeight: '600' }}>{market.total_bets}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: '#6b7280', fontSize: 11 }}>VOLUME</Text>
            <Text style={{ color: 'white', fontWeight: '600' }}>${(market.total_volume / 100).toFixed(0)}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: config.color, fontSize: 14, fontWeight: '600' }}>
              View Details →
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
