import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface Bet {
  id: string;
  user_id: string;
  market_id: string;
  position: 'YES' | 'NO';
  amount: number;
  odds_at_placement: number;
  potential_payout: number;
  status: 'PENDING' | 'WON' | 'LOST' | 'CANCELLED';
  created_at: string;
  settled_at?: string;
  market?: {
    title: string;
    status: string;
    resolved_value?: boolean;
  };
}

interface UseBetsOptions {
  userId?: string;
  marketId?: string;
  status?: string;
}

interface UseBetsReturn {
  bets: Bet[];
  loading: boolean;
  error: Error | null;
  placeBet: (marketId: string, position: 'YES' | 'NO', amount: number, odds: number) => Promise<{ error: Error | null }>;
  refetch: () => Promise<void>;
}

export function useBets(options: UseBetsOptions = {}): UseBetsReturn {
  const { userId, marketId, status } = options;
  
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('bets')
        .select(`
          *,
          market:markets(title, status, resolved_value)
        `)
        .order('created_at', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (marketId) {
        query = query.eq('market_id', marketId);
      }

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setBets((data as Bet[]) || []);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [userId, marketId, status]);

  useEffect(() => {
    fetchBets();
  }, [fetchBets]);

  const placeBet = async (
    marketId: string,
    position: 'YES' | 'NO',
    amount: number,
    odds: number
  ): Promise<{ error: Error | null }> => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Must be logged in to place bets');
      }

      const potentialPayout = amount / odds;

      const { error: insertError } = await supabase
        .from('bets')
        .insert({
          user_id: user.id,
          market_id: marketId,
          position,
          amount,
          odds_at_placement: odds,
          potential_payout: potentialPayout,
          status: 'PENDING',
        });

      if (insertError) throw insertError;

      // Refetch bets to include the new one
      await fetchBets();

      return { error: null };
    } catch (e) {
      return { error: e as Error };
    }
  };

  return {
    bets,
    loading,
    error,
    placeBet,
    refetch: fetchBets,
  };
}

/**
 * Calculate total portfolio value and stats
 */
export function usePortfolioStats(userId: string) {
  const [stats, setStats] = useState({
    totalValue: 0,
    totalWinnings: 0,
    totalLosses: 0,
    activeBets: 0,
    winRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchStats = async () => {
      setLoading(true);

      const { data: bets, error } = await supabase
        .from('bets')
        .select('*')
        .eq('user_id', userId);

      if (error || !bets) {
        setLoading(false);
        return;
      }

      const activeBets = bets.filter((b) => b.status === 'PENDING');
      const wonBets = bets.filter((b) => b.status === 'WON');
      const lostBets = bets.filter((b) => b.status === 'LOST');
      const settledBets = wonBets.length + lostBets.length;

      setStats({
        totalValue: activeBets.reduce((sum, b) => sum + b.potential_payout, 0),
        totalWinnings: wonBets.reduce((sum, b) => sum + b.potential_payout, 0),
        totalLosses: lostBets.reduce((sum, b) => sum + b.amount, 0),
        activeBets: activeBets.length,
        winRate: settledBets > 0 ? (wonBets.length / settledBets) * 100 : 0,
      });

      setLoading(false);
    };

    fetchStats();
  }, [userId]);

  return { stats, loading };
}
