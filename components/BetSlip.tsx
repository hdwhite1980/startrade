import { View, Text, TextInput, Pressable, Keyboard, Linking } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useBets } from '@/hooks/useBets';
import { supabase } from '@/lib/supabase';
import type { Market } from '@/types/database';
import type { BetSide } from '@/hooks/useBets';

interface BetSlipProps {
  market: Market;
  position: BetSide;
  odds: number;
  onClose: () => void;
}

export default function BetSlip({ market, position, odds, onClose }: BetSlipProps) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { placeBet } = useBets();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Currency mode: VIRTUAL or REAL
  const [currencyMode, setCurrencyMode] = useState<'VIRTUAL' | 'REAL'>('VIRTUAL');
  const [virtualBalance, setVirtualBalance] = useState(100000); // 1000.00
  const [realBalance, setRealBalance] = useState(0);
  
  // Age verification state
  const [identityStatus, setIdentityStatus] = useState<string>('UNVERIFIED');
  const [is21Plus, setIs21Plus] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);

  // Fetch user balances and verification status
  useEffect(() => {
    if (user) {
      fetchBalances();
    }
  }, [user]);

  const fetchBalances = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('user_profiles')
      .select('virtual_balance, usdc_balance, preferred_currency, identity_status, is_21_plus')
      .eq('id', user.id)
      .single();
    
    if (data) {
      setVirtualBalance(data.virtual_balance || 100000);
      setRealBalance(data.usdc_balance || 0);
      setIdentityStatus(data.identity_status || 'UNVERIFIED');
      setIs21Plus(data.is_21_plus || false);
      // Default to virtual if not verified 21+
      if (!data.is_21_plus || data.identity_status !== 'VERIFIED') {
        setCurrencyMode('VIRTUAL');
      } else {
        setCurrencyMode(data.preferred_currency === 'REAL' ? 'REAL' : 'VIRTUAL');
      }
    }
  };

  // Check if user can use real currency
  const canUseRealCurrency = identityStatus === 'VERIFIED' && is21Plus;

  // Start identity verification
  const startVerification = async () => {
    if (!user) {
      router.push('/auth');
      return;
    }

    setVerificationLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-verification`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            returnUrl: 'startrade://verify-callback',
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to start verification');
      }

      // Open Stripe verification URL
      if (result.verificationUrl) {
        await Linking.openURL(result.verificationUrl);
        setIdentityStatus('PENDING');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start verification');
    } finally {
      setVerificationLoading(false);
    }
  };

  const numAmount = parseFloat(amount) || 0;
  const potentialPayout = numAmount > 0 ? numAmount / odds : 0;
  const profit = potentialPayout - numAmount;
  
  const currentBalance = currencyMode === 'VIRTUAL' ? virtualBalance / 100 : realBalance / 100;
  const maxBet = currencyMode === 'VIRTUAL' ? 100 : 25; // Higher limits for virtual

  const quickAmounts = currencyMode === 'VIRTUAL' ? [5, 10, 25, 50] : [1, 5, 10, 25];

  const handlePlaceBet = async () => {
    if (!user) {
      router.push('/auth');
      return;
    }

    if (numAmount < 1) {
      setError('Minimum bet is $1');
      return;
    }

    if (numAmount > maxBet) {
      setError(`Maximum bet is $${maxBet}`);
      return;
    }

    if (numAmount > currentBalance) {
      setError(`Insufficient ${currencyMode === 'VIRTUAL' ? 'virtual' : 'USDC'} balance`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const amountCents = Math.round(numAmount * 100);
      
      if (currencyMode === 'VIRTUAL') {
        // Place virtual bet
        await placeVirtualBet(amountCents);
      } else {
        // Place real bet
        await placeBet(market.id, position, amountCents);
      }
      
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to place bet');
    } finally {
      setLoading(false);
    }
  };

  const placeVirtualBet = async (amountCents: number) => {
    if (!user) throw new Error('Not logged in');

    // Calculate potential payout
    const oddsAtPlacement = position === 'YES' ? market.yes_odds : market.no_odds;
    const potentialPayoutCents = Math.round((amountCents * 10000) / oddsAtPlacement);

    // Insert bet with is_virtual = true
    const { error: betError } = await supabase
      .from('bets')
      .insert({
        user_id: user.id,
        market_id: market.id,
        side: position,
        amount: amountCents,
        odds_at_placement: oddsAtPlacement,
        potential_payout: potentialPayoutCents,
        is_virtual: true,
        status: 'ACTIVE',
      });

    if (betError) throw betError;

    // Deduct from virtual balance
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        virtual_balance: virtualBalance - amountCents,
      })
      .eq('id', user.id);

    if (updateError) throw updateError;

    // Update market pools (even for virtual - helps with display)
    const poolUpdate = position === 'YES' 
      ? { yes_pool: (market.yes_pool || 0) + amountCents }
      : { no_pool: (market.no_pool || 0) + amountCents };

    await supabase
      .from('markets')
      .update({
        ...poolUpdate,
        total_volume: (market.total_volume || 0) + amountCents,
        total_bets: (market.total_bets || 0) + 1,
      })
      .eq('id', market.id);
  };

  return (
    <View style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#1a1a24',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 16,
      paddingBottom: 32,
      borderTopWidth: 1,
      borderTopColor: '#2a2a3a',
    }}>
      {/* Handle */}
      <View style={{ width: 48, height: 4, backgroundColor: '#2a2a3a', borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
      
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>Place Bet</Text>
        <Pressable onPress={onClose}>
          <Text style={{ color: '#9ca3af', fontSize: 20 }}>✕</Text>
        </Pressable>
      </View>

      {/* Currency Toggle */}
      <View style={{ 
        flexDirection: 'row', 
        backgroundColor: '#0f0f14', 
        borderRadius: 12, 
        padding: 4,
        marginBottom: 16,
      }}>
        <Pressable 
          onPress={() => setCurrencyMode('VIRTUAL')}
          style={{ 
            flex: 1, 
            paddingVertical: 10, 
            borderRadius: 10,
            backgroundColor: currencyMode === 'VIRTUAL' ? '#8b5cf6' : 'transparent',
            alignItems: 'center',
          }}
        >
          <Text style={{ 
            color: currencyMode === 'VIRTUAL' ? 'white' : '#6b7280', 
            fontWeight: '600',
            fontSize: 13,
          }}>
            🎮 Virtual (${(virtualBalance / 100).toFixed(0)})
          </Text>
        </Pressable>
        <Pressable 
          onPress={() => {
            if (canUseRealCurrency) {
              setCurrencyMode('REAL');
            } else {
              setError('Must be 21+ with verified ID to use real USDC');
            }
          }}
          style={{ 
            flex: 1, 
            paddingVertical: 10, 
            borderRadius: 10,
            backgroundColor: currencyMode === 'REAL' ? '#22c55e' : 'transparent',
            alignItems: 'center',
            opacity: canUseRealCurrency ? 1 : 0.5,
          }}
        >
          <Text style={{ 
            color: currencyMode === 'REAL' ? 'white' : '#6b7280', 
            fontWeight: '600',
            fontSize: 13,
          }}>
            💵 Real {canUseRealCurrency ? `($${(realBalance / 100).toFixed(2)})` : '🔒'}
          </Text>
        </Pressable>
      </View>

      {/* Age Verification Banner (if not verified) */}
      {!canUseRealCurrency && user && (
        <View style={{ 
          backgroundColor: 'rgba(251, 191, 36, 0.15)', 
          borderRadius: 12, 
          padding: 12,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: 'rgba(251, 191, 36, 0.3)',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 16, marginRight: 8 }}>🔞</Text>
            <Text style={{ color: '#fbbf24', fontWeight: '600', flex: 1 }}>
              {identityStatus === 'PENDING' 
                ? 'Verification In Progress' 
                : identityStatus === 'VERIFIED' && !is21Plus
                  ? 'Must Be 21+ for Real USDC'
                  : 'Verify ID to Use Real USDC'}
            </Text>
          </View>
          <Text style={{ color: '#fef3c7', fontSize: 12, marginBottom: 12 }}>
            {identityStatus === 'PENDING'
              ? 'We\'re reviewing your documents. This usually takes a few minutes.'
              : identityStatus === 'VERIFIED' && !is21Plus
                ? 'Your ID shows you\'re under 21. You can still play with virtual currency!'
                : 'You must be 21 or older to bet with real USDC. Verify your age with a government ID.'}
          </Text>
          {identityStatus !== 'PENDING' && identityStatus !== 'VERIFIED' && (
            <Pressable
              onPress={startVerification}
              disabled={verificationLoading}
              style={{
                backgroundColor: '#fbbf24',
                borderRadius: 8,
                paddingVertical: 10,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#1a1a24', fontWeight: 'bold', fontSize: 14 }}>
                {verificationLoading ? 'Starting...' : '🪪 Verify My ID'}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Position */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <View style={{
          paddingHorizontal: 12,
          paddingVertical: 4,
          borderRadius: 20,
          backgroundColor: position === 'YES' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
        }}>
          <Text style={{
            fontWeight: 'bold',
            color: position === 'YES' ? '#22c55e' : '#ef4444',
          }}>
            {position}
          </Text>
        </View>
        <Text style={{ color: '#9ca3af', marginLeft: 8 }}>at {(odds * 100).toFixed(0)}%</Text>
      </View>

      {/* Amount Input */}
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: '#9ca3af' }}>Amount</Text>
          <Text style={{ color: '#6b7280', fontSize: 12 }}>
            Balance: ${currentBalance.toFixed(2)} {currencyMode === 'VIRTUAL' ? '(Virtual)' : 'USDC'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#2a2a3a', borderRadius: 12, paddingHorizontal: 16 }}>
          <Text style={{ color: currencyMode === 'VIRTUAL' ? '#8b5cf6' : '#22c55e', fontSize: 24 }}>$</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor="#6b7280"
            keyboardType="decimal-pad"
            style={{ flex: 1, color: 'white', fontSize: 24, paddingVertical: 16, marginLeft: 4 }}
          />
        </View>
      </View>

      {/* Quick Amounts */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {quickAmounts.map((qa) => (
          <Pressable
            key={qa}
            onPress={() => {
              setAmount(qa.toString());
              Keyboard.dismiss();
            }}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: numAmount === qa ? '#8b5cf6' : '#2a2a3a',
            }}
          >
            <Text style={{
              textAlign: 'center',
              fontWeight: '500',
              color: numAmount === qa ? 'white' : '#9ca3af',
            }}>
              ${qa}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Payout Info */}
      <View style={{ backgroundColor: '#2a2a3a', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: '#9ca3af' }}>Potential Payout</Text>
          <Text style={{ color: 'white', fontWeight: 'bold' }}>${potentialPayout.toFixed(2)}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: '#9ca3af' }}>Potential Profit</Text>
          <Text style={{ color: '#22c55e', fontWeight: 'bold' }}>+${profit.toFixed(2)}</Text>
        </View>
      </View>

      {/* Error */}
      {error && (
        <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <Text style={{ color: '#ef4444', textAlign: 'center' }}>{error}</Text>
        </View>
      )}

      {/* Place Bet Button */}
      <Pressable
        onPress={handlePlaceBet}
        disabled={loading || numAmount <= 0}
        style={{
          borderRadius: 12,
          paddingVertical: 16,
          backgroundColor: loading || numAmount <= 0 ? 'rgba(139, 92, 246, 0.5)' : '#8b5cf6',
        }}
      >
        <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 18 }}>
          {loading 
            ? 'Placing Bet...' 
            : !user 
              ? 'Sign In to Bet'
              : numAmount <= 0 
                ? 'Enter Amount' 
                : `Bet $${numAmount.toFixed(2)} on ${position}`}
        </Text>
      </Pressable>
    </View>
  );
}
