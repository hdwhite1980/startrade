import { useState, useEffect, useCallback } from 'react';
import {
  getOrCreateWallet,
  getConnectedWallet,
  getWalletAddress,
  getBalance,
  clearWallet,
  signMessage,
  exportPrivateKey,
  importWallet,
} from '@/lib/wallet';
import {
  getAvailableBalance,
  getEscrowedBalance,
  depositToEscrow,
  withdrawFromEscrow,
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
  deposit: (amount: string) => Promise<{ error: Error | null; txHash?: string }>;
  withdraw: (amount: string) => Promise<{ error: Error | null; txHash?: string }>;
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
      const addr = await getWalletAddress();
      setAddress(addr);

      if (addr) {
        // Fetch ETH balance
        const bal = await getBalance();
        setBalance(bal);

        // Fetch escrow balances
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
        const escrow = await getEscrowedBalance(provider, addr);
        const available = await getAvailableBalance(provider, addr);
        
        setEscrowBalance(escrow);
        setAvailableBalance(available);
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
      const wallet = await getOrCreateWallet();
      setAddress(wallet.address);
      await fetchWalletData();
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    await clearWallet();
    setAddress(null);
    setBalance('0');
    setEscrowBalance('0');
    setAvailableBalance('0');
  };

  const deposit = async (amount: string) => {
    try {
      const wallet = await getConnectedWallet();
      if (!wallet) throw new Error('Wallet not connected');

      const tx = await depositToEscrow(wallet, amount);
      await tx.wait();
      
      await fetchWalletData();
      return { error: null, txHash: tx.hash };
    } catch (e) {
      return { error: e as Error };
    }
  };

  const withdraw = async (amount: string) => {
    try {
      const wallet = await getConnectedWallet();
      if (!wallet) throw new Error('Wallet not connected');

      const tx = await withdrawFromEscrow(wallet, amount);
      await tx.wait();
      
      await fetchWalletData();
      return { error: null, txHash: tx.hash };
    } catch (e) {
      return { error: e as Error };
    }
  };

  const sign = async (message: string) => {
    return signMessage(message);
  };

  const exportKey = async () => {
    return exportPrivateKey();
  };

  const importKey = async (privateKey: string) => {
    try {
      await importWallet(privateKey);
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
    deposit,
    withdraw,
    sign,
    exportKey,
    importKey,
    refetch: fetchWalletData,
  };
}
