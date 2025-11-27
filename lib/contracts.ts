// StarTrade Contract Configuration for Base (USDC)
import { ethers } from 'ethers';

// =====================================================
// CHAIN CONFIGURATION
// =====================================================

export const CHAINS = {
  base: {
    chainId: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  baseSepolia: {
    chainId: 84532,
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia.basescan.org',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
  },
} as const;

// =====================================================
// CONTRACT ADDRESSES
// =====================================================

export const CONTRACT_ADDRESSES = {
  base: {
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    escrow: '0x0000000000000000000000000000000000000000', // TODO: Deploy
  },
  baseSepolia: {
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    escrow: '0x0000000000000000000000000000000000000000', // TODO: Deploy
  },
} as const;

// Current network (switch for dev/prod)
export const CURRENT_CHAIN = 'baseSepolia'; // 'base' for production
export const CHAIN_CONFIG = CHAINS[CURRENT_CHAIN];
export const ADDRESSES = CONTRACT_ADDRESSES[CURRENT_CHAIN];

// =====================================================
// CONTRACT ABIs
// =====================================================

// Standard ERC20 ABI (for USDC)
export const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
];

// StarTrade Escrow Contract ABI
export const ESCROW_ABI = [
  // Events
  'event Deposited(address indexed user, uint256 amount, uint256 newBalance)',
  'event Withdrawn(address indexed user, uint256 amount, uint256 newBalance)',
  'event BetPlaced(address indexed user, bytes32 indexed marketId, uint256 amount, bool isYes)',
  'event BetSettled(address indexed user, bytes32 indexed marketId, uint256 payout, bool won)',
  'event BetCancelled(address indexed user, bytes32 indexed marketId, uint256 amount)',
  
  // Read functions
  'function usdc() view returns (address)',
  'function balances(address user) view returns (uint256)',
  'function escrowed(address user) view returns (uint256)',
  'function balanceOf(address user) view returns (uint256)',
  'function availableBalance(address user) view returns (uint256)',
  'function escrowedBalance(address user) view returns (uint256)',
  'function kycVerified(address user) view returns (bool)',
  'function minDeposit() view returns (uint256)',
  'function maxDeposit() view returns (uint256)',
  'function minWithdrawal() view returns (uint256)',
  'function defaultDailyDepositLimit() view returns (uint256)',
  'function verifiedDailyDepositLimit() view returns (uint256)',
  'function dailyDeposited(address user) view returns (uint256)',
  'function platformFeeBps() view returns (uint256)',
  
  // Write functions
  'function deposit(uint256 amount)',
  'function withdraw(uint256 amount)',
];

// =====================================================
// CONTRACT INSTANCES
// =====================================================

/**
 * Get a provider for the current chain
 */
export function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(CHAIN_CONFIG.rpcUrl);
}

/**
 * Get USDC contract instance
 */
export function getUSDCContract(
  providerOrSigner: ethers.Provider | ethers.Signer
): ethers.Contract {
  return new ethers.Contract(ADDRESSES.usdc, ERC20_ABI, providerOrSigner);
}

/**
 * Get Escrow contract instance
 */
export function getEscrowContract(
  providerOrSigner: ethers.Provider | ethers.Signer
): ethers.Contract {
  return new ethers.Contract(ADDRESSES.escrow, ESCROW_ABI, providerOrSigner);
}

// =====================================================
// USDC HELPERS
// =====================================================

// USDC has 6 decimals
export const USDC_DECIMALS = 6;

/**
 * Parse USDC amount from human-readable to contract units
 * @param amount Human-readable amount (e.g., "10.50")
 * @returns BigInt in USDC units (6 decimals)
 */
export function parseUSDC(amount: string): bigint {
  return ethers.parseUnits(amount, USDC_DECIMALS);
}

/**
 * Format USDC amount from contract units to human-readable
 * @param amount BigInt in USDC units
 * @returns Human-readable string
 */
export function formatUSDCAmount(amount: bigint): string {
  return ethers.formatUnits(amount, USDC_DECIMALS);
}

/**
 * Convert cents (database) to USDC units (contract)
 * @param cents Amount in cents (e.g., 1050 for $10.50)
 * @returns BigInt in USDC units
 */
export function centsToUSDCUnits(cents: number): bigint {
  // cents = dollars * 100
  // USDC = dollars * 10^6
  // So USDC = cents * 10^4
  return BigInt(cents) * BigInt(10000);
}

/**
 * Convert USDC units (contract) to cents (database)
 * @param usdcUnits BigInt in USDC units
 * @returns Number in cents
 */
export function usdcUnitsToCents(usdcUnits: bigint): number {
  return Number(usdcUnits / BigInt(10000));
}

// =====================================================
// CONTRACT INTERACTIONS
// =====================================================

/**
 * Get user's USDC balance in wallet
 */
export async function getUSDCBalance(
  provider: ethers.Provider,
  address: string
): Promise<bigint> {
  const usdc = getUSDCContract(provider);
  return usdc.balanceOf(address);
}

/**
 * Get user's USDC allowance for escrow contract
 */
export async function getUSDCAllowance(
  provider: ethers.Provider,
  owner: string
): Promise<bigint> {
  const usdc = getUSDCContract(provider);
  return usdc.allowance(owner, ADDRESSES.escrow);
}

/**
 * Approve USDC spending for escrow contract
 */
export async function approveUSDC(
  signer: ethers.Signer,
  amount: bigint
): Promise<ethers.TransactionResponse> {
  const usdc = getUSDCContract(signer);
  return usdc.approve(ADDRESSES.escrow, amount);
}

/**
 * Approve maximum USDC spending (infinite approval)
 */
export async function approveMaxUSDC(
  signer: ethers.Signer
): Promise<ethers.TransactionResponse> {
  const usdc = getUSDCContract(signer);
  const maxAmount = ethers.MaxUint256;
  return usdc.approve(ADDRESSES.escrow, maxAmount);
}

/**
 * Deposit USDC into escrow
 */
export async function depositUSDC(
  signer: ethers.Signer,
  amount: bigint
): Promise<ethers.TransactionResponse> {
  const escrow = getEscrowContract(signer);
  return escrow.deposit(amount);
}

/**
 * Withdraw USDC from escrow
 */
export async function withdrawUSDC(
  signer: ethers.Signer,
  amount: bigint
): Promise<ethers.TransactionResponse> {
  const escrow = getEscrowContract(signer);
  return escrow.withdraw(amount);
}

/**
 * Get user's escrow balance
 */
export async function getEscrowBalance(
  provider: ethers.Provider,
  address: string
): Promise<{ total: bigint; available: bigint; escrowed: bigint }> {
  const escrow = getEscrowContract(provider);
  const [total, escrowed] = await Promise.all([
    escrow.balanceOf(address),
    escrow.escrowedBalance(address),
  ]);
  return {
    total,
    escrowed,
    available: BigInt(total) - BigInt(escrowed),
  };
}

/**
 * Check if user has approved enough USDC for deposit
 */
export async function hasEnoughAllowance(
  provider: ethers.Provider,
  owner: string,
  amount: bigint
): Promise<boolean> {
  const allowance = await getUSDCAllowance(provider, owner);
  return allowance >= amount;
}

/**
 * Get deposit limits for user
 */
export async function getDepositLimits(
  provider: ethers.Provider,
  address: string
): Promise<{
  minDeposit: bigint;
  maxDeposit: bigint;
  dailyLimit: bigint;
  dailyUsed: bigint;
  remainingToday: bigint;
}> {
  const escrow = getEscrowContract(provider);
  const [minDeposit, maxDeposit, isKYC, defaultLimit, verifiedLimit, dailyUsed] =
    await Promise.all([
      escrow.minDeposit(),
      escrow.maxDeposit(),
      escrow.kycVerified(address),
      escrow.defaultDailyDepositLimit(),
      escrow.verifiedDailyDepositLimit(),
      escrow.dailyDeposited(address),
    ]);

  const dailyLimit = isKYC ? verifiedLimit : defaultLimit;
  const remainingToday = BigInt(dailyLimit) > BigInt(dailyUsed) 
    ? BigInt(dailyLimit) - BigInt(dailyUsed) 
    : BigInt(0);

  return {
    minDeposit,
    maxDeposit,
    dailyLimit,
    dailyUsed,
    remainingToday,
  };
}

// =====================================================
// TRANSACTION HELPERS
// =====================================================

/**
 * Wait for transaction and return receipt
 */
export async function waitForTransaction(
  tx: ethers.TransactionResponse,
  confirmations: number = 1
): Promise<ethers.TransactionReceipt | null> {
  return tx.wait(confirmations);
}

/**
 * Get transaction URL on block explorer
 */
export function getTransactionUrl(txHash: string): string {
  return `${CHAIN_CONFIG.blockExplorer}/tx/${txHash}`;
}

/**
 * Get address URL on block explorer
 */
export function getAddressUrl(address: string): string {
  return `${CHAIN_CONFIG.blockExplorer}/address/${address}`;
}
