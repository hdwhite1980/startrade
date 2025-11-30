// StarTrade Hooks - USDC Betting
// Re-export all hooks from a single entry point

// Market hooks
export {
  useMarkets,
  useMarket,
  useActiveMarkets,
  useFeaturedMarkets,
  useMarketsByCategory,
  useCelebrityMarkets,
  useCelebrities,
  useCelebrity,
  useMarketSearch,
  useCelebritySearch,
} from './useMarkets';

// Bet hooks
export {
  useBets,
  useBet,
  useActiveBets,
  useBetHistory,
  useChallenges,
  useOpenChallenges,
  useBettingStats,
} from './useBets';

// Wallet hook
export { useWallet } from './useWallet';

// Types
export type { Market, MarketCategory, Celebrity, CelebrityCategory } from './useMarkets';
export type { Bet, Challenge, BetSide, BetStatus } from './useBets';
