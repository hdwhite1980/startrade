// StarTrade - Market Detail Screen
// Real USDC Betting on Base
import { View, Text, ScrollView, Pressable, ActivityIndicator, Image, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

// Type definitions
interface Celebrity {
  id: string;
  name: string;
  category?: string;
  image_url?: string;
}

interface Market {
  id: string;
  title: string;
  description?: string;
  status: string;
  yes_odds: number;
  no_odds: number;
  total_volume?: number;
  closes_at?: string;
  celebrity?: Celebrity;
}

export default function MarketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  
  // State for market data
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch market data when id changes
  useEffect(() => {
    const marketId = id || '';
    
    // Skip if no ID
    if (!marketId) {
      setLoading(false);
      return;
    }

    // Reset state and fetch
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchMarket = async () => {
      console.log('[MarketDetail] Fetching market:', marketId);
      try {
        const { data, error: fetchError } = await supabase
          .from('markets')
          .select('*, celebrity:celebrities(*)')
          .eq('id', marketId)
          .single();

        if (cancelled) return;
        if (fetchError) throw fetchError;
        
        console.log('[MarketDetail] Got market:', data?.title);
        setMarket(data as Market);
      } catch (err) {
        if (cancelled) return;
        console.log('[MarketDetail] Error:', err);
        setError(err as Error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchMarket();
    
    // Cleanup - prevent state updates if component unmounts
    return () => {
      cancelled = true;
    };
  }, [id]);
  
  const [selectedSide, setSelectedSide] = useState<'YES' | 'NO'>('YES');
  const [betAmount, setBetAmount] = useState('');
  const [placing, setPlacing] = useState(false);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0f', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={{ color: '#9ca3af', marginTop: 16 }}>Loading market...</Text>
      </View>
    );
  }

  if (error || !market) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0f', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Text style={{ color: '#f87171', textAlign: 'center', marginBottom: 8 }}>Market not found</Text>
        <Text style={{ color: '#6b7280', textAlign: 'center', fontSize: 12 }}>ID: {id || 'none'}</Text>
        {error && <Text style={{ color: '#6b7280', textAlign: 'center', fontSize: 12, marginTop: 8 }}>{error.message}</Text>}
        <Pressable 
          onPress={() => router.back()}
          style={{ marginTop: 16, backgroundColor: '#8b5cf6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
        >
          <Text style={{ color: 'white', fontWeight: '600' }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const celebrity = market.celebrity;
  const yesOdds = market.yes_odds / 100;
  const noOdds = market.no_odds / 100;
  const currentOdds = selectedSide === 'YES' ? yesOdds : noOdds;
  const betAmountNum = parseFloat(betAmount) || 0;
  const potentialWin = betAmountNum > 0 ? betAmountNum * (100 / currentOdds) : 0;

  const handlePlaceBet = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to place a bet.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/auth') },
      ]);
      return;
    }

    if (betAmountNum <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid bet amount.');
      return;
    }

    setPlacing(true);
    try {
      // TODO: Integrate with useBets hook
      Alert.alert('Success', 'Placed ' + betAmountNum.toFixed(2) + ' on ' + selectedSide + '!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to place bet');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0f' }}>
      {/* Header with back button */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16, backgroundColor: '#0a0a0f' }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 16 }}>
          <Text style={{ color: 'white', fontSize: 24 }}>←</Text>
        </Pressable>
        <Text style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>{celebrity?.name || 'Market'}</Text>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* Celebrity Header */}
        {celebrity && (
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#2a2a3a' }}>
            <View style={{
              width: 60,
              height: 60,
              backgroundColor: '#2a2a3a',
              borderRadius: 30,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 16,
              overflow: 'hidden',
            }}>
              {celebrity.image_url ? (
                <Image 
                  source={{ uri: celebrity.image_url }} 
                  style={{ width: 60, height: 60 }}
                  resizeMode="cover"
                />
              ) : (
                <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>
                  {celebrity.name?.charAt(0) || '?'}
                </Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>{celebrity.name}</Text>
              <Text style={{ color: '#6b7280', marginTop: 2 }}>{celebrity.category}</Text>
            </View>
          </View>
        )}

        {/* Market Question */}
        <View style={{ padding: 16 }}>
          <Text style={{ color: 'white', fontSize: 22, fontWeight: 'bold', lineHeight: 30 }}>
            {market.title}
          </Text>
          {market.description && (
            <Text style={{ color: '#9ca3af', marginTop: 8, lineHeight: 22 }}>
              {market.description}
            </Text>
          )}
        </View>

        {/* Current Odds */}
        <View style={{ flexDirection: 'row', padding: 16, gap: 12 }}>
          <Pressable
            onPress={() => setSelectedSide('YES')}
            style={{
              flex: 1,
              backgroundColor: selectedSide === 'YES' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.05)',
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              borderWidth: 2,
              borderColor: selectedSide === 'YES' ? '#22c55e' : 'transparent',
            }}
          >
            <Text style={{ color: '#9ca3af', fontSize: 14 }}>YES</Text>
            <Text style={{ color: '#22c55e', fontSize: 32, fontWeight: 'bold' }}>{yesOdds}%</Text>
          </Pressable>
          <Pressable
            onPress={() => setSelectedSide('NO')}
            style={{
              flex: 1,
              backgroundColor: selectedSide === 'NO' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.05)',
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              borderWidth: 2,
              borderColor: selectedSide === 'NO' ? '#ef4444' : 'transparent',
            }}
          >
            <Text style={{ color: '#9ca3af', fontSize: 14 }}>NO</Text>
            <Text style={{ color: '#ef4444', fontSize: 32, fontWeight: 'bold' }}>{noOdds}%</Text>
          </Pressable>
        </View>

        {/* Bet Input */}
        <View style={{ padding: 16 }}>
          <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
            Bet on {selectedSide}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a24', borderRadius: 12, padding: 12 }}>
            <Text style={{ color: '#9ca3af', fontSize: 20, marginRight: 4 }}>$</Text>
            <TextInput
              style={{ flex: 1, color: 'white', fontSize: 20, fontWeight: '600' }}
              placeholder="0.00"
              placeholderTextColor="#4b5563"
              keyboardType="decimal-pad"
              value={betAmount}
              onChangeText={setBetAmount}
            />
            <Text style={{ color: '#6b7280' }}>USDC</Text>
          </View>

          {/* Quick Amount Buttons */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            {['5', '10', '25', '50'].map((amount) => (
              <Pressable
                key={amount}
                onPress={() => setBetAmount(amount)}
                style={{ flex: 1, backgroundColor: '#1a1a24', paddingVertical: 8, borderRadius: 8, alignItems: 'center' }}
              >
                <Text style={{ color: '#9ca3af' }}>${amount}</Text>
              </Pressable>
            ))}
          </View>

          {/* Potential Win Display */}
          {betAmountNum > 0 && (
            <View style={{ backgroundColor: '#1a1a24', borderRadius: 12, padding: 16, marginTop: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: '#6b7280' }}>Your Stake</Text>
                <Text style={{ color: 'white', fontWeight: '500' }}>${betAmountNum.toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: '#6b7280' }}>Odds</Text>
                <Text style={{ color: '#9ca3af' }}>{currentOdds}%</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#2a2a3a', paddingTop: 8 }}>
                <Text style={{ color: '#6b7280' }}>Potential Win</Text>
                <Text style={{ color: '#22c55e', fontWeight: 'bold', fontSize: 18 }}>
                  ${potentialWin.toFixed(2)}
                </Text>
              </View>
            </View>
          )}

          {/* Place Bet Button */}
          <Pressable
            onPress={handlePlaceBet}
            disabled={placing || betAmountNum <= 0}
            style={{
              backgroundColor: placing || betAmountNum <= 0 ? '#4b5563' : '#8b5cf6',
              borderRadius: 12,
              padding: 16,
              marginTop: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: 'white', fontWeight: '600', fontSize: 18 }}>
              {placing ? 'Placing Bet...' : 'Place Bet on ' + selectedSide}
            </Text>
          </Pressable>
        </View>

        {/* Market Info */}
        <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#2a2a3a', marginTop: 16 }}>
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Market Info</Text>
          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: '#6b7280' }}>Status</Text>
              <Text style={{ color: '#22c55e' }}>{market.status}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: '#6b7280' }}>Total Volume</Text>
              <Text style={{ color: 'white' }}>${((market.total_volume || 0) / 100).toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#6b7280' }}>Ends</Text>
              <Text style={{ color: 'white' }}>
                {market.closes_at ? new Date(market.closes_at).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                }) : 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
