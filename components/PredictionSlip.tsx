// StarTrade - Prediction Slip Component
// FOR ENTERTAINMENT PURPOSES ONLY - Uses fan tokens (virtual currency)
import { View, Text, TextInput, Pressable, Keyboard } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import type { PredictionChallenge } from '@/hooks/useMarkets';

interface PredictionSlipProps {
  challenge: PredictionChallenge;
  prediction: 'YES' | 'NO';
  sentiment: number;
  onClose: () => void;
}

/**
 * Make a prediction on a challenge
 */
async function makePrediction(
  challengeId: string, 
  prediction: 'YES' | 'NO', 
  tokensStaked: number,
  sentiment: number
): Promise<{ error: Error | null; predictionId?: string }> {
  const user = (await supabase.auth.getUser()).data.user;
  
  if (!user) {
    return { error: new Error('Not authenticated') };
  }

  if (tokensStaked < 10) {
    return { error: new Error('Minimum is 10 fan tokens') };
  }

  if (tokensStaked > 500) {
    return { error: new Error('Maximum is 500 fan tokens') };
  }

  // Calculate potential reward based on sentiment
  const potentialReward = Math.round(tokensStaked * (100 / sentiment));

  try {
    const { data, error } = await supabase
      .from('predictions')
      .insert({
        user_id: user.id,
        challenge_id: challengeId,
        prediction,
        fan_tokens_staked: tokensStaked,
        potential_reward: potentialReward,
        status: 'ACTIVE',
      })
      .select('id')
      .single();

    if (error) {
      return { error: new Error(error.message) };
    }

    // Deduct tokens from user profile
    const { error: updateError } = await supabase.rpc('deduct_fan_tokens', {
      user_id_param: user.id,
      amount_param: tokensStaked,
    });

    if (updateError) {
      // Rollback the prediction if we couldn't deduct tokens
      await supabase.from('predictions').delete().eq('id', data.id);
      return { error: new Error('Insufficient fan tokens') };
    }

    return { error: null, predictionId: data.id };
  } catch (err: any) {
    return { error: new Error(err.message || 'Failed to make prediction') };
  }
}

export default function PredictionSlip({ challenge, prediction, sentiment, onClose }: PredictionSlipProps) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [tokens, setTokens] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numTokens = parseInt(tokens) || 0;
  // Higher rewards for going against popular sentiment
  const potentialReward = numTokens > 0 ? Math.round(numTokens * (100 / sentiment)) : 0;
  const profit = potentialReward - numTokens;

  const quickAmounts = [50, 100, 200, 500];

  const handleMakePrediction = async () => {
    if (!user) {
      router.push('/auth');
      return;
    }

    if (numTokens < 10) {
      setError('Minimum is 10 fan tokens');
      return;
    }

    if (numTokens > 500) {
      setError('Maximum is 500 fan tokens');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await makePrediction(challenge.id, prediction, numTokens, sentiment);

    setLoading(false);

    if (result.error) {
      setError(result.error.message);
    } else {
      onClose();
    }
  };

  return (
    <View className="absolute bottom-0 left-0 right-0 bg-dark-900 rounded-t-3xl p-4 pb-8 border-t border-dark-800">
      {/* Handle */}
      <View className="w-12 h-1 bg-dark-700 rounded-full self-center mb-4" />
      
      {/* Header */}
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-white text-lg font-bold">Make Prediction</Text>
        <Pressable onPress={onClose}>
          <Text className="text-gray-400 text-xl">✕</Text>
        </Pressable>
      </View>

      {/* Entertainment Disclaimer */}
      <View className="bg-yellow-500/10 rounded-lg px-2 py-1 mb-4">
        <Text className="text-yellow-400 text-xs text-center">
          For entertainment only. Uses virtual fan tokens.
        </Text>
      </View>

      {/* Prediction */}
      <View className="flex-row items-center mb-4">
        <View className={`px-3 py-1 rounded-full ${
          prediction === 'YES' ? 'bg-green-500/20' : 'bg-red-500/20'
        }`}>
          <Text className={`font-bold ${
            prediction === 'YES' ? 'text-green-400' : 'text-red-400'
          }`}>
            {prediction}
          </Text>
        </View>
        <Text className="text-gray-400 ml-2 text-sm">
          {sentiment}% of fans agree
        </Text>
      </View>

      {/* Challenge Title */}
      <Text className="text-gray-400 text-sm mb-4" numberOfLines={2}>
        {challenge.title}
      </Text>

      {/* Fan Tokens Input */}
      <View className="mb-4">
        <Text className="text-gray-400 mb-2">Fan Tokens to Stake</Text>
        <View className="flex-row items-center bg-dark-800 rounded-xl px-4">
          <Text className="text-primary-400 text-2xl">🎫</Text>
          <TextInput
            value={tokens}
            onChangeText={setTokens}
            placeholder="0"
            placeholderTextColor="#6b7280"
            keyboardType="number-pad"
            className="flex-1 text-white text-2xl py-4 ml-2"
          />
        </View>
      </View>

      {/* Quick Amounts */}
      <View className="flex-row gap-2 mb-4">
        {quickAmounts.map((qa) => (
          <Pressable
            key={qa}
            onPress={() => {
              setTokens(qa.toString());
              Keyboard.dismiss();
            }}
            className={`flex-1 py-2 rounded-lg ${
              numTokens === qa ? 'bg-primary-500' : 'bg-dark-800'
            }`}
          >
            <Text className={`text-center font-medium ${
              numTokens === qa ? 'text-white' : 'text-gray-400'
            }`}>
              {qa}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Reward Info */}
      <View className="bg-dark-800 rounded-xl p-4 mb-4">
        <View className="flex-row justify-between mb-2">
          <Text className="text-gray-400">Potential Reward</Text>
          <Text className="text-white font-bold">🎫 {potentialReward}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-gray-400">Potential Profit</Text>
          <Text className="text-green-400 font-bold">+{profit} tokens</Text>
        </View>
        <Text className="text-gray-600 text-xs mt-2">
          Going against popular sentiment = higher rewards!
        </Text>
      </View>

      {/* Error */}
      {error && (
        <View className="bg-red-500/20 rounded-lg p-3 mb-4">
          <Text className="text-red-400 text-center">{error}</Text>
        </View>
      )}

      {/* Make Prediction Button */}
      <Pressable
        onPress={handleMakePrediction}
        disabled={loading || numTokens <= 0}
        className={`rounded-xl py-4 ${
          loading || numTokens <= 0 
            ? 'bg-primary-500/50' 
            : 'bg-primary-500'
        }`}
      >
        <Text className="text-white text-center font-bold text-lg">
          {loading 
            ? 'Submitting...' 
            : !user 
              ? 'Sign In to Predict'
              : numTokens <= 0 
                ? 'Enter Fan Tokens' 
                : `Predict ${prediction} with 🎫 ${numTokens}`}
        </Text>
      </Pressable>
    </View>
  );
}
