import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

type AuthMode = 'welcome' | 'signin' | 'signup' | 'verify' | 'onboarding';
type OnboardingStep = 'username' | 'interests' | 'age' | 'terms';

const INTEREST_OPTIONS = [
  { id: 'music', emoji: '🎵', label: 'Music' },
  { id: 'film', emoji: '🎬', label: 'Film & TV' },
  { id: 'social', emoji: '📱', label: 'Social Media' },
  { id: 'gaming', emoji: '🎮', label: 'Gaming' },
  { id: 'awards', emoji: '🏆', label: 'Awards Shows' },
  { id: 'streaming', emoji: '📺', label: 'Streaming' },
];

export default function AuthScreen() {
  const router = useRouter();
  const { signIn, signUp, loading, user } = useAuthStore();
  
  // Auth state
  const [mode, setMode] = useState<AuthMode>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Onboarding state
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>('username');
  const [username, setUsername] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Email verification state
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '']);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [codeTimer, setCodeTimer] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const handleSendVerificationCode = async () => {
    setSendingCode(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-verification`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send verification code');
      }

      // Start countdown timer (60 seconds)
      setCodeTimer(60);
      const interval = setInterval(() => {
        setCodeTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Move to verification screen
      setMode('verify');
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    const code = verificationCode.join('');
    if (code.length !== 5) {
      setError('Please enter the complete 5-character code');
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      // Verify the code
      const { data, error: verifyError } = await supabase
        .rpc('verify_email_code', { 
          email_param: email, 
          code_param: code 
        });

      if (verifyError) throw verifyError;
      if (!data.success) {
        throw new Error(data.error || 'Invalid verification code');
      }

      // Code verified! Now create the account
      const result = await signUp(email, password);

      if (result.error) {
        throw new Error(result.error.message);
      }

      // Move to onboarding
      setMode('onboarding');
      setOnboardingStep('username');
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleCodeInput = (text: string, index: number) => {
    // Only allow alphanumeric
    const char = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    const newCode = [...verificationCode];
    newCode[index] = char.slice(-1); // Only take last character
    setVerificationCode(newCode);

    // Auto-advance to next input
    if (char && index < 4) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !verificationCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSignIn = async () => {
    setError(null);
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    const result = await signIn(email, password);

    if (result.error) {
      setError(result.error.message);
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleSignUp = async () => {
    setError(null);
    
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Check if email is already registered
    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      setError('An account with this email already exists');
      return;
    }

    // Send verification code instead of creating account
    await handleSendVerificationCode();
  };

  const toggleInterest = (id: string) => {
    if (interests.includes(id)) {
      setInterests(interests.filter(i => i !== id));
    } else {
      setInterests([...interests, id]);
    }
  };

  const handleCompleteOnboarding = async () => {
    if (!user) return;
    
    setSavingProfile(true);
    setError(null);

    try {
      // Check if username is available
      const { data: existingUser } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('username', username.toLowerCase())
        .neq('id', user.id)
        .single();

      if (existingUser) {
        setError('Username is already taken');
        setSavingProfile(false);
        return;
      }

      // Update user profile
      const { error: updateError } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          email: user.email,
          username: username.toLowerCase(),
          interests: interests,
          age_confirmed: ageConfirmed,
          terms_accepted: termsAccepted,
          terms_accepted_at: new Date().toISOString(),
          onboarding_completed: true,
          virtual_balance: 100000, // Start with $1000 virtual
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (updateError) throw updateError;

      // Navigate to main app
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const validateUsername = (value: string) => {
    // Only allow alphanumeric and underscores
    return value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
  };

  // Welcome Screen
  if (mode === 'welcome') {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0f', padding: 24, justifyContent: 'center' }}>
        {/* Logo / Header */}
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <Text style={{ fontSize: 64, marginBottom: 16 }}>⭐</Text>
          <Text style={{ color: 'white', fontSize: 36, fontWeight: 'bold', marginBottom: 8 }}>
            StarTrade
          </Text>
          <Text style={{ color: '#9ca3af', fontSize: 16, textAlign: 'center' }}>
            Predict the future of entertainment
          </Text>
        </View>

        {/* Features */}
        <View style={{ marginBottom: 48 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 24, marginRight: 12 }}>🎯</Text>
            <View>
              <Text style={{ color: 'white', fontWeight: '600' }}>Make Predictions</Text>
              <Text style={{ color: '#6b7280', fontSize: 13 }}>Bet on celebrity outcomes</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 24, marginRight: 12 }}>🎮</Text>
            <View>
              <Text style={{ color: 'white', fontWeight: '600' }}>Play for Free</Text>
              <Text style={{ color: '#6b7280', fontSize: 13 }}>Start with $1,000 virtual currency</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 24, marginRight: 12 }}>🏆</Text>
            <View>
              <Text style={{ color: 'white', fontWeight: '600' }}>Win Prizes</Text>
              <Text style={{ color: '#6b7280', fontSize: 13 }}>Compete on the leaderboard</Text>
            </View>
          </View>
        </View>

        {/* Buttons */}
        <Pressable
          onPress={() => setMode('signup')}
          style={{
            backgroundColor: '#8b5cf6',
            borderRadius: 12,
            paddingVertical: 16,
            marginBottom: 12,
          }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 18 }}>
            Get Started
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setMode('signin')}
          style={{
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: '#2a2a3a',
            borderRadius: 12,
            paddingVertical: 16,
          }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600', fontSize: 16 }}>
            I already have an account
          </Text>
        </Pressable>
      </View>
    );
  }

  // Sign In Screen
  if (mode === 'signin') {
    return (
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: '#0a0a0f' }}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 60 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Button */}
          <Pressable onPress={() => setMode('welcome')} style={{ marginBottom: 24 }}>
            <Text style={{ color: '#8b5cf6', fontSize: 16 }}>← Back</Text>
          </Pressable>

          <Text style={{ color: 'white', fontSize: 32, fontWeight: 'bold', marginBottom: 8 }}>
            Welcome Back
          </Text>
          <Text style={{ color: '#9ca3af', marginBottom: 32 }}>
            Sign in to continue predicting
          </Text>

          {error && (
            <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <Text style={{ color: '#ef4444', textAlign: 'center' }}>{error}</Text>
            </View>
          )}

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#9ca3af', marginBottom: 8 }}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              style={{
                backgroundColor: '#1a1a24',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 16,
                color: 'white',
                fontSize: 16,
              }}
            />
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: '#9ca3af', marginBottom: 8 }}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#6b7280"
              secureTextEntry
              autoComplete="password"
              style={{
                backgroundColor: '#1a1a24',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 16,
                color: 'white',
                fontSize: 16,
              }}
            />
          </View>

          <Pressable
            onPress={handleSignIn}
            disabled={loading}
            style={{
              backgroundColor: loading ? 'rgba(139, 92, 246, 0.5)' : '#8b5cf6',
              borderRadius: 12,
              paddingVertical: 16,
              marginBottom: 24,
            }}
          >
            <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 18 }}>
              {loading ? 'Signing In...' : 'Sign In'}
            </Text>
          </Pressable>

          <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
            <Text style={{ color: '#9ca3af' }}>Don't have an account? </Text>
            <Pressable onPress={() => { setMode('signup'); setError(null); }}>
              <Text style={{ color: '#8b5cf6', fontWeight: '600' }}>Sign Up</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Sign Up Screen
  if (mode === 'signup') {
    return (
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: '#0a0a0f' }}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 60 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Button */}
          <Pressable onPress={() => setMode('welcome')} style={{ marginBottom: 24 }}>
            <Text style={{ color: '#8b5cf6', fontSize: 16 }}>← Back</Text>
          </Pressable>

          <Text style={{ color: 'white', fontSize: 32, fontWeight: 'bold', marginBottom: 8 }}>
            Create Account
          </Text>
          <Text style={{ color: '#9ca3af', marginBottom: 32 }}>
            Join thousands of predictors
          </Text>

          {error && (
            <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <Text style={{ color: '#ef4444', textAlign: 'center' }}>{error}</Text>
            </View>
          )}

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#9ca3af', marginBottom: 8 }}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              style={{
                backgroundColor: '#1a1a24',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 16,
                color: 'white',
                fontSize: 16,
              }}
            />
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#9ca3af', marginBottom: 8 }}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              placeholderTextColor="#6b7280"
              secureTextEntry
              autoComplete="new-password"
              style={{
                backgroundColor: '#1a1a24',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 16,
                color: 'white',
                fontSize: 16,
              }}
            />
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: '#9ca3af', marginBottom: 8 }}>Confirm Password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              placeholderTextColor="#6b7280"
              secureTextEntry
              autoComplete="new-password"
              style={{
                backgroundColor: '#1a1a24',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 16,
                color: 'white',
                fontSize: 16,
              }}
            />
          </View>

          <Pressable
            onPress={handleSignUp}
            disabled={loading || sendingCode}
            style={{
              backgroundColor: loading || sendingCode ? 'rgba(139, 92, 246, 0.5)' : '#8b5cf6',
              borderRadius: 12,
              paddingVertical: 16,
              marginBottom: 24,
            }}
          >
            <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 18 }}>
              {sendingCode ? 'Sending Code...' : loading ? 'Creating Account...' : 'Continue'}
            </Text>
          </Pressable>

          <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
            <Text style={{ color: '#9ca3af' }}>Already have an account? </Text>
            <Pressable onPress={() => { setMode('signin'); setError(null); }}>
              <Text style={{ color: '#8b5cf6', fontWeight: '600' }}>Sign In</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Email Verification Screen
  if (mode === 'verify') {
    return (
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: '#0a0a0f' }}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 60 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Button */}
          <Pressable onPress={() => { setMode('signup'); setError(null); setVerificationCode(['', '', '', '', '']); }} style={{ marginBottom: 24 }}>
            <Text style={{ color: '#8b5cf6', fontSize: 16 }}>← Back</Text>
          </Pressable>

          <Text style={{ fontSize: 48, marginBottom: 16 }}>📧</Text>
          <Text style={{ color: 'white', fontSize: 28, fontWeight: 'bold', marginBottom: 8 }}>
            Verify Your Email
          </Text>
          <Text style={{ color: '#9ca3af', marginBottom: 8 }}>
            We sent a 5-character code to
          </Text>
          <Text style={{ color: '#8b5cf6', fontWeight: '600', marginBottom: 32, fontSize: 16 }}>
            {email}
          </Text>

          {error && (
            <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <Text style={{ color: '#ef4444', textAlign: 'center' }}>{error}</Text>
            </View>
          )}

          {/* Code Input Boxes */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 32 }}>
            {[0, 1, 2, 3, 4].map((index) => (
              <TextInput
                key={index}
                ref={(ref) => { inputRefs.current[index] = ref; }}
                value={verificationCode[index]}
                onChangeText={(text) => handleCodeInput(text, index)}
                onKeyPress={(e) => handleCodeKeyPress(e, index)}
                maxLength={1}
                autoCapitalize="characters"
                autoCorrect={false}
                keyboardType="default"
                style={{
                  width: 56,
                  height: 64,
                  backgroundColor: '#1a1a24',
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: verificationCode[index] ? '#8b5cf6' : '#2a2a3a',
                  color: 'white',
                  fontSize: 24,
                  fontWeight: 'bold',
                  textAlign: 'center',
                }}
              />
            ))}
          </View>

          <Pressable
            onPress={handleVerifyCode}
            disabled={verifying || verificationCode.join('').length !== 5}
            style={{
              backgroundColor: verifying || verificationCode.join('').length !== 5 
                ? 'rgba(139, 92, 246, 0.5)' 
                : '#8b5cf6',
              borderRadius: 12,
              paddingVertical: 16,
              marginBottom: 24,
            }}
          >
            <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 18 }}>
              {verifying ? 'Verifying...' : 'Verify & Create Account'}
            </Text>
          </Pressable>

          {/* Resend Code */}
          <View style={{ alignItems: 'center' }}>
            {codeTimer > 0 ? (
              <Text style={{ color: '#6b7280' }}>
                Resend code in {codeTimer}s
              </Text>
            ) : (
              <Pressable 
                onPress={handleSendVerificationCode} 
                disabled={sendingCode}
              >
                <Text style={{ color: '#8b5cf6', fontWeight: '600' }}>
                  {sendingCode ? 'Sending...' : 'Resend Code'}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Help Text */}
          <View style={{ marginTop: 32, backgroundColor: '#1a1a24', borderRadius: 12, padding: 16 }}>
            <Text style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              💡 Check your spam folder if you don't see the email. The code expires in 10 minutes.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Onboarding Flow
  if (mode === 'onboarding') {
    // Step 1: Username
    if (onboardingStep === 'username') {
      return (
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, backgroundColor: '#0a0a0f' }}
        >
          <ScrollView 
            contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 60 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Progress */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 32 }}>
              <View style={{ flex: 1, height: 4, backgroundColor: '#8b5cf6', borderRadius: 2 }} />
              <View style={{ flex: 1, height: 4, backgroundColor: '#2a2a3a', borderRadius: 2 }} />
              <View style={{ flex: 1, height: 4, backgroundColor: '#2a2a3a', borderRadius: 2 }} />
              <View style={{ flex: 1, height: 4, backgroundColor: '#2a2a3a', borderRadius: 2 }} />
            </View>

            <Text style={{ fontSize: 48, marginBottom: 16 }}>👤</Text>
            <Text style={{ color: 'white', fontSize: 28, fontWeight: 'bold', marginBottom: 8 }}>
              Choose your username
            </Text>
            <Text style={{ color: '#9ca3af', marginBottom: 32 }}>
              This is how other players will see you on the leaderboard
            </Text>

            {error && (
              <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <Text style={{ color: '#ef4444', textAlign: 'center' }}>{error}</Text>
              </View>
            )}

            <View style={{ marginBottom: 32 }}>
              <Text style={{ color: '#9ca3af', marginBottom: 8 }}>Username</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a24', borderRadius: 12, paddingHorizontal: 16 }}>
                <Text style={{ color: '#6b7280', fontSize: 18 }}>@</Text>
                <TextInput
                  value={username}
                  onChangeText={(v) => setUsername(validateUsername(v))}
                  placeholder="username"
                  placeholderTextColor="#6b7280"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                  style={{
                    flex: 1,
                    paddingVertical: 16,
                    paddingLeft: 4,
                    color: 'white',
                    fontSize: 18,
                  }}
                />
              </View>
              <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 8 }}>
                Letters, numbers, and underscores only
              </Text>
            </View>

            <Pressable
              onPress={() => {
                if (username.length < 3) {
                  setError('Username must be at least 3 characters');
                  return;
                }
                setError(null);
                setOnboardingStep('interests');
              }}
              disabled={username.length < 3}
              style={{
                backgroundColor: username.length < 3 ? 'rgba(139, 92, 246, 0.5)' : '#8b5cf6',
                borderRadius: 12,
                paddingVertical: 16,
              }}
            >
              <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 18 }}>
                Continue
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      );
    }

    // Step 2: Interests
    if (onboardingStep === 'interests') {
      return (
        <ScrollView 
          style={{ flex: 1, backgroundColor: '#0a0a0f' }}
          contentContainerStyle={{ padding: 24, paddingTop: 60 }}
        >
          {/* Progress */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 32 }}>
            <View style={{ flex: 1, height: 4, backgroundColor: '#8b5cf6', borderRadius: 2 }} />
            <View style={{ flex: 1, height: 4, backgroundColor: '#8b5cf6', borderRadius: 2 }} />
            <View style={{ flex: 1, height: 4, backgroundColor: '#2a2a3a', borderRadius: 2 }} />
            <View style={{ flex: 1, height: 4, backgroundColor: '#2a2a3a', borderRadius: 2 }} />
          </View>

          <Text style={{ fontSize: 48, marginBottom: 16 }}>🎯</Text>
          <Text style={{ color: 'white', fontSize: 28, fontWeight: 'bold', marginBottom: 8 }}>
            What interests you?
          </Text>
          <Text style={{ color: '#9ca3af', marginBottom: 32 }}>
            Select your favorite categories to personalize your experience
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 }}>
            {INTEREST_OPTIONS.map((option) => {
              const selected = interests.includes(option.id);
              return (
                <Pressable
                  key={option.id}
                  onPress={() => toggleInterest(option.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: selected ? 'rgba(139, 92, 246, 0.3)' : '#1a1a24',
                    borderWidth: 2,
                    borderColor: selected ? '#8b5cf6' : 'transparent',
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                  }}
                >
                  <Text style={{ fontSize: 24, marginRight: 8 }}>{option.emoji}</Text>
                  <Text style={{ color: 'white', fontWeight: '500' }}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={() => setOnboardingStep('username')}
              style={{
                flex: 1,
                backgroundColor: '#1a1a24',
                borderRadius: 12,
                paddingVertical: 16,
              }}
            >
              <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>Back</Text>
            </Pressable>
            <Pressable
              onPress={() => setOnboardingStep('age')}
              style={{
                flex: 2,
                backgroundColor: '#8b5cf6',
                borderRadius: 12,
                paddingVertical: 16,
              }}
            >
              <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 18 }}>
                Continue
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      );
    }

    // Step 3: Age Confirmation
    if (onboardingStep === 'age') {
      return (
        <ScrollView 
          style={{ flex: 1, backgroundColor: '#0a0a0f' }}
          contentContainerStyle={{ padding: 24, paddingTop: 60 }}
        >
          {/* Progress */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 32 }}>
            <View style={{ flex: 1, height: 4, backgroundColor: '#8b5cf6', borderRadius: 2 }} />
            <View style={{ flex: 1, height: 4, backgroundColor: '#8b5cf6', borderRadius: 2 }} />
            <View style={{ flex: 1, height: 4, backgroundColor: '#8b5cf6', borderRadius: 2 }} />
            <View style={{ flex: 1, height: 4, backgroundColor: '#2a2a3a', borderRadius: 2 }} />
          </View>

          <Text style={{ fontSize: 48, marginBottom: 16 }}>🔞</Text>
          <Text style={{ color: 'white', fontSize: 28, fontWeight: 'bold', marginBottom: 8 }}>
            Age Verification
          </Text>
          <Text style={{ color: '#9ca3af', marginBottom: 24 }}>
            Important information about betting on StarTrade
          </Text>

          {/* Info Cards */}
          <View style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <Text style={{ color: '#a78bfa', fontWeight: '600', marginBottom: 8 }}>🎮 Virtual Currency</Text>
            <Text style={{ color: '#9ca3af', fontSize: 14, lineHeight: 20 }}>
              All users can play with virtual currency ($1,000 to start). Compete on our leaderboard for monthly prizes!
            </Text>
          </View>

          <View style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
            <Text style={{ color: '#22c55e', fontWeight: '600', marginBottom: 8 }}>💵 Real USDC (21+ Only)</Text>
            <Text style={{ color: '#9ca3af', fontSize: 14, lineHeight: 20 }}>
              To bet with real cryptocurrency (USDC), you must be 21 or older and complete identity verification.
            </Text>
          </View>

          {/* Age Checkbox */}
          <Pressable
            onPress={() => setAgeConfirmed(!ageConfirmed)}
            style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 32 }}
          >
            <View style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              borderWidth: 2,
              borderColor: ageConfirmed ? '#8b5cf6' : '#4a4a5a',
              backgroundColor: ageConfirmed ? '#8b5cf6' : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
              marginTop: 2,
            }}>
              {ageConfirmed && <Text style={{ color: 'white', fontSize: 14 }}>✓</Text>}
            </View>
            <Text style={{ color: 'white', flex: 1, fontSize: 15, lineHeight: 22 }}>
              I confirm that I am at least 18 years old and understand that real currency betting requires age 21+ with ID verification.
            </Text>
          </Pressable>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={() => setOnboardingStep('interests')}
              style={{
                flex: 1,
                backgroundColor: '#1a1a24',
                borderRadius: 12,
                paddingVertical: 16,
              }}
            >
              <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>Back</Text>
            </Pressable>
            <Pressable
              onPress={() => setOnboardingStep('terms')}
              disabled={!ageConfirmed}
              style={{
                flex: 2,
                backgroundColor: ageConfirmed ? '#8b5cf6' : 'rgba(139, 92, 246, 0.5)',
                borderRadius: 12,
                paddingVertical: 16,
              }}
            >
              <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 18 }}>
                Continue
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      );
    }

    // Step 4: Terms & Complete
    if (onboardingStep === 'terms') {
      return (
        <ScrollView 
          style={{ flex: 1, backgroundColor: '#0a0a0f' }}
          contentContainerStyle={{ padding: 24, paddingTop: 60 }}
        >
          {/* Progress */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 32 }}>
            <View style={{ flex: 1, height: 4, backgroundColor: '#8b5cf6', borderRadius: 2 }} />
            <View style={{ flex: 1, height: 4, backgroundColor: '#8b5cf6', borderRadius: 2 }} />
            <View style={{ flex: 1, height: 4, backgroundColor: '#8b5cf6', borderRadius: 2 }} />
            <View style={{ flex: 1, height: 4, backgroundColor: '#8b5cf6', borderRadius: 2 }} />
          </View>

          <Text style={{ fontSize: 48, marginBottom: 16 }}>📜</Text>
          <Text style={{ color: 'white', fontSize: 28, fontWeight: 'bold', marginBottom: 8 }}>
            Terms of Service
          </Text>
          <Text style={{ color: '#9ca3af', marginBottom: 24 }}>
            Please review and accept our terms
          </Text>

          {error && (
            <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <Text style={{ color: '#ef4444', textAlign: 'center' }}>{error}</Text>
            </View>
          )}

          {/* Terms Summary */}
          <View style={{ backgroundColor: '#1a1a24', borderRadius: 12, padding: 16, marginBottom: 24 }}>
            <Text style={{ color: 'white', fontWeight: '600', marginBottom: 12 }}>Key Points:</Text>
            
            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
              <Text style={{ color: '#9ca3af', marginRight: 8 }}>•</Text>
              <Text style={{ color: '#9ca3af', flex: 1, fontSize: 14 }}>
                StarTrade is an entertainment prediction platform
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
              <Text style={{ color: '#9ca3af', marginRight: 8 }}>•</Text>
              <Text style={{ color: '#9ca3af', flex: 1, fontSize: 14 }}>
                Virtual currency has no real monetary value
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
              <Text style={{ color: '#9ca3af', marginRight: 8 }}>•</Text>
              <Text style={{ color: '#9ca3af', flex: 1, fontSize: 14 }}>
                Real currency betting is at your own risk
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
              <Text style={{ color: '#9ca3af', marginRight: 8 }}>•</Text>
              <Text style={{ color: '#9ca3af', flex: 1, fontSize: 14 }}>
                We may collect data to improve our services
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row' }}>
              <Text style={{ color: '#9ca3af', marginRight: 8 }}>•</Text>
              <Text style={{ color: '#9ca3af', flex: 1, fontSize: 14 }}>
                You must follow community guidelines
              </Text>
            </View>
          </View>

          {/* Terms Checkbox */}
          <Pressable
            onPress={() => setTermsAccepted(!termsAccepted)}
            style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 32 }}
          >
            <View style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              borderWidth: 2,
              borderColor: termsAccepted ? '#8b5cf6' : '#4a4a5a',
              backgroundColor: termsAccepted ? '#8b5cf6' : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
              marginTop: 2,
            }}>
              {termsAccepted && <Text style={{ color: 'white', fontSize: 14 }}>✓</Text>}
            </View>
            <Text style={{ color: 'white', flex: 1, fontSize: 15, lineHeight: 22 }}>
              I have read and agree to the Terms of Service and Privacy Policy
            </Text>
          </Pressable>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={() => setOnboardingStep('age')}
              style={{
                flex: 1,
                backgroundColor: '#1a1a24',
                borderRadius: 12,
                paddingVertical: 16,
              }}
            >
              <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>Back</Text>
            </Pressable>
            <Pressable
              onPress={handleCompleteOnboarding}
              disabled={!termsAccepted || savingProfile}
              style={{
                flex: 2,
                backgroundColor: termsAccepted && !savingProfile ? '#22c55e' : 'rgba(34, 197, 94, 0.5)',
                borderRadius: 12,
                paddingVertical: 16,
              }}
            >
              <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 18 }}>
                {savingProfile ? 'Creating Profile...' : '🚀 Start Playing'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      );
    }
  }

  return null;
}
