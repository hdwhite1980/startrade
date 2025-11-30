// StarTrade - Wallet Configuration
// Coinbase Wallet + WalletConnect for Base L2

import { http, createConfig } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { coinbaseWallet, walletConnect, injected } from 'wagmi/connectors';

// =============================================================
// CONFIGURATION - UPDATE THESE VALUES
// =============================================================

// Get your WalletConnect Project ID from https://cloud.walletconnect.com/
const WALLETCONNECT_PROJECT_ID = process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

// Your app metadata (shown in wallet connection prompts)
const APP_NAME = 'StarTrade';
const APP_DESCRIPTION = 'Celebrity Prediction Markets with Real USDC';
const APP_URL = 'https://startrade.app'; // Update with your actual URL
const APP_ICON = 'https://startrade.app/icon.png'; // Update with your actual icon

// Use testnet for development, mainnet for production
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ACTIVE_CHAIN = IS_PRODUCTION ? base : baseSepolia;

// =============================================================
// CONTRACT ADDRESSES ON BASE
// =============================================================

export const CONTRACTS = {
  // USDC on Base Mainnet
  USDC_BASE_MAINNET: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  // USDC on Base Sepolia (testnet)
  USDC_BASE_SEPOLIA: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  // StarTrade Treasury (where bets are escrowed) - YOU NEED TO DEPLOY THIS
  TREASURY: process.env.EXPO_PUBLIC_TREASURY_ADDRESS || '0x0000000000000000000000000000000000000000',
};

// Get the right USDC address based on environment
export const USDC_ADDRESS = IS_PRODUCTION 
  ? CONTRACTS.USDC_BASE_MAINNET 
  : CONTRACTS.USDC_BASE_SEPOLIA;

// =============================================================
// WAGMI CONFIG
// =============================================================

export const wagmiConfig = createConfig({
  chains: [ACTIVE_CHAIN],
  connectors: [
    // Coinbase Wallet - Primary connector for Base
    coinbaseWallet({
      appName: APP_NAME,
      appLogoUrl: APP_ICON,
      // Enable smart wallet features
      preference: { options: 'smartWalletOnly' }, // or 'all' to support both EOA and smart wallets
    }),
    
    // WalletConnect - For other wallets (MetaMask, Rainbow, etc.)
    walletConnect({
      projectId: WALLETCONNECT_PROJECT_ID,
      metadata: {
        name: APP_NAME,
        description: APP_DESCRIPTION,
        url: APP_URL,
        icons: [APP_ICON],
      },
      showQrModal: true,
    }),
    
    // Injected wallets (MetaMask browser extension, etc.)
    injected({
      shimDisconnect: true,
    }),
  ],
  transports: {
    [base.id]: http('https://mainnet.base.org'),
    [baseSepolia.id]: http('https://sepolia.base.org'),
  },
});

// =============================================================
// USDC ERC20 ABI (minimal for transfers)
// =============================================================

export const USDC_ABI = [
  // Read functions
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  // Write functions
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'transferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// =============================================================
// HELPER FUNCTIONS
// =============================================================

// USDC has 6 decimals on Base
export const USDC_DECIMALS = 6;

// Convert dollars to USDC units (e.g., $10.00 -> 10000000)
export function dollarsToUSDC(dollars: number): bigint {
  return BigInt(Math.round(dollars * 10 ** USDC_DECIMALS));
}

// Convert USDC units to dollars (e.g., 10000000 -> $10.00)
export function usdcToDollars(usdc: bigint): number {
  return Number(usdc) / 10 ** USDC_DECIMALS;
}

// Convert cents to USDC units (our DB stores in cents)
export function centsToUSDC(cents: number): bigint {
  return BigInt(cents * 10 ** (USDC_DECIMALS - 2));
}

// Convert USDC units to cents
export function usdcToCents(usdc: bigint): number {
  return Number(usdc) / 10 ** (USDC_DECIMALS - 2);
}

// Format USDC for display
export function formatUSDC(usdc: bigint): string {
  return `$${usdcToDollars(usdc).toFixed(2)}`;
}

export { ACTIVE_CHAIN, IS_PRODUCTION };
