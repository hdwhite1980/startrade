// StarTrade Database Types - USDC Betting System

// =====================================================
// USER & WALLET TYPES
// =====================================================

export type KYCStatus = 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED';
export type UserRank = 'Rookie' | 'Rising Star' | 'Pro Bettor' | 'High Roller' | 'Legend';

export interface UserProfile {
  id: string;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  // Wallet
  wallet_address: string | null;
  // USDC Balances (in cents, $1 = 100)
  usdc_balance: number;
  escrowed_balance: number;
  lifetime_deposited: number;
  lifetime_withdrawn: number;
  lifetime_winnings: number;
  lifetime_losses: number;
  // Fan Tokens (entertainment currency)
  fan_tokens: number;
  total_predictions: number;
  correct_predictions: number;
  // Limits (in cents)
  deposit_limit: number;
  betting_limit: number;
  // KYC
  kyc_status: KYCStatus;
  kyc_verified_at: string | null;
  kyc_provider: string | null;
  kyc_reference_id: string | null;
  // Stats
  total_bets: number;
  winning_bets: number;
  prediction_accuracy: number;
  rank_title: UserRank;
  // Responsible Gaming
  self_excluded_until: string | null;
  cooling_off_until: string | null;
  // Timestamps
  created_at: string;
  updated_at: string;
  last_active_at: string;
}

// Fan Profile for Entertainment Features (non-betting)
export type FanRank = 'Rookie' | 'Super Fan' | 'Celebrity Expert' | 'Legend';

export interface FanProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  // Entertainment Stats
  fan_tokens: number;
  lifetime_tokens_earned: number;
  total_predictions: number;
  correct_predictions: number;
  prediction_accuracy: number;
  // Ranking
  rank_title: FanRank;
  rank_position: number | null;
  // Timestamps
  created_at: string;
  updated_at: string;
}

// =====================================================
// TRANSACTION TYPES
// =====================================================

export type TransactionType = 
  | 'DEPOSIT' 
  | 'WITHDRAWAL' 
  | 'BET_PLACED' 
  | 'BET_WON' 
  | 'BET_LOST' 
  | 'BET_CANCELLED'
  | 'CHALLENGE_STAKE'
  | 'CHALLENGE_WON'
  | 'CHALLENGE_LOST'
  | 'REFUND';

export type TransactionStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number; // In cents
  // Blockchain
  tx_hash: string | null;
  block_number: number | null;
  from_address: string | null;
  to_address: string | null;
  // Status
  status: TransactionStatus;
  confirmations: number;
  // Reference
  reference_type: string | null;
  reference_id: string | null;
  // Meta
  notes: string | null;
  created_at: string;
  confirmed_at: string | null;
}

// =====================================================
// CELEBRITY TYPES
// =====================================================

export type CelebrityCategory = 'Music' | 'Film' | 'Sports' | 'Social Media' | 'TV' | 'Gaming';

export interface CelebrityMetrics {
  spotify_streams?: number;
  youtube_views?: number;
  youtube_subscribers?: number;
  instagram_followers?: number;
  twitter_followers?: number;
  tiktok_followers?: number;
  twitch_followers?: number;
  engagement_rate?: number;
  trend_score?: number;
  sentiment_score?: number;
}

export interface Celebrity {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  category: CelebrityCategory;
  bio: string | null;
  metrics: CelebrityMetrics;
  // Entertainment features (fictional values)
  share_price: number;
  price_change_24h: number;
  career_score: number;
  // Stats
  total_markets: number;
  total_volume: number; // In cents
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// =====================================================
// MARKET TYPES
// =====================================================

export type MarketCategory = 'MUSIC' | 'FILM' | 'SPORTS' | 'SOCIAL' | 'AWARDS' | 'CHARTS' | 'STREAMING' | 'OTHER';
export type MarketStatus = 'ACTIVE' | 'UPCOMING' | 'CLOSED' | 'RESOLVED' | 'CANCELLED';

export interface Market {
  id: string;
  celebrity_id: string | null;
  celebrity?: Celebrity;
  // Market details
  title: string;
  description: string | null;
  category: MarketCategory;
  status: MarketStatus;
  // Odds (in basis points: 5000 = 50%)
  yes_odds: number;
  no_odds: number;
  initial_yes_odds: number;
  initial_no_odds: number;
  // Pools (in cents)
  yes_pool: number;
  no_pool: number;
  total_volume: number;
  total_bets: number;
  // Display
  featured: boolean;
  trending: boolean;
  // Resolution
  resolved_outcome: boolean | null;
  resolution_source: string | null;
  resolved_by: string | null;
  // AI
  ai_generated: boolean;
  ai_confidence: number | null;
  ai_reasoning: string | null;
  source_headline: string | null;
  source_url: string | null;
  // Timing
  closes_at: string;
  resolves_at: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// BETTING TYPES
// =====================================================

export type BetSide = 'YES' | 'NO';
export type BetStatus = 'ACTIVE' | 'WON' | 'LOST' | 'CANCELLED' | 'REFUNDED';

export interface Bet {
  id: string;
  user_id: string;
  user?: UserProfile;
  market_id: string;
  market?: Market;
  // Bet details
  side: BetSide;
  amount: number; // In cents
  odds_at_placement: number; // Basis points
  potential_payout: number; // In cents
  actual_payout: number | null; // In cents
  // Status
  status: BetStatus;
  created_at: string;
  resolved_at: string | null;
}

// =====================================================
// CHALLENGE TYPES (Beef Mode)
// =====================================================

export type ChallengeStatus = 'OPEN' | 'MATCHED' | 'RESOLVED' | 'CANCELLED' | 'EXPIRED';

export interface Challenge {
  id: string;
  market_id: string;
  market?: Market;
  // Challenger
  challenger_id: string;
  challenger?: UserProfile;
  challenger_side: BetSide;
  challenger_amount: number; // In cents
  // Opponent
  opponent_id: string | null;
  opponent?: UserProfile;
  opponent_accepted_at: string | null;
  // Stakes
  total_pot: number; // In cents
  platform_fee: number; // In cents
  winner_payout: number; // In cents
  // Status
  status: ChallengeStatus;
  winner_id: string | null;
  // Timing
  expires_at: string;
  created_at: string;
  resolved_at: string | null;
}

// =====================================================
// PREDICTION TYPES (Entertainment - Fan Tokens)
// =====================================================

export type PredictionStatus = 'ACTIVE' | 'CORRECT' | 'INCORRECT' | 'CANCELLED';

export interface PredictionChallenge {
  id: string;
  celebrity_id: string;
  celebrity?: Celebrity;
  title: string;
  description: string | null;
  category: MarketCategory;
  status: 'ACTIVE' | 'UPCOMING' | 'CLOSED' | 'RESOLVED';
  // Fan sentiment (not odds - entertainment only)
  fan_sentiment: { yes: number; no: number };
  total_predictions: number;
  // Resolution
  resolved_outcome: boolean | null;
  resolution_source: string | null;
  // Timing
  challenge_ends_at: string;
  resolves_at: string;
  created_at: string;
}

export interface Prediction {
  id: string;
  user_id: string;
  challenge_id: string;
  challenge?: PredictionChallenge;
  prediction: 'YES' | 'NO';
  fan_tokens_staked: number;
  potential_reward: number;
  actual_reward: number | null;
  status: PredictionStatus;
  created_at: string;
  resolved_at: string | null;
}

// =====================================================
// AI TYPES
// =====================================================

export type AIInsightType = 'ODDS_CHANGE' | 'TREND_ALERT' | 'BREAKING_NEWS' | 'CONFIDENCE_UPDATE' | 'MARKET_ANALYSIS';
export type AIInsightPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface AIInsight {
  id: string;
  market_id: string | null;
  market?: Market;
  celebrity_id: string | null;
  celebrity?: Celebrity;
  // Insight
  type: AIInsightType;
  title: string;
  description: string;
  // Data
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  change_magnitude: number | null;
  // Display
  priority: AIInsightPriority;
  emoji: string | null;
  is_read: boolean;
  // Timestamps
  created_at: string;
  expires_at: string | null;
}

export type AISuggestionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'AUTO_PUBLISHED';

export interface AIMarketSuggestion {
  id: string;
  // Source
  source_headline: string;
  source_url: string | null;
  source_published_at: string | null;
  source_outlet: string | null;
  // Suggested market
  suggested_title: string;
  suggested_description: string | null;
  suggested_category: string;
  suggested_celebrity_id: string | null;
  suggested_yes_odds: number;
  suggested_no_odds: number;
  suggested_closes_at: string | null;
  suggested_resolves_at: string | null;
  // AI Analysis
  ai_confidence: number;
  ai_reasoning: string;
  ai_viral_score: number | null;
  resolution_criteria: Record<string, unknown> | null;
  // Review
  status: AISuggestionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  market_id: string | null;
  created_at: string;
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

// Convert cents to dollars for display
export function centsToUSD(cents: number): number {
  return cents / 100;
}

// Convert dollars to cents for storage
export function usdToCents(usd: number): number {
  return Math.round(usd * 100);
}

// Format USDC amount for display
export function formatUSDC(cents: number): string {
  return `$${centsToUSD(cents).toFixed(2)}`;
}

// Format odds from basis points to percentage
export function formatOdds(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(0)}%`;
}

// Calculate potential payout from bet
export function calculatePotentialPayout(amount: number, odds: number): number {
  return Math.floor((amount * 10000) / odds);
}

// Format large numbers (followers, views)
export function formatLargeNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toString();
}

// =====================================================
// SUPABASE DATABASE SCHEMA TYPE
// =====================================================

// This is a simplified Database type for Supabase client typing
// A full generated version would be created by `supabase gen types typescript`
export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: UserProfile;
        Insert: Partial<UserProfile>;
        Update: Partial<UserProfile>;
      };
      transactions: {
        Row: Transaction;
        Insert: Partial<Transaction>;
        Update: Partial<Transaction>;
      };
      celebrities: {
        Row: Celebrity;
        Insert: Partial<Celebrity>;
        Update: Partial<Celebrity>;
      };
      markets: {
        Row: Market;
        Insert: Partial<Market>;
        Update: Partial<Market>;
      };
      bets: {
        Row: Bet;
        Insert: Partial<Bet>;
        Update: Partial<Bet>;
      };
      challenges: {
        Row: Challenge;
        Insert: Partial<Challenge>;
        Update: Partial<Challenge>;
      };
      prediction_challenges: {
        Row: PredictionChallenge;
        Insert: Partial<PredictionChallenge>;
        Update: Partial<PredictionChallenge>;
      };
      predictions: {
        Row: Prediction;
        Insert: Partial<Prediction>;
        Update: Partial<Prediction>;
      };
      fan_profiles: {
        Row: FanProfile;
        Insert: Partial<FanProfile>;
        Update: Partial<FanProfile>;
      };
      ai_insights: {
        Row: AIInsight;
        Insert: Partial<AIInsight>;
        Update: Partial<AIInsight>;
      };
      ai_market_suggestions: {
        Row: AIMarketSuggestion;
        Insert: Partial<AIMarketSuggestion>;
        Update: Partial<AIMarketSuggestion>;
      };
      share_holdings: {
        Row: {
          id: string;
          user_id: string;
          celebrity_id: string;
          shares_owned: number;
          average_purchase_price: number;
          total_invested_tokens: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<{
          id: string;
          user_id: string;
          celebrity_id: string;
          shares_owned: number;
          average_purchase_price: number;
          total_invested_tokens: number;
        }>;
        Update: Partial<{
          shares_owned: number;
          average_purchase_price: number;
          total_invested_tokens: number;
          updated_at: string;
        }>;
      };
    };
    Views: {};
    Functions: {
      place_bet: {
        Args: {
          user_id_param: string;
          market_id_param: string;
          side_param: BetSide;
          amount_param: number;
        };
        Returns: string;
      };
    };
    Enums: {};
  };
};
