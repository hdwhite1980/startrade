import { useState, useEffect, useCallback } from 'react';
import {
  getOrCreateEmbeddedWallet,
  getEmbeddedWallet,
  getStoredWalletState,
  getETHBalance,
  clearWalletConnection,
  signMessageWithEmbedded,
  exportEmbeddedPrivateKey,
  importWalletFromPrivateKey,
  getWalletBalances,
} from '@/lib/wallet';
import {
  getUSDCBalance,
  getEscrowBalance,
} from '@/lib/contracts';
import { ethers } from 'ethers';

interface UseWalletReturn {
  address: string | null;
  balance: string;
  escrowBalance: string;
  availableBalance: string;
  loading: boolean;
  error: Error | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sign: (message: string) => Promise<string | null>;
  exportKey: () => Promise<string | null>;
  importKey: (privateKey: string) => Promise<{ error: Error | null }>;
  refetch: () => Promise<void>;
}

export function useWallet(): UseWalletReturn {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState('0');
  const [escrowBalance, setEscrowBalance] = useState('0');
  const [availableBalance, setAvailableBalance] = useState('0');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWalletData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const state = await getStoredWalletState();
      setAddress(state.address);

      if (state.address) {
        // Fetch balances
        const balances = await getWalletBalances(state.address);
        setBalance(balances.eth);
        setEscrowBalance(balances.escrowTotal);
        setAvailableBalance(balances.escrowAvailable);
      }
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  const connect = async () => {
    setLoading(true);
    try {
      const wallet = await getOrCreateEmbeddedWallet();
      setAddress(wallet.address);
      await fetchWalletData();
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    await clearWalletConnection();
    setAddress(null);
    setBalance('0');
    setEscrowBalance('0');
    setAvailableBalance('0');
  };

  const sign = async (message: string) => {
    return signMessageWithEmbedded(message);
  };

  const exportKey = async () => {
    return exportEmbeddedPrivateKey();
  };

  const importKey = async (privateKey: string) => {
    try {
      await importWalletFromPrivateKey(privateKey);
      await fetchWalletData();
      return { error: null };
    } catch (e) {
      return { error: e as Error };
    }
  };

  return {
    address,
    balance,
    escrowBalance,
    availableBalance,
    loading,
    error,
    connect,
    disconnect,
    sign,
    exportKey,
    importKey,
    refetch: fetchWalletData,
  };
}
