// StarTrade Hooks - Real USDC Betting System

// Market hooks
export { 
  useMarkets, 
  useMarket,
  useFeaturedMarkets,
  useCelebrities,
  useCelebrity,
  useChallenges,
} from './useMarkets';

export type { 
  Market, 
  MarketCategory,
  Celebrity,
  CelebrityCategory,
  PredictionChallenge,
} from './useMarkets';

// Betting hooks (Real USDC)
export {
  useBets,
  useMyBets,
  useActiveBets,
  useBetHistory,
  useMarketBets,
  useUserStats,
  usePortfolioStats,
  useOpenChallenges,
  useMyChallenges,
  placeBet,
  cancelBet,
  createChallenge,
  acceptChallenge,
  calculateBettingStats,
} from './useBets';

export type {
  Bet,
  BetSide,
  BetStatus,
  UserProfile,
  Challenge,
} from './useBets';

// Wallet hooks
export { useWallet } from './useWallet';
