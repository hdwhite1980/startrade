// USDC Deposit Component
import { View, Text, TextInput, Pressable, ActivityIndicator, Linking } from 'react-native';
import { useState } from 'react';
import { useWalletStore } from '@/stores/walletStore';
import { getTransactionUrl } from '@/lib/contracts';

interface DepositProps {
  onClose: () => void;
}

export default function Deposit({ onClose }: DepositProps) {
  const { 
    deposit, 
    balances, 
    depositLimits, 
    depositing,
    hasInfiniteApproval,
    approveUSDC,
    approving,
  } = useWalletStore();
  
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const quickAmounts = ['5', '10', '25', '50'];

  const handleDeposit = async () => {
    const numAmount = parseFloat(amount);
    
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (numAmount > parseFloat(balances.usdc)) {
      setError('Insufficient USDC balance in wallet');
      return;
    }

    if (depositLimits && numAmount > parseFloat(depositLimits.remainingToday)) {
      setError(`Daily limit: $${depositLimits.remainingToday} remaining`);
      return;
    }

    setError(null);
    const result = await deposit(amount);

    if (result.success) {
      setSuccess(true);
      setTxHash(result.txHash || null);
      setTimeout(() => {
        onClose();
      }, 3000);
    } else {
      setError(result.error || 'Deposit failed');
    }
  };

  const handleApprove = async () => {
    setError(null);
    const result = await approveUSDC();
    if (!result.success) {
      setError(result.error || 'Approval failed');
    }
  };

  const openTransaction = () => {
    if (txHash) {
      Linking.openURL(getTransactionUrl(txHash));
    }
  };

  if (success) {
    return (
      <View className="bg-gray-900 rounded-2xl p-6 items-center">
        <Text className="text-4xl mb-4">✅</Text>
        <Text className="text-white text-xl font-bold mb-2">Deposit Successful!</Text>
        <Text className="text-gray-400 mb-4">
          ${amount} USDC added to your balance
        </Text>
        {txHash && (
          <Pressable onPress={openTransaction}>
            <Text className="text-purple-400 underline">View Transaction</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View className="bg-gray-900 rounded-2xl p-4">
      {/* Header */}
      <View className="flex-row justify-between items-center mb-4">
        <View>
          <Text className="text-white text-xl font-bold">Deposit USDC</Text>
          <Text className="text-gray-500 text-sm">Base Network</Text>
        </View>
        <Pressable onPress={onClose} className="p-2">
          <Text className="text-gray-400 text-xl">✕</Text>
        </Pressable>
      </View>

      {/* Wallet Balance */}
      <View className="bg-gray-800 rounded-xl p-4 mb-4">
        <Text className="text-gray-400 text-sm mb-1">Wallet Balance</Text>
        <View className="flex-row items-baseline">
          <Text className="text-white text-2xl font-bold">
            ${parseFloat(balances.usdc).toFixed(2)}
          </Text>
          <Text className="text-gray-500 ml-2">USDC</Text>
        </View>
      </View>

      {/* Daily Limits */}
      {depositLimits && (
        <View className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 mb-4">
          <View className="flex-row justify-between">
            <Text className="text-blue-400 text-sm">Daily Limit</Text>
            <Text className="text-blue-400 text-sm">
              ${parseFloat(depositLimits.dailyUsed).toFixed(2)} / ${parseFloat(depositLimits.dailyLimit).toFixed(2)}
            </Text>
          </View>
          <View className="bg-blue-500/20 h-2 rounded-full mt-2 overflow-hidden">
            <View 
              className="bg-blue-500 h-full rounded-full"
              style={{ 
                width: `${(parseFloat(depositLimits.dailyUsed) / parseFloat(depositLimits.dailyLimit)) * 100}%` 
              }}
            />
          </View>
          <Text className="text-blue-300 text-xs mt-1">
            ${parseFloat(depositLimits.remainingToday).toFixed(2)} remaining today
          </Text>
        </View>
      )}

      {/* Amount Input */}
      <View className="mb-4">
        <Text className="text-gray-400 mb-2">Amount</Text>
        <View className="flex-row items-center bg-gray-800 rounded-xl px-4">
          <Text className="text-gray-500 text-xl mr-2">$</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor="#6b7280"
            keyboardType="decimal-pad"
            className="flex-1 text-white text-2xl py-4"
          />
          <Text className="text-gray-400 font-medium">USDC</Text>
        </View>
      </View>

      {/* Quick Amounts */}
      <View className="flex-row gap-2 mb-4">
        {quickAmounts.map((qa) => (
          <Pressable
            key={qa}
            onPress={() => setAmount(qa)}
            className={`flex-1 py-3 rounded-lg border ${
              amount === qa 
                ? 'bg-purple-500/20 border-purple-500' 
                : 'bg-gray-800 border-gray-700'
            }`}
          >
            <Text className={`text-center font-semibold ${
              amount === qa ? 'text-purple-400' : 'text-gray-400'
            }`}>
              ${qa}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Error */}
      {error && (
        <View className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mb-4">
          <Text className="text-red-400 text-center">{error}</Text>
        </View>
      )}

      {/* Approval needed? */}
      {!hasInfiniteApproval && parseFloat(amount) > 0 && (
        <Pressable
          onPress={handleApprove}
          disabled={approving}
          className={`rounded-xl py-4 mb-3 border ${
            approving 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-purple-500/20 border-purple-500'
          }`}
        >
          {approving ? (
            <ActivityIndicator color="#a855f7" />
          ) : (
            <Text className="text-purple-400 text-center font-bold">
              ① Approve USDC (One-time)
            </Text>
          )}
        </Pressable>
      )}

      {/* Deposit Button */}
      <Pressable
        onPress={handleDeposit}
        disabled={depositing || !amount || parseFloat(amount) <= 0}
        className={`rounded-xl py-4 ${
          depositing || !amount || parseFloat(amount) <= 0
            ? 'bg-purple-500/30' 
            : 'bg-purple-500'
        }`}
      >
        {depositing ? (
          <View className="flex-row items-center justify-center">
            <ActivityIndicator color="white" />
            <Text className="text-white ml-2">Processing...</Text>
          </View>
        ) : (
          <Text className="text-white text-center font-bold text-lg">
            {hasInfiniteApproval ? '' : '② '}Deposit ${amount || '0'} USDC
          </Text>
        )}
      </Pressable>

      {/* Info */}
      <View className="mt-4 space-y-2">
        <View className="flex-row items-center">
          <Text className="text-gray-500 text-xs">⚡</Text>
          <Text className="text-gray-500 text-xs ml-2">
            Deposits are instant on Base (~2 seconds)
          </Text>
        </View>
        <View className="flex-row items-center">
          <Text className="text-gray-500 text-xs">💰</Text>
          <Text className="text-gray-500 text-xs ml-2">
            Gas fees: ~$0.01-0.05
          </Text>
        </View>
        <View className="flex-row items-center">
          <Text className="text-gray-500 text-xs">🔒</Text>
          <Text className="text-gray-500 text-xs ml-2">
            Min: $1 • Max: ${depositLimits?.max || '100'} daily
          </Text>
        </View>
      </View>

      {/* KYC Upgrade */}
      {depositLimits && parseFloat(depositLimits.dailyLimit) < 10000 && (
        <View className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
          <Text className="text-yellow-400 text-sm font-medium">
            ⬆️ Verify identity to increase limit to $10,000
          </Text>
        </View>
      )}
    </View>
  );
}
