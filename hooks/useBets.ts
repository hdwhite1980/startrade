// StarTrade Betting Hooks - Real USDC System
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { Bet, BetSide, BetStatus, UserProfile, Challenge } from '@/types/database';
import { formatUSDC, usdToCents, centsToUSD } from '@/types/database';

// =====================================================
// TYPES
// =====================================================

export type { Bet, BetSide, BetStatus, UserProfile, Challenge };

interface PlaceBetParams {
  marketId: string;
  side: BetSide;
  amountUSD: number;
}

interface PlaceBetResult {
  success: boolean;
  betId?: string;
  error?: string;
}

interface UseBetsReturn {
  bets: Bet[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  placeBet: (marketId: string, side: BetSide, amountUSD: number, odds: number) => Promise<{ error: Error | null; betId?: string }>;
}

interface UseUserStatsReturn {
  profile: UserProfile | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

interface PortfolioStats {
  usdcBalance: number;
  escrowedBalance: number;
  totalWagered: number;
  totalWinnings: number;
  totalLosses: number;
  netProfit: number;
  winRate: number;
  totalBets: number;
  activeBets: number;
  rankTitle: string;
}

// =====================================================
// BETTING FUNCTIONS
// =====================================================

export async function placeBet(params: PlaceBetParams): Promise<PlaceBetResult> {
  const { marketId, side, amountUSD } = params;
  const amountCents = usdToCents(amountUSD);
  
  if (amountCents < 100) {
    return { success: false, error: 'Minimum bet is $1.00' };
  }
  if (amountCents > 2500) {
    return { success: false, error: 'Maximum bet is $25.00' };
  }

  try {
    const { data, error } = await supabase.rpc('place_bet', {
      user_id_param: (await supabase.auth.getUser()).data.user?.id,
      market_id_param: marketId,
      side_param: side,
      amount_param: amountCents,
    });

    if (error) {
      const message = error.message || 'Failed to place bet';
      if (message.includes('Insufficient balance')) return { success: false, error: 'Insufficient USDC balance' };
      if (message.includes('self-excluded')) return { success: false, error: 'Account is self-excluded from betting' };
      if (message.includes('limit')) return { success: false, error: 'Bet exceeds your betting limit' };
      if (message.includes('closed')) return { success: false, error: 'Market is closed for betting' };
      return { success: false, error: message };
    }
    return { success: true, betId: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to place bet' };
  }
}

export async function cancelBet(betId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('bets').update({ status: 'CANCELLED' }).eq('id', betId).eq('status', 'ACTIVE');
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// =====================================================
// HOOKS
// =====================================================

export function useBets(status?: BetStatus): UseBetsReturn {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuthStore();

  const fetchBets = useCallback(async () => {
    if (!user) { setBets([]); setLoading(false); return; }
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('bets')
        .select(`*, market:markets(id, title, status, yes_odds, no_odds, resolved_outcome, closes_at)`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (status) query = query.eq('status', status);
      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setBets(data as Bet[]);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [user, status]);

  useEffect(() => { fetchBets(); }, [fetchBets]);

  useEffect(() => {
    if (!user) return;
    const subscription = supabase
      .channel('my_bets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bets', filter: `user_id=eq.${user.id}` }, () => fetchBets())
      .subscribe();
    return () => { subscription.unsubscribe(); };
  }, [user, fetchBets]);

  const placeBetFn = async (marketId: string, side: BetSide, amountUSD: number, odds: number) => {
    const result = await placeBet({ marketId, side, amountUSD });
    if (result.success) { await fetchBets(); return { error: null, betId: result.betId }; }
    return { error: new Error(result.error || 'Failed to place bet') };
  };

  return { bets, loading, error, refresh: fetchBets, placeBet: placeBetFn };
}

export function useMyBets(status?: BetStatus): Omit<UseBetsReturn, 'placeBet'> {
  const result = useBets(status);
  return { bets: result.bets, loading: result.loading, error: result.error, refresh: result.refresh };
}

export function useActiveBets(): Omit<UseBetsReturn, 'placeBet'> { 
  return useMyBets('ACTIVE'); 
}

export function useBetHistory(): Omit<UseBetsReturn, 'placeBet'> {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuthStore();

  const fetchBets = useCallback(async () => {
    if (!user) { setBets([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('bets')
        .select(`*, market:markets(id, title, resolved_outcome)`)
        .eq('user_id', user.id)
        .in('status', ['WON', 'LOST'])
        .order('resolved_at', { ascending: false });
      if (fetchError) throw fetchError;
      setBets(data as Bet[]);
    } catch (err) { setError(err as Error); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchBets(); }, [fetchBets]);
  return { bets, loading, error, refresh: fetchBets };
}

export function useMarketBets(marketId: string): Omit<UseBetsReturn, 'placeBet'> {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuthStore();

  const fetchBets = useCallback(async () => {
    if (!user || !marketId) { setBets([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('bets')
        .select('*')
        .eq('user_id', user.id)
        .eq('market_id', marketId)
        .order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      setBets(data as Bet[]);
    } catch (err) { setError(err as Error); }
    finally { setLoading(false); }
  }, [user, marketId]);

  useEffect(() => { fetchBets(); }, [fetchBets]);
  return { bets, loading, error, refresh: fetchBets };
}

export function useUserStats(): UseUserStatsReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuthStore();

  const fetchProfile = useCallback(async () => {
    if (!user) { setProfile(null); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const { data, error: fetchError } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
      if (fetchError) throw fetchError;
      setProfile(data as UserProfile);
    } catch (err) { setError(err as Error); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);
  return { profile, loading, error, refresh: fetchProfile };
}

// =====================================================
// PORTFOLIO STATS (Real USDC)
// =====================================================

export function usePortfolioStats(userId: string) {
  const [stats, setStats] = useState<PortfolioStats>({
    usdcBalance: 0,
    escrowedBalance: 0,
    totalWagered: 0,
    totalWinnings: 0,
    totalLosses: 0,
    netProfit: 0,
    winRate: 0,
    totalBets: 0,
    activeBets: 0,
    rankTitle: 'Rookie',
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);

    try {
      // Get user profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('usdc_balance, escrowed_balance, lifetime_winnings, lifetime_losses, winning_bets, total_bets, rank_title')
        .eq('id', userId)
        .single();

      // Get active bets count
      const { count: activeBetsCount } = await supabase
        .from('bets')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'ACTIVE');

      const winRate = (profile?.total_bets || 0) > 0 
        ? ((profile?.winning_bets || 0) / (profile?.total_bets || 1)) * 100 
        : 0;

      setStats({
        usdcBalance: centsToUSD(profile?.usdc_balance || 0),
        escrowedBalance: centsToUSD(profile?.escrowed_balance || 0),
        totalWagered: centsToUSD((profile?.lifetime_winnings || 0) + (profile?.lifetime_losses || 0)),
        totalWinnings: centsToUSD(profile?.lifetime_winnings || 0),
        totalLosses: centsToUSD(profile?.lifetime_losses || 0),
        netProfit: centsToUSD((profile?.lifetime_winnings || 0) - (profile?.lifetime_losses || 0)),
        winRate,
        totalBets: profile?.total_bets || 0,
        activeBets: activeBetsCount || 0,
        rankTitle: profile?.rank_title || 'Rookie',
      });
    } catch (err) { 
      console.error('Failed to fetch portfolio stats:', err); 
    }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  return { stats, loading, refresh: fetchStats };
}

// =====================================================
// BETTING STATS CALCULATOR
// =====================================================

export function calculateBettingStats(bets: Bet[]) {
  const resolved = bets.filter(b => b.status === 'WON' || b.status === 'LOST');
  const won = bets.filter(b => b.status === 'WON');
  const lost = bets.filter(b => b.status === 'LOST');
  const active = bets.filter(b => b.status === 'ACTIVE');

  const totalWagered = bets.reduce((sum, b) => sum + b.amount, 0);
  const totalWon = won.reduce((sum, b) => sum + (b.actual_payout || 0), 0);
  const activeWagered = active.reduce((sum, b) => sum + b.amount, 0);

  return {
    totalBets: bets.length,
    resolvedBets: resolved.length,
    wonBets: won.length,
    lostBets: lost.length,
    activeBets: active.length,
    winRate: resolved.length > 0 ? (won.length / resolved.length) * 100 : 0,
    totalWagered: centsToUSD(totalWagered),
    totalWon: centsToUSD(totalWon),
    totalLost: centsToUSD(lost.reduce((sum, b) => sum + b.amount, 0)),
    netProfit: centsToUSD(totalWon - totalWagered),
    activeWagered: centsToUSD(activeWagered),
  };
}

// =====================================================
// CHALLENGES (BEEF MODE - H2H Real USDC)
// =====================================================

export async function createChallenge(
  marketId: string, 
  side: BetSide, 
  amountUSD: number
): Promise<{ success: boolean; challengeId?: string; error?: string }> {
  const amountCents = usdToCents(amountUSD);
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return { success: false, error: 'Not authenticated' };
  if (amountCents < 100) return { success: false, error: 'Minimum challenge is $1.00' };

  const platformFee = Math.floor(amountCents * 0.04); // 4% rake
  const totalPot = amountCents * 2;
  const winnerPayout = totalPot - platformFee;
  const expiresAt = new Date(); 
  expiresAt.setHours(expiresAt.getHours() + 24);

  try {
    const { data, error } = await supabase
      .from('challenges')
      .insert({ 
        market_id: marketId, 
        challenger_id: user.id, 
        challenger_side: side, 
        challenger_amount: amountCents, 
        total_pot: totalPot, 
        platform_fee: platformFee, 
        winner_payout: winnerPayout, 
        expires_at: expiresAt.toISOString() 
      })
      .select('id')
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, challengeId: data?.id };
  } catch (err: any) { 
    return { success: false, error: err.message }; 
  }
}

export async function acceptChallenge(challengeId: string): Promise<{ success: boolean; error?: string }> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return { success: false, error: 'Not authenticated' };
  try {
    const { error } = await supabase
      .from('challenges')
      .update({ 
        opponent_id: user.id, 
        opponent_accepted_at: new Date().toISOString(), 
        status: 'MATCHED' 
      })
      .eq('id', challengeId)
      .eq('status', 'OPEN');
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) { 
    return { success: false, error: err.message }; 
  }
}

export function useOpenChallenges(marketId?: string) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchChallenges = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      let query = supabase
        .from('challenges')
        .select(`*, market:markets(id, title), challenger:user_profiles!challenger_id(id, username, avatar_url)`)
        .eq('status', 'OPEN')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      if (marketId) query = query.eq('market_id', marketId);
      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setChallenges(data as Challenge[]);
    } catch (err) { setError(err as Error); }
    finally { setLoading(false); }
  }, [marketId]);

  useEffect(() => { fetchChallenges(); }, [fetchChallenges]);
  return { challenges, loading, error, refresh: fetchChallenges };
}

export function useMyChallenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuthStore();

  const fetchChallenges = useCallback(async () => {
    if (!user) { setChallenges([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('challenges')
        .select(`*, market:markets(id, title, resolved_outcome), opponent:user_profiles!opponent_id(id, username)`)
        .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
        .order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      setChallenges(data as Challenge[]);
    } catch (err) { setError(err as Error); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchChallenges(); }, [fetchChallenges]);
  return { challenges, loading, error, refresh: fetchChallenges };
}
