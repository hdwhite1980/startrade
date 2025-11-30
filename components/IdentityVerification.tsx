// StarTrade - Identity Verification Component
// Allows users to verify their age via Stripe Identity

import { View, Text, Pressable, ActivityIndicator, Linking } from 'react-native';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

interface VerificationStatus {
  identity_status: string;
  is_21_plus: boolean;
  identity_verified_at: string | null;
  legal_first_name: string | null;
  date_of_birth: string | null;
}

interface IdentityVerificationProps {
  onStatusChange?: (status: string) => void;
}

export default function IdentityVerification({ onStatusChange }: IdentityVerificationProps) {
  const user = useAuthStore((state) => state.user);
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchStatus();
    }
  }, [user]);

  const fetchStatus = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('identity_status, is_21_plus, identity_verified_at, legal_first_name, date_of_birth')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setStatus(data);
      onStatusChange?.(data?.identity_status || 'UNVERIFIED');
    } catch (err: any) {
      console.error('Error fetching verification status:', err);
    } finally {
      setLoading(false);
    }
  };

  const startVerification = async () => {
    if (!user) return;

    setVerifying(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/create-verification`,
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

      if (result.verificationUrl) {
        await Linking.openURL(result.verificationUrl);
        // Update local status
        setStatus(prev => prev ? { ...prev, identity_status: 'PENDING' } : null);
        onStatusChange?.('PENDING');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start verification');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <View style={{ padding: 16, alignItems: 'center' }}>
        <ActivityIndicator color="#8b5cf6" />
      </View>
    );
  }

  const renderStatusContent = () => {
    if (!status) return null;

    switch (status.identity_status) {
      case 'VERIFIED':
        return (
          <View style={{ 
            backgroundColor: 'rgba(34, 197, 94, 0.15)', 
            borderRadius: 16, 
            padding: 20,
            borderWidth: 1,
            borderColor: 'rgba(34, 197, 94, 0.3)',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 28, marginRight: 12 }}>✅</Text>
              <View>
                <Text style={{ color: '#22c55e', fontSize: 18, fontWeight: 'bold' }}>
                  Identity Verified
                </Text>
                <Text style={{ color: '#86efac', fontSize: 12 }}>
                  {status.identity_verified_at 
                    ? `Verified on ${new Date(status.identity_verified_at).toLocaleDateString()}`
                    : 'Verification complete'}
                </Text>
              </View>
            </View>

            {status.legal_first_name && (
              <View style={{ 
                backgroundColor: 'rgba(34, 197, 94, 0.1)', 
                borderRadius: 8, 
                padding: 12,
                marginTop: 8,
              }}>
                <Text style={{ color: '#9ca3af', fontSize: 12 }}>Verified Name</Text>
                <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
                  {status.legal_first_name}
                </Text>
              </View>
            )}

            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              marginTop: 16,
              paddingTop: 16,
              borderTopWidth: 1,
              borderTopColor: 'rgba(34, 197, 94, 0.2)',
            }}>
              {status.is_21_plus ? (
                <>
                  <Text style={{ fontSize: 20, marginRight: 8 }}>🎉</Text>
                  <View>
                    <Text style={{ color: '#22c55e', fontWeight: '600' }}>Age Verified: 21+</Text>
                    <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                      You can bet with real USDC
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 20, marginRight: 8 }}>🎮</Text>
                  <View>
                    <Text style={{ color: '#fbbf24', fontWeight: '600' }}>Under 21</Text>
                    <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                      You can play with virtual currency only
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>
        );

      case 'PENDING':
        return (
          <View style={{ 
            backgroundColor: 'rgba(251, 191, 36, 0.15)', 
            borderRadius: 16, 
            padding: 20,
            borderWidth: 1,
            borderColor: 'rgba(251, 191, 36, 0.3)',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <ActivityIndicator color="#fbbf24" style={{ marginRight: 12 }} />
              <View>
                <Text style={{ color: '#fbbf24', fontSize: 18, fontWeight: 'bold' }}>
                  Verification In Progress
                </Text>
                <Text style={{ color: '#fef3c7', fontSize: 12 }}>
                  Usually takes a few minutes
                </Text>
              </View>
            </View>
            <Text style={{ color: '#fef3c7', fontSize: 14 }}>
              We're reviewing your documents. You'll be notified once complete.
            </Text>
            <Pressable
              onPress={fetchStatus}
              style={{
                backgroundColor: 'rgba(251, 191, 36, 0.2)',
                borderRadius: 8,
                paddingVertical: 10,
                marginTop: 16,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fbbf24', fontWeight: '600' }}>🔄 Check Status</Text>
            </Pressable>
          </View>
        );

      case 'REQUIRES_INPUT':
        return (
          <View style={{ 
            backgroundColor: 'rgba(239, 68, 68, 0.15)', 
            borderRadius: 16, 
            padding: 20,
            borderWidth: 1,
            borderColor: 'rgba(239, 68, 68, 0.3)',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 28, marginRight: 12 }}>⚠️</Text>
              <View>
                <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: 'bold' }}>
                  Additional Info Required
                </Text>
                <Text style={{ color: '#fca5a5', fontSize: 12 }}>
                  Please try verifying again
                </Text>
              </View>
            </View>
            <Text style={{ color: '#fca5a5', fontSize: 14, marginBottom: 16 }}>
              We couldn't verify your identity. This could be due to unclear photos or an expired ID.
            </Text>
            <Pressable
              onPress={startVerification}
              disabled={verifying}
              style={{
                backgroundColor: '#ef4444',
                borderRadius: 8,
                paddingVertical: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold' }}>
                {verifying ? 'Starting...' : '🪪 Try Again'}
              </Text>
            </Pressable>
          </View>
        );

      case 'REJECTED':
        return (
          <View style={{ 
            backgroundColor: 'rgba(239, 68, 68, 0.15)', 
            borderRadius: 16, 
            padding: 20,
            borderWidth: 1,
            borderColor: 'rgba(239, 68, 68, 0.3)',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 28, marginRight: 12 }}>❌</Text>
              <View>
                <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: 'bold' }}>
                  Verification Failed
                </Text>
              </View>
            </View>
            <Text style={{ color: '#fca5a5', fontSize: 14, marginBottom: 16 }}>
              Your verification was not successful. Please contact support if you believe this is an error.
            </Text>
            <Pressable
              onPress={startVerification}
              disabled={verifying}
              style={{
                backgroundColor: '#ef4444',
                borderRadius: 8,
                paddingVertical: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold' }}>
                {verifying ? 'Starting...' : '🪪 Try Again'}
              </Text>
            </Pressable>
          </View>
        );

      default: // UNVERIFIED
        return (
          <View style={{ 
            backgroundColor: '#1a1a24', 
            borderRadius: 16, 
            padding: 20,
            borderWidth: 1,
            borderColor: '#2a2a3a',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 32, marginRight: 12 }}>🪪</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
                  Verify Your Identity
                </Text>
                <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                  Required to bet with real USDC
                </Text>
              </View>
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: '#9ca3af', fontSize: 14, lineHeight: 20 }}>
                To comply with regulations and ensure a safe platform, we require age verification for real currency betting.
              </Text>
            </View>

            <View style={{ 
              backgroundColor: 'rgba(139, 92, 246, 0.1)', 
              borderRadius: 8, 
              padding: 12,
              marginBottom: 16,
            }}>
              <Text style={{ color: '#a78bfa', fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
                What you'll need:
              </Text>
              <Text style={{ color: '#9ca3af', fontSize: 13 }}>• Government-issued ID (driver's license, passport, or ID card)</Text>
              <Text style={{ color: '#9ca3af', fontSize: 13 }}>• A selfie for verification</Text>
              <Text style={{ color: '#9ca3af', fontSize: 13 }}>• Must be 21 or older for real USDC</Text>
            </View>

            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
            }}>
              <Text style={{ fontSize: 16, marginRight: 8 }}>🔒</Text>
              <Text style={{ color: '#9ca3af', fontSize: 12, flex: 1 }}>
                Powered by Stripe Identity. Your data is encrypted and secure.
              </Text>
            </View>

            {error && (
              <View style={{ 
                backgroundColor: 'rgba(239, 68, 68, 0.2)', 
                borderRadius: 8, 
                padding: 12, 
                marginBottom: 16 
              }}>
                <Text style={{ color: '#ef4444', textAlign: 'center' }}>{error}</Text>
              </View>
            )}

            <Pressable
              onPress={startVerification}
              disabled={verifying}
              style={{
                backgroundColor: '#8b5cf6',
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                {verifying ? 'Starting Verification...' : '🪪 Verify My Identity'}
              </Text>
            </Pressable>

            <Text style={{ color: '#6b7280', fontSize: 11, textAlign: 'center', marginTop: 12 }}>
              Under 21? You can still play with virtual currency!
            </Text>
          </View>
        );
    }
  };

  return renderStatusContent();
}
