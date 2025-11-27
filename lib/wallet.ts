// StarTrade Wallet Library - Coinbase Wallet + WalletConnect
import 'react-native-get-random-values';
import { ethers } from 'ethers';
import * as SecureStore from 'expo-secure-store';
import { CHAIN_CONFIG, getProvider, getUSDCBalance, getEscrowBalance } from './contracts';

// =====================================================
// TYPES
// =====================================================

export type WalletType = 'embedded' | 'coinbase' | 'walletconnect';

export interface WalletState {
  address: string | null;
  type: WalletType | null;
  connected: boolean;
  chainId: number | null;
}

export interface WalletBalances {
  eth: string;
  usdc: string;
  escrowTotal: string;
  escrowAvailable: string;
  escrowLocked: string;
}

// =====================================================
// STORAGE KEYS
// =====================================================

const WALLET_KEY = 'startrade_embedded_wallet';
const WALLET_TYPE_KEY = 'startrade_wallet_type';
const CONNECTED_ADDRESS_KEY = 'startrade_connected_address';

// =====================================================
// EMBEDDED WALLET (For users without external wallet)
// =====================================================

/**
 * Create or retrieve embedded wallet stored securely on device
 * This is a custodial-lite solution for users without Coinbase Wallet
 */
export async function getOrCreateEmbeddedWallet(): Promise<ethers.Wallet> {
  const storedKey = await SecureStore.getItemAsync(WALLET_KEY);
  
  if (storedKey) {
    const provider = getProvider();
    return new ethers.Wallet(storedKey, provider);
  }
  
  // Create new wallet
  const randomWallet = ethers.Wallet.createRandom();
  await SecureStore.setItemAsync(WALLET_KEY, randomWallet.privateKey);
  await SecureStore.setItemAsync(WALLET_TYPE_KEY, 'embedded');
  await SecureStore.setItemAsync(CONNECTED_ADDRESS_KEY, randomWallet.address);
  
  return new ethers.Wallet(randomWallet.privateKey, getProvider());
}

/**
 * Get connected embedded wallet
 */
export async function getEmbeddedWallet(): Promise<ethers.Wallet | null> {
  const storedKey = await SecureStore.getItemAsync(WALLET_KEY);
  if (!storedKey) return null;
  
  const provider = getProvider();
  return new ethers.Wallet(storedKey, provider);
}

/**
 * Export embedded wallet private key (for backup - handle with care!)
 */
export async function exportEmbeddedPrivateKey(): Promise<string | null> {
  return SecureStore.getItemAsync(WALLET_KEY);
}

/**
 * Import wallet from private key (for recovery)
 */
export async function importWalletFromPrivateKey(privateKey: string): Promise<ethers.Wallet> {
  const wallet = new ethers.Wallet(privateKey);
  await SecureStore.setItemAsync(WALLET_KEY, privateKey);
  await SecureStore.setItemAsync(WALLET_TYPE_KEY, 'embedded');
  await SecureStore.setItemAsync(CONNECTED_ADDRESS_KEY, wallet.address);
  
  return wallet.connect(getProvider());
}

// =====================================================
// WALLET STATE MANAGEMENT
// =====================================================

/**
 * Get stored wallet state
 */
export async function getStoredWalletState(): Promise<WalletState> {
  const [type, address] = await Promise.all([
    SecureStore.getItemAsync(WALLET_TYPE_KEY),
    SecureStore.getItemAsync(CONNECTED_ADDRESS_KEY),
  ]);

  return {
    address,
    type: type as WalletType | null,
    connected: !!address,
    chainId: address ? CHAIN_CONFIG.chainId : null,
  };
}

/**
 * Store external wallet connection (Coinbase/WalletConnect)
 */
export async function storeExternalWalletConnection(
  address: string,
  type: 'coinbase' | 'walletconnect'
): Promise<void> {
  await SecureStore.setItemAsync(WALLET_TYPE_KEY, type);
  await SecureStore.setItemAsync(CONNECTED_ADDRESS_KEY, address);
}

/**
 * Clear wallet connection
 */
export async function clearWalletConnection(): Promise<void> {
  // Only clear connection info, not the embedded wallet key
  // (user may want to reconnect later)
  const walletType = await SecureStore.getItemAsync(WALLET_TYPE_KEY);
  
  if (walletType === 'embedded') {
    // For embedded, also clear the private key
    await SecureStore.deleteItemAsync(WALLET_KEY);
  }
  
  await SecureStore.deleteItemAsync(WALLET_TYPE_KEY);
  await SecureStore.deleteItemAsync(CONNECTED_ADDRESS_KEY);
}

// =====================================================
// BALANCE FETCHING
// =====================================================

/**
 * Get all balances for an address
 */
export async function getWalletBalances(address: string): Promise<WalletBalances> {
  const provider = getProvider();
  
  const [ethBalance, usdcBalance, escrowBalances] = await Promise.all([
    provider.getBalance(address),
    getUSDCBalance(provider, address),
    getEscrowBalance(provider, address),
  ]);

  return {
    eth: ethers.formatEther(ethBalance),
    usdc: ethers.formatUnits(usdcBalance, 6),
    escrowTotal: ethers.formatUnits(escrowBalances.total, 6),
    escrowAvailable: ethers.formatUnits(escrowBalances.available, 6),
    escrowLocked: ethers.formatUnits(escrowBalances.escrowed, 6),
  };
}

/**
 * Get ETH balance (for gas)
 */
export async function getETHBalance(address: string): Promise<string> {
  const provider = getProvider();
  const balance = await provider.getBalance(address);
  return ethers.formatEther(balance);
}

// =====================================================
// SIGNING
// =====================================================

/**
 * Sign a message with embedded wallet
 */
export async function signMessageWithEmbedded(message: string): Promise<string | null> {
  const wallet = await getEmbeddedWallet();
  if (!wallet) return null;
  return wallet.signMessage(message);
}

/**
 * Sign typed data (EIP-712) with embedded wallet
 */
export async function signTypedDataWithEmbedded(
  domain: ethers.TypedDataDomain,
  types: Record<string, ethers.TypedDataField[]>,
  value: Record<string, unknown>
): Promise<string | null> {
  const wallet = await getEmbeddedWallet();
  if (!wallet) return null;
  return wallet.signTypedData(domain, types, value);
}

// =====================================================
// ADDRESS UTILITIES
// =====================================================

/**
 * Shorten address for display
 */
export function shortenAddress(address: string, chars: number = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Validate Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return ethers.isAddress(address);
}

/**
 * Checksum address
 */
export function checksumAddress(address: string): string {
  return ethers.getAddress(address);
}

// =====================================================
// COINBASE WALLET SDK CONFIG
// =====================================================

// Coinbase Wallet SDK configuration
// You'll need to initialize this with @coinbase/wallet-sdk
export const COINBASE_WALLET_CONFIG = {
  appName: 'StarTrade',
  appLogoUrl: 'https://startrade.app/logo.png', // Update with real URL
  chainIds: [CHAIN_CONFIG.chainId],
  darkMode: true,
};

// WalletConnect configuration
export const WALLETCONNECT_CONFIG = {
  projectId: process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID || '', // Get from cloud.walletconnect.com
  metadata: {
    name: 'StarTrade',
    description: 'Celebrity Prediction Markets',
    url: 'https://startrade.app',
    icons: ['https://startrade.app/logo.png'],
  },
  chains: [CHAIN_CONFIG.chainId],
};

// =====================================================
// NETWORK UTILITIES
// =====================================================

/**
 * Check if we need to switch networks
 */
export function needsNetworkSwitch(currentChainId: number): boolean {
  return currentChainId !== CHAIN_CONFIG.chainId;
}

/**
 * Get chain switch params for wallet
 */
export function getAddChainParams() {
  return {
    chainId: `0x${CHAIN_CONFIG.chainId.toString(16)}`,
    chainName: CHAIN_CONFIG.name,
    nativeCurrency: CHAIN_CONFIG.nativeCurrency,
    rpcUrls: [CHAIN_CONFIG.rpcUrl],
    blockExplorerUrls: [CHAIN_CONFIG.blockExplorer],
  };
}
