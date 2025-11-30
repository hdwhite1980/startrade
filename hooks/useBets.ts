// StarTrade Bets Hook - USDC Betting Only
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Bet, Challenge, Market } from '@/types/database';

// =====================================================
// TYPES
// =====================================================

export type { Bet, Challenge };

export type BetSide = 'YES' | 'NO';
export type BetStatus = 'ACTIVE' | 'WON' | 'LOST' | 'CANCELLED' | 'REFUNDED';

interface UseBetsOptions {
  status?: BetStatus;
  marketId?: string;
  limit?: number;
}

interface UseBetsReturn {
  bets: Bet[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  placeBet: (marketId: string, side: BetSide, amount: number, isVirtual?: boolean) => Promise<string>;
}

interface UseBetReturn {
  bet: Bet | null;
  market: Market | null;
  loading: boolean;
  error: Error | null;
}

interface UseChallengesReturn {
  challenges: Challenge[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// =====================================================
// BETS HOOKS
// =====================================================

/**
 * Fetch user's bets with filters
 */
export function useBets(options: UseBetsOptions = {}): UseBetsReturn {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setBets([]);
        return;
      }

      let query = supabase
        .from('bets')
        .select(`
          *,
          market:markets(id, title, status, yes_odds, no_odds, resolved_outcome, celebrity:celebrities(id, name, image_url))
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (options.status) {
        query = query.eq('status', options.status);
      }
      if (options.marketId) {
        query = query.eq('market_id', options.marketId);
      }
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setBets(data as Bet[]);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [options.status, options.marketId, options.limit]);

  useEffect(() => {
    fetchBets();
  }, [fetchBets]);

  /**
   * Place a bet on a market
   */
  const placeBet = async (marketId: string, side: BetSide, amount: number, isVirtual: boolean = false): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Must be logged in to place bet');

    if (isVirtual) {
      // Place virtual bet - uses virtual_balance instead of USDC
      const { data, error } = await supabase.rpc('place_virtual_bet', {
        user_id_param: user.id,
        market_id_param: marketId,
        side_param: side,
        amount_param: amount,
      });

      if (error) throw error;
      
      // Refresh bets after placing
      await fetchBets();
      
      return data as string;
    } else {
      // Place real USDC bet
      const { data, error } = await supabase.rpc('place_bet', {
        user_id_param: user.id,
        market_id_param: marketId,
        side_param: side,
        amount_param: amount,
      });

      if (error) throw error;
      
      // Refresh bets after placing
      await fetchBets();
      
      return data as string;
    }
  };

  return {
    bets,
    loading,
    error,
    refetch: fetchBets,
    placeBet,
  };
}

/**
 * Fetch a single bet by ID
 */
export function useBet(betId: string | null): UseBetReturn {
  const [bet, setBet] = useState<Bet | null>(null);
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!betId) {
      setLoading(false);
      return;
    }

    const fetchBet = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('bets')
          .select(`
            *,
            market:markets(*)
          `)
          .eq('id', betId)
          .single();

        if (fetchError) throw fetchError;
        
        setBet(data as Bet);
        setMarket(data.market as Market);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchBet();
  }, [betId]);

  return { bet, market, loading, error };
}

/**
 * Fetch user's active bets
 */
export function useActiveBets(limit: number = 10): UseBetsReturn {
  return useBets({ status: 'ACTIVE', limit });
}

/**
 * Fetch user's bet history (resolved bets)
 */
export function useBetHistory(limit: number = 50): UseBetsReturn {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setBets([]);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('bets')
        .select(`
          *,
          market:markets(id, title, status, resolved_outcome, celebrity:celebrities(id, name, image_url))
        `)
        .eq('user_id', user.id)
        .in('status', ['WON', 'LOST', 'REFUNDED'])
        .order('resolved_at', { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;
      setBets(data as Bet[]);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchBets();
  }, [fetchBets]);

  const placeBet = async () => {
    throw new Error('Cannot place bet from history view');
  };

  return { bets, loading, error, refetch: fetchBets, placeBet };
}

// =====================================================
// CHALLENGES HOOKS (H2H Beef Mode - Real USDC)
// =====================================================

/**
 * Fetch user's challenges
 */
export function useChallenges(): UseChallengesReturn {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setChallenges([]);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('challenges')
        .select(`
          *,
          market:markets(id, title, status),
          challenger:user_profiles!challenger_id(id, username, avatar_url),
          opponent:user_profiles!opponent_id(id, username, avatar_url)
        `)
        .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setChallenges(data as Challenge[]);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  return { challenges, loading, error, refetch: fetchChallenges };
}

/**
 * Fetch open challenges (available to accept)
 */
export function useOpenChallenges(marketId?: string): UseChallengesReturn {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('challenges')
        .select(`
          *,
          market:markets(id, title, status),
          challenger:user_profiles!challenger_id(id, username, avatar_url)
        `)
        .eq('status', 'OPEN')
        .order('created_at', { ascending: false });

      if (marketId) {
        query = query.eq('market_id', marketId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setChallenges(data as Challenge[]);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  return { challenges, loading, error, refetch: fetchChallenges };
}

// =====================================================
// BETTING STATS
// =====================================================

interface BettingStats {
  totalBets: number;
  winningBets: number;
  losingBets: number;
  winRate: number;
  totalWagered: number;
  totalWon: number;
  totalLost: number;
  netProfit: number;
}

export function useBettingStats() {
  const [stats, setStats] = useState<BettingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setStats(null);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('total_bets, winning_bets, lifetime_winnings, lifetime_losses')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;

        const totalWagered = (profile.lifetime_winnings || 0) + (profile.lifetime_losses || 0);
        
        setStats({
          totalBets: profile.total_bets || 0,
          winningBets: profile.winning_bets || 0,
          losingBets: (profile.total_bets || 0) - (profile.winning_bets || 0),
          winRate: profile.total_bets > 0 
            ? Math.round((profile.winning_bets / profile.total_bets) * 100) 
            : 0,
          totalWagered,
          totalWon: profile.lifetime_winnings || 0,
          totalLost: profile.lifetime_losses || 0,
          netProfit: (profile.lifetime_winnings || 0) - (profile.lifetime_losses || 0),
        });
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, loading, error };
}

// =====================================================
// PORTFOLIO STATS (For Portfolio Screen)
// =====================================================

interface PortfolioStats {
  usdcBalance: number;
  escrowedBalance: number;
  totalBets: number;
  winRate: number;
  totalWinnings: number;
  totalLosses: number;
  netProfit: number;
  activeBets: number;
  rankTitle: string;
}

export function usePortfolioStats(userId: string) {
  const [stats, setStats] = useState<PortfolioStats>({
    usdcBalance: 0,
    escrowedBalance: 0,
    totalBets: 0,
    winRate: 0,
    totalWinnings: 0,
    totalLosses: 0,
    netProfit: 0,
    activeBets: 0,
    rankTitle: 'Rookie',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      // Fetch user profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('usdc_balance, escrowed_balance, total_bets, winning_bets, lifetime_winnings, lifetime_losses')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      // Count active bets
      const { count: activeBetsCount } = await supabase
        .from('bets')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'ACTIVE');

      const totalBets = profile?.total_bets || 0;
      const winningBets = profile?.winning_bets || 0;
      const totalWinnings = (profile?.lifetime_winnings || 0) / 100; // cents to dollars
      const totalLosses = (profile?.lifetime_losses || 0) / 100;

      // Calculate rank based on total bets
      let rankTitle = 'Rookie';
      if (totalBets >= 100) rankTitle = 'Legend';
      else if (totalBets >= 50) rankTitle = 'Veteran';
      else if (totalBets >= 20) rankTitle = 'Regular';
      else if (totalBets >= 5) rankTitle = 'Newcomer';

      setStats({
        usdcBalance: (profile?.usdc_balance || 0) / 100, // cents to dollars
        escrowedBalance: (profile?.escrowed_balance || 0) / 100,
        totalBets,
        winRate: totalBets > 0 ? (winningBets / totalBets) * 100 : 0,
        totalWinnings,
        totalLosses,
        netProfit: totalWinnings - totalLosses,
        activeBets: activeBetsCount || 0,
        rankTitle,
      });
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stats, loading, error, refresh };
}

/**
 * Calculate betting stats from an array of bets
 */
export function calculateBettingStats(bets: Bet[]): BettingStats {
  const wonBets = bets.filter(b => b.status === 'WON');
  const lostBets = bets.filter(b => b.status === 'LOST');
  
  const totalWon = wonBets.reduce((sum, b) => sum + (b.actual_payout || 0), 0);
  const totalLost = lostBets.reduce((sum, b) => sum + b.amount, 0);
  const totalWagered = bets.reduce((sum, b) => sum + b.amount, 0);

  return {
    totalBets: bets.length,
    winningBets: wonBets.length,
    losingBets: lostBets.length,
    winRate: bets.length > 0 ? (wonBets.length / bets.length) * 100 : 0,
    totalWagered,
    totalWon,
    totalLost,
    netProfit: totalWon - totalLost,
  };
}
