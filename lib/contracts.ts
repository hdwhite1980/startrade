import { ethers } from 'ethers';

// StarTrade Escrow Contract ABI
export const ESCROW_ABI = [
  // Events
  'event Deposit(address indexed user, uint256 amount)',
  'event Withdrawal(address indexed user, uint256 amount)',
  'event BetPlaced(address indexed user, bytes32 indexed marketId, uint256 amount, bool isYes)',
  'event BetSettled(address indexed user, bytes32 indexed marketId, uint256 payout)',
  
  // Read functions
  'function balanceOf(address user) view returns (uint256)',
  'function escrowedBalance(address user) view returns (uint256)',
  'function availableBalance(address user) view returns (uint256)',
  
  // Write functions
  'function deposit() payable',
  'function withdraw(uint256 amount)',
  'function placeBet(bytes32 marketId, bool isYes, uint256 amount)',
  'function cancelBet(bytes32 betId)',
];

// Contract addresses by chain
export const CONTRACT_ADDRESSES = {
  // Base Mainnet
  base: {
    escrow: '0x0000000000000000000000000000000000000000', // TODO: Deploy and update
  },
  // Base Sepolia (testnet)
  baseSepolia: {
    escrow: '0x0000000000000000000000000000000000000000', // TODO: Deploy and update
  },
};

// Chain configuration
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
};

/**
 * Get escrow contract instance
 */
export function getEscrowContract(
  providerOrSigner: ethers.Provider | ethers.Signer,
  chainId: number = 8453
): ethers.Contract {
  const chain = chainId === 8453 ? 'base' : 'baseSepolia';
  const address = CONTRACT_ADDRESSES[chain].escrow;
  
  return new ethers.Contract(address, ESCROW_ABI, providerOrSigner);
}

/**
 * Deposit ETH into escrow
 */
export async function depositToEscrow(
  signer: ethers.Signer,
  amount: string,
  chainId: number = 8453
): Promise<ethers.TransactionResponse> {
  const contract = getEscrowContract(signer, chainId);
  const value = ethers.parseEther(amount);
  
  return contract.deposit({ value });
}

/**
 * Withdraw ETH from escrow
 */
export async function withdrawFromEscrow(
  signer: ethers.Signer,
  amount: string,
  chainId: number = 8453
): Promise<ethers.TransactionResponse> {
  const contract = getEscrowContract(signer, chainId);
  const value = ethers.parseEther(amount);
  
  return contract.withdraw(value);
}

/**
 * Place a bet
 */
export async function placeBet(
  signer: ethers.Signer,
  marketId: string,
  isYes: boolean,
  amount: string,
  chainId: number = 8453
): Promise<ethers.TransactionResponse> {
  const contract = getEscrowContract(signer, chainId);
  const value = ethers.parseEther(amount);
  const marketIdBytes = ethers.id(marketId); // Convert to bytes32
  
  return contract.placeBet(marketIdBytes, isYes, value);
}

/**
 * Get user's available balance
 */
export async function getAvailableBalance(
  provider: ethers.Provider,
  userAddress: string,
  chainId: number = 8453
): Promise<string> {
  const contract = getEscrowContract(provider, chainId);
  const balance = await contract.availableBalance(userAddress);
  
  return ethers.formatEther(balance);
}

/**
 * Get user's escrowed balance (in active bets)
 */
export async function getEscrowedBalance(
  provider: ethers.Provider,
  userAddress: string,
  chainId: number = 8453
): Promise<string> {
  const contract = getEscrowContract(provider, chainId);
  const balance = await contract.escrowedBalance(userAddress);
  
  return ethers.formatEther(balance);
}
