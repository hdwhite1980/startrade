import { create } from 'zustand';
import {
  getOrCreateWallet,
  getConnectedWallet,
  getWalletAddress,
  getBalance,
  clearWallet,
} from '@/lib/wallet';
import {
  getAvailableBalance,
  getEscrowedBalance,
  depositToEscrow,
  withdrawFromEscrow,
} from '@/lib/contracts';
import { ethers } from 'ethers';

interface WalletState {
  address: string | null;
  balance: string;
  escrowBalance: string;
  availableBalance: string;
  loading: boolean;
  error: Error | null;
  
  // Actions
  initialize: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  deposit: (amount: string) => Promise<{ error: Error | null; txHash?: string }>;
  withdraw: (amount: string) => Promise<{ error: Error | null; txHash?: string }>;
  refreshBalances: () => Promise<void>;
}

const BASE_RPC_URL = 'https://mainnet.base.org';

export const useWalletStore = create<WalletState>((set, get) => ({
  address: null,
  balance: '0',
  escrowBalance: '0',
  availableBalance: '0',
  loading: false,
  error: null,

  initialize: async () => {
    set({ loading: true });
    
    try {
      const addr = await getWalletAddress();
      
      if (addr) {
        set({ address: addr });
        await get().refreshBalances();
      }
    } catch (error) {
      set({ error: error as Error });
    } finally {
      set({ loading: false });
    }
  },

  connect: async () => {
    set({ loading: true, error: null });
    
    try {
      const wallet = await getOrCreateWallet();
      set({ address: wallet.address });
      await get().refreshBalances();
    } catch (error) {
      set({ error: error as Error });
    } finally {
      set({ loading: false });
    }
  },

  disconnect: async () => {
    await clearWallet();
    set({
      address: null,
      balance: '0',
      escrowBalance: '0',
      availableBalance: '0',
    });
  },

  deposit: async (amount) => {
    set({ loading: true, error: null });
    
    try {
      const wallet = await getConnectedWallet();
      if (!wallet) throw new Error('Wallet not connected');

      const tx = await depositToEscrow(wallet, amount);
      await tx.wait();
      
      await get().refreshBalances();
      set({ loading: false });
      
      return { error: null, txHash: tx.hash };
    } catch (error) {
      set({ loading: false, error: error as Error });
      return { error: error as Error };
    }
  },

  withdraw: async (amount) => {
    set({ loading: true, error: null });
    
    try {
      const wallet = await getConnectedWallet();
      if (!wallet) throw new Error('Wallet not connected');

      const tx = await withdrawFromEscrow(wallet, amount);
      await tx.wait();
      
      await get().refreshBalances();
      set({ loading: false });
      
      return { error: null, txHash: tx.hash };
    } catch (error) {
      set({ loading: false, error: error as Error });
      return { error: error as Error };
    }
  },

  refreshBalances: async () => {
    const addr = get().address;
    if (!addr) return;

    try {
      const bal = await getBalance();
      set({ balance: bal });

      const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
      const escrow = await getEscrowedBalance(provider, addr);
      const available = await getAvailableBalance(provider, addr);
      
      set({
        escrowBalance: escrow,
        availableBalance: available,
      });
    } catch (error) {
      console.error('Failed to refresh balances:', error);
    }
  },
}));
