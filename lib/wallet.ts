import 'react-native-get-random-values';
import '@ethersproject/shims';
import { ethers } from 'ethers';
import * as SecureStore from 'expo-secure-store';

const WALLET_KEY = 'startrade_wallet';
const BASE_RPC_URL = 'https://mainnet.base.org';

export interface WalletInfo {
  address: string;
  balance: string;
  escrowBalance: string;
}

/**
 * Get or create a wallet stored securely on device
 */
export async function getOrCreateWallet(): Promise<ethers.Wallet> {
  const storedKey = await SecureStore.getItemAsync(WALLET_KEY);
  
  if (storedKey) {
    return new ethers.Wallet(storedKey);
  }
  
  // Create new wallet
  const wallet = ethers.Wallet.createRandom();
  await SecureStore.setItemAsync(WALLET_KEY, wallet.privateKey);
  
  return wallet;
}

/**
 * Get connected wallet with provider
 */
export async function getConnectedWallet(): Promise<ethers.Wallet | null> {
  const storedKey = await SecureStore.getItemAsync(WALLET_KEY);
  
  if (!storedKey) return null;
  
  const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
  return new ethers.Wallet(storedKey, provider);
}

/**
 * Get wallet address without full connection
 */
export async function getWalletAddress(): Promise<string | null> {
  const storedKey = await SecureStore.getItemAsync(WALLET_KEY);
  
  if (!storedKey) return null;
  
  const wallet = new ethers.Wallet(storedKey);
  return wallet.address;
}

/**
 * Get ETH balance for connected wallet
 */
export async function getBalance(): Promise<string> {
  const wallet = await getConnectedWallet();
  
  if (!wallet) return '0';
  
  const balance = await wallet.provider?.getBalance(wallet.address);
  return ethers.formatEther(balance || 0);
}

/**
 * Clear stored wallet (for testing/logout)
 */
export async function clearWallet(): Promise<void> {
  await SecureStore.deleteItemAsync(WALLET_KEY);
}

/**
 * Sign a message with the wallet
 */
export async function signMessage(message: string): Promise<string | null> {
  const wallet = await getConnectedWallet();
  
  if (!wallet) return null;
  
  return wallet.signMessage(message);
}

/**
 * Export wallet private key (handle with extreme care!)
 */
export async function exportPrivateKey(): Promise<string | null> {
  const storedKey = await SecureStore.getItemAsync(WALLET_KEY);
  return storedKey;
}

/**
 * Import wallet from private key
 */
export async function importWallet(privateKey: string): Promise<ethers.Wallet> {
  const wallet = new ethers.Wallet(privateKey);
  await SecureStore.setItemAsync(WALLET_KEY, privateKey);
  return wallet;
}
