import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface Market {
  id: string;
  title: string;
  description: string;
  category: string;
  status: 'DRAFT' | 'OPEN' | 'CLOSED' | 'RESOLVED';
  current_odds: { yes: number; no: number };
  total_volume: number;
  betting_closes_at: string;
  resolves_at: string;
  created_at: string;
  resolved_value?: boolean;
}

interface UseMarketsOptions {
  status?: string;
  category?: string;
  limit?: number;
}

interface UseMarketsReturn {
  markets: Market[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useMarkets(options: UseMarketsOptions = {}): UseMarketsReturn {
  const { status = 'OPEN', category, limit = 20 } = options;
  
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('markets')
        .select('*')
        .order('betting_closes_at', { ascending: true })
        .limit(limit);

      if (status) {
        query = query.eq('status', status);
      }

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setMarkets((data as Market[]) || []);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [status, category, limit]);

  useEffect(() => {
    fetchMarkets();

    // Set up realtime subscription
    const subscription = supabase
      .channel('markets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'markets',
        },
        (payload: RealtimePostgresChangesPayload<Market>) => {
          if (payload.eventType === 'INSERT') {
            setMarkets((prev) => [payload.new as Market, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setMarkets((prev) =>
              prev.map((m) => (m.id === (payload.new as Market).id ? (payload.new as Market) : m))
            );
          } else if (payload.eventType === 'DELETE') {
            setMarkets((prev) =>
              prev.filter((m) => m.id !== (payload.old as Market).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchMarkets]);

  return {
    markets,
    loading,
    error,
    refetch: fetchMarkets,
  };
}

/**
 * Hook to fetch a single market by ID
 */
export function useMarket(id: string) {
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchMarket = async () => {
      setLoading(true);
      try {
        const { data, error: fetchError } = await supabase
          .from('markets')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;
        setMarket(data as Market);
      } catch (e) {
        setError(e as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchMarket();

    // Realtime updates for this specific market
    const subscription = supabase
      .channel(`market-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'markets',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          setMarket(payload.new as Market);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [id]);

  return { market, loading, error };
}
