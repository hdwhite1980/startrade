// StarTrade Hooks - Barrel Export
export { useAuth } from './useAuth';
export { 
  useMarkets, 
  useMarket, 
  useActiveMarkets, 
  useFeaturedMarkets, 
  useMarketsByCategory, 
  useCelebrityMarkets,
  useCelebrities,
  useCelebrity,
  useChallenges,
  useMarketSearch,
  useCelebritySearch,
} from './useMarkets';
export type { Market, MarketCategory, Celebrity, CelebrityCategory, PredictionChallenge } from './useMarkets';

export { 
  useBets, 
  useMyBets,
  useActiveBets,
  useBetHistory,
  useMarketBets,
  useUserStats,
  usePredictions,
  useHoldings,
  usePortfolioStats,
  placeBet,
  cancelBet,
  calculateBettingStats,
  createChallenge,
  acceptChallenge,
  useOpenChallenges,
  useMyChallenges,
} from './useBets';
export type { Bet, BetSide, BetStatus, UserProfile, Challenge, Prediction, ShareHolding } from './useBets';

export { useWallet } from './useWallet';
