// StarTrade - Profile Screen  
// Real USDC Betting on Base (Coinbase L2)
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { usePortfolioStats } from '@/hooks/useBets';
import { IdentityVerification } from '@/components';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const { stats, loading } = usePortfolioStats(user?.id || '');

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0f', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Text style={{ fontSize: 40, marginBottom: 16 }}>👤</Text>
        <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>My Account</Text>
        <Text style={{ color: '#9ca3af', textAlign: 'center', marginBottom: 24 }}>
          Sign in to access your wallet and betting profile
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

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0f', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  // Determine badges based on real betting performance
  const badges: string[] = [];
  if (stats.activeBets >= 3) badges.push('🎯 Active Bettor');
  if (stats.winRate >= 60) badges.push('🔥 Winning Streak');
  if (stats.totalBets >= 10) badges.push('📈 Experienced');
  if (stats.totalBets >= 50) badges.push('💎 Veteran');
  if (stats.netProfit > 0) badges.push('💰 Profitable');

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0f', paddingTop: 56 }}>
      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
        {/* Profile Header */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View style={{ width: 96, height: 96, backgroundColor: 'rgba(139, 92, 246, 0.2)', borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 40 }}>
              {stats.rankTitle === 'Legend' ? '👑' :
               stats.rankTitle === 'Veteran' ? '💎' :
               stats.rankTitle === 'Regular' ? '🎯' :
               stats.rankTitle === 'Newcomer' ? '⭐' : '��'}
            </Text>
          </View>
          <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 4 }}>
            {user.email?.split('@')[0] || 'Bettor'}
          </Text>
          <View style={{ backgroundColor: 'rgba(139, 92, 246, 0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 }}>
            <Text style={{ color: '#a78bfa', fontWeight: '500' }}>{stats.rankTitle}</Text>
          </View>
        </View>

        {/* Balance Overview */}
        <View style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', borderRadius: 12, padding: 24, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.2)' }}>
          <Text style={{ color: '#9ca3af', fontSize: 14, marginBottom: 8 }}>Total Balance</Text>
          <Text style={{ color: 'white', fontSize: 36, fontWeight: 'bold' }}>
            ${(stats.usdcBalance + stats.escrowedBalance).toFixed(2)}
          </Text>
          <View style={{ flexDirection: 'row', marginTop: 12, gap: 16 }}>
            <View>
              <Text style={{ color: '#6b7280', fontSize: 12 }}>Available</Text>
              <Text style={{ color: '#22c55e', fontWeight: '500' }}>${stats.usdcBalance.toFixed(2)}</Text>
            </View>
            <View>
              <Text style={{ color: '#6b7280', fontSize: 12 }}>In Bets</Text>
              <Text style={{ color: '#facc15', fontWeight: '500' }}>${stats.escrowedBalance.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <View style={{ backgroundColor: '#1a1a24', borderRadius: 12, padding: 16, flex: 1, minWidth: '45%' }}>
            <Text style={{ color: '#9ca3af', fontSize: 14 }}>Win Rate</Text>
            <Text style={{ color: '#22c55e', fontSize: 24, fontWeight: 'bold' }}>
              {stats.winRate.toFixed(0)}%
            </Text>
          </View>
          <View style={{ backgroundColor: '#1a1a24', borderRadius: 12, padding: 16, flex: 1, minWidth: '45%' }}>
            <Text style={{ color: '#9ca3af', fontSize: 14 }}>Total Bets</Text>
            <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>
              {stats.totalBets}
            </Text>
          </View>
          <View style={{ backgroundColor: '#1a1a24', borderRadius: 12, padding: 16, flex: 1, minWidth: '45%' }}>
            <Text style={{ color: '#9ca3af', fontSize: 14 }}>Net Profit</Text>
            <Text style={{ color: stats.netProfit >= 0 ? '#22c55e' : '#ef4444', fontSize: 24, fontWeight: 'bold' }}>
              {stats.netProfit >= 0 ? '+' : ''}${stats.netProfit.toFixed(2)}
            </Text>
          </View>
          <View style={{ backgroundColor: '#1a1a24', borderRadius: 12, padding: 16, flex: 1, minWidth: '45%' }}>
            <Text style={{ color: '#9ca3af', fontSize: 14 }}>Active Bets</Text>
            <Text style={{ color: '#facc15', fontSize: 24, fontWeight: 'bold' }}>
              {stats.activeBets}
            </Text>
          </View>
        </View>

        {/* Achievement Badges */}
        {badges.length > 0 && (
          <View style={{ backgroundColor: '#1a1a24', borderRadius: 12, padding: 16, marginBottom: 24 }}>
            <Text style={{ color: '#9ca3af', fontSize: 14, marginBottom: 12 }}>Achievements</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {badges.map((badge, index) => (
                <View key={index} style={{ backgroundColor: '#2a2a3a', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}>
                  <Text style={{ color: 'white', fontSize: 14 }}>{badge}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Deposit / Withdraw Buttons */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
          <Pressable
            onPress={() => Alert.alert('Deposit', 'Deposit functionality coming soon!')}
            style={{ flex: 1, backgroundColor: 'rgba(34, 197, 94, 0.2)', borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.3)', borderRadius: 12, paddingVertical: 16 }}
          >
            <Text style={{ color: '#22c55e', textAlign: 'center', fontWeight: '500' }}>Deposit USDC</Text>
          </Pressable>
          <Pressable
            onPress={() => Alert.alert('Withdraw', 'Withdraw functionality coming soon!')}
            style={{ flex: 1, backgroundColor: 'rgba(59, 130, 246, 0.2)', borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.3)', borderRadius: 12, paddingVertical: 16 }}
          >
            <Text style={{ color: '#3b82f6', textAlign: 'center', fontWeight: '500' }}>Withdraw</Text>
          </Pressable>
        </View>

        {/* Identity Verification Section */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>
            🔐 Identity Verification
          </Text>
          <Text style={{ color: '#9ca3af', fontSize: 13, marginBottom: 16 }}>
            Verify your identity to unlock real USDC betting. Must be 21+.
          </Text>
          <IdentityVerification />
        </View>

        {/* Sign Out */}
        <Pressable
          onPress={handleSignOut}
          style={{ backgroundColor: '#1a1a24', borderRadius: 12, paddingVertical: 16, marginBottom: 32 }}
        >
          <Text style={{ color: '#ef4444', textAlign: 'center', fontWeight: '500' }}>Sign Out</Text>
        </Pressable>

        {/* Legal Disclaimer */}
        <View style={{ backgroundColor: '#1a1a24', borderRadius: 12, padding: 16, marginBottom: 32 }}>
          <Text style={{ color: '#6b7280', fontSize: 12, textAlign: 'center', lineHeight: 20 }}>
            StarTrade is a prediction market platform using real USDC on Base 
            (Coinbase L2). All bets involve real cryptocurrency. Please bet 
            responsibly and only with funds you can afford to lose.
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}
