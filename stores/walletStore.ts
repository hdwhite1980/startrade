// StarTrade Wallet Store - USDC on Base
import { create } from 'zustand';
import { ethers } from 'ethers';
import {
  getOrCreateEmbeddedWallet,
  getEmbeddedWallet,
  getStoredWalletState,
  storeExternalWalletConnection,
  clearWalletConnection,
  getWalletBalances,
  WalletType,
  WalletBalances,
} from '@/lib/wallet';
import {
  getProvider,
  approveUSDC,
  approveMaxUSDC,
  depositUSDC,
  withdrawUSDC,
  getUSDCAllowance,
  hasEnoughAllowance,
  getDepositLimits,
  parseUSDC,
  formatUSDCAmount,
  ADDRESSES,
  waitForTransaction,
} from '@/lib/contracts';

// =====================================================
// TYPES
// =====================================================

interface WalletState {
  // Connection
  address: string | null;
  walletType: WalletType | null;
  connected: boolean;
  chainId: number | null;
  
  // Balances
  balances: WalletBalances;
  
  // Limits
  depositLimits: {
    min: string;
    max: string;
    dailyLimit: string;
    dailyUsed: string;
    remainingToday: string;
  } | null;
  
  // USDC allowance
  allowance: string;
  hasInfiniteApproval: boolean;
  
  // Loading states
  loading: boolean;
  depositing: boolean;
  withdrawing: boolean;
  approving: boolean;
  
  // Error
  error: Error | null;
  
  // Actions
  initialize: () => Promise<void>;
  connectEmbedded: () => Promise<void>;
  connectExternal: (address: string, type: 'coinbase' | 'walletconnect') => Promise<void>;
  disconnect: () => Promise<void>;
  refreshBalances: () => Promise<void>;
  refreshLimits: () => Promise<void>;
  approveUSDC: (amount?: string) => Promise<{ success: boolean; txHash?: string; error?: string }>;
  deposit: (amount: string) => Promise<{ success: boolean; txHash?: string; error?: string }>;
  withdraw: (amount: string) => Promise<{ success: boolean; txHash?: string; error?: string }>;
}

// Default balances
const defaultBalances: WalletBalances = {
  eth: '0',
  usdc: '0',
  escrowTotal: '0',
  escrowAvailable: '0',
  escrowLocked: '0',
};

// =====================================================
// STORE
// =====================================================

export const useWalletStore = create<WalletState>((set, get) => ({
  // Initial state
  address: null,
  walletType: null,
  connected: false,
  chainId: null,
  balances: defaultBalances,
  depositLimits: null,
  allowance: '0',
  hasInfiniteApproval: false,
  loading: false,
  depositing: false,
  withdrawing: false,
  approving: false,
  error: null,

  // Initialize wallet from storage
  initialize: async () => {
    set({ loading: true, error: null });
    
    try {
      const state = await getStoredWalletState();
      
      if (state.connected && state.address) {
        set({
          address: state.address,
          walletType: state.type,
          connected: true,
          chainId: state.chainId,
        });
        
        // Fetch balances
        await get().refreshBalances();
        await get().refreshLimits();
      }
    } catch (error) {
      console.error('Failed to initialize wallet:', error);
      set({ error: error as Error });
    } finally {
      set({ loading: false });
    }
  },

  // Connect embedded wallet
  connectEmbedded: async () => {
    set({ loading: true, error: null });
    
    try {
      const wallet = await getOrCreateEmbeddedWallet();
      
      set({
        address: wallet.address,
        walletType: 'embedded',
        connected: true,
        chainId: 84532, // Base Sepolia
      });
      
      await get().refreshBalances();
      await get().refreshLimits();
    } catch (error) {
      console.error('Failed to connect embedded wallet:', error);
      set({ error: error as Error });
    } finally {
      set({ loading: false });
    }
  },

  // Connect external wallet (Coinbase/WalletConnect)
  connectExternal: async (address, type) => {
    set({ loading: true, error: null });
    
    try {
      await storeExternalWalletConnection(address, type);
      
      set({
        address,
        walletType: type,
        connected: true,
        chainId: 84532, // Base Sepolia
      });
      
      await get().refreshBalances();
      await get().refreshLimits();
    } catch (error) {
      console.error('Failed to connect external wallet:', error);
      set({ error: error as Error });
    } finally {
      set({ loading: false });
    }
  },

  // Disconnect wallet
  disconnect: async () => {
    await clearWalletConnection();
    set({
      address: null,
      walletType: null,
      connected: false,
      chainId: null,
      balances: defaultBalances,
      depositLimits: null,
      allowance: '0',
      hasInfiniteApproval: false,
    });
  },

  // Refresh balances
  refreshBalances: async () => {
    const { address, walletType } = get();
    if (!address) return;

    try {
      const balances = await getWalletBalances(address);
      set({ balances });

      // Check allowance
      const provider = getProvider();
      const allowance = await getUSDCAllowance(provider, address);
      const formattedAllowance = formatUSDCAmount(allowance);
      const hasInfinite = allowance >= ethers.MaxUint256 / BigInt(2);
      
      set({
        allowance: formattedAllowance,
        hasInfiniteApproval: hasInfinite,
      });
    } catch (error) {
      console.error('Failed to refresh balances:', error);
    }
  },

  // Refresh deposit limits
  refreshLimits: async () => {
    const { address } = get();
    if (!address) return;

    try {
      const provider = getProvider();
      const limits = await getDepositLimits(provider, address);
      
      set({
        depositLimits: {
          min: formatUSDCAmount(limits.minDeposit),
          max: formatUSDCAmount(limits.maxDeposit),
          dailyLimit: formatUSDCAmount(limits.dailyLimit),
          dailyUsed: formatUSDCAmount(limits.dailyUsed),
          remainingToday: formatUSDCAmount(limits.remainingToday),
        },
      });
    } catch (error) {
      console.error('Failed to refresh limits:', error);
    }
  },

  // Approve USDC spending
  approveUSDC: async (amount) => {
    const { walletType } = get();
    set({ approving: true, error: null });

    try {
      // Only embedded wallet can sign directly
      if (walletType !== 'embedded') {
        return {
          success: false,
          error: 'External wallets must approve via their app',
        };
      }

      const wallet = await getEmbeddedWallet();
      if (!wallet) {
        return { success: false, error: 'Wallet not available' };
      }

      // Infinite approval if no amount specified
      const tx = amount
        ? await approveUSDC(wallet, parseUSDC(amount))
        : await approveMaxUSDC(wallet);

      const receipt = await waitForTransaction(tx);
      
      if (receipt?.status === 1) {
        await get().refreshBalances();
        return { success: true, txHash: tx.hash };
      } else {
        return { success: false, error: 'Transaction failed' };
      }
    } catch (error: any) {
      console.error('Approve failed:', error);
      set({ error });
      return { success: false, error: error.message || 'Approval failed' };
    } finally {
      set({ approving: false });
    }
  },

  // Deposit USDC
  deposit: async (amount) => {
    const { walletType, address, balances, depositLimits } = get();
    set({ depositing: true, error: null });

    try {
      // Validate amount
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return { success: false, error: 'Invalid amount' };
      }

      // Check wallet balance
      if (amountNum > parseFloat(balances.usdc)) {
        return { success: false, error: 'Insufficient USDC balance' };
      }

      // Check deposit limits
      if (depositLimits) {
        if (amountNum < parseFloat(depositLimits.min)) {
          return { success: false, error: `Minimum deposit is $${depositLimits.min}` };
        }
        if (amountNum > parseFloat(depositLimits.remainingToday)) {
          return { success: false, error: `Daily limit exceeded. Remaining: $${depositLimits.remainingToday}` };
        }
      }

      // Only embedded wallet can sign directly
      if (walletType !== 'embedded') {
        return {
          success: false,
          error: 'External wallets must deposit via their app',
        };
      }

      const wallet = await getEmbeddedWallet();
      if (!wallet) {
        return { success: false, error: 'Wallet not available' };
      }

      // Check allowance first
      const provider = getProvider();
      const depositAmount = parseUSDC(amount);
      const hasAllowance = await hasEnoughAllowance(provider, address!, depositAmount);

      if (!hasAllowance) {
        // Auto-approve if needed
        const approveTx = await approveMaxUSDC(wallet);
        await waitForTransaction(approveTx);
      }

      // Execute deposit
      const tx = await depositUSDC(wallet, depositAmount);
      const receipt = await waitForTransaction(tx);

      if (receipt?.status === 1) {
        await get().refreshBalances();
        await get().refreshLimits();
        return { success: true, txHash: tx.hash };
      } else {
        return { success: false, error: 'Transaction failed' };
      }
    } catch (error: any) {
      console.error('Deposit failed:', error);
      set({ error });
      return { success: false, error: error.message || 'Deposit failed' };
    } finally {
      set({ depositing: false });
    }
  },

  // Withdraw USDC
  withdraw: async (amount) => {
    const { walletType, balances } = get();
    set({ withdrawing: true, error: null });

    try {
      // Validate amount
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return { success: false, error: 'Invalid amount' };
      }

      // Check escrow balance
      if (amountNum > parseFloat(balances.escrowAvailable)) {
        return { success: false, error: 'Insufficient available balance' };
      }

      // Only embedded wallet can sign directly
      if (walletType !== 'embedded') {
        return {
          success: false,
          error: 'External wallets must withdraw via their app',
        };
      }

      const wallet = await getEmbeddedWallet();
      if (!wallet) {
        return { success: false, error: 'Wallet not available' };
      }

      const tx = await withdrawUSDC(wallet, parseUSDC(amount));
      const receipt = await waitForTransaction(tx);

      if (receipt?.status === 1) {
        await get().refreshBalances();
        return { success: true, txHash: tx.hash };
      } else {
        return { success: false, error: 'Transaction failed' };
      }
    } catch (error: any) {
      console.error('Withdraw failed:', error);
      set({ error });
      return { success: false, error: error.message || 'Withdrawal failed' };
    } finally {
      set({ withdrawing: false });
    }
  },
}));
