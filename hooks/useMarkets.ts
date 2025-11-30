// StarTrade Markets Hook - USDC Betting
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Market, MarketCategory, Celebrity, CelebrityCategory } from '@/types/database';

// =====================================================
// TYPES
// =====================================================

export type { Market, MarketCategory, Celebrity, CelebrityCategory };

interface UseMarketsOptions {
  category?: MarketCategory;
  status?: 'ACTIVE' | 'UPCOMING' | 'CLOSED' | 'RESOLVED';
  celebrityId?: string;
  featured?: boolean;
  limit?: number;
}

interface UseCelebritiesOptions {
  category?: string;
  limit?: number;
}

interface UseMarketsReturn {
  markets: Market[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

interface UseMarketReturn {
  market: Market | null;
  celebrity: Celebrity | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

interface UseCelebritiesReturn {
  celebrities: Celebrity[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

interface UseCelebrityReturn {
  celebrity: Celebrity | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// =====================================================
// MARKET HOOKS
// =====================================================

/**
 * Fetch markets with filters and real-time updates
 */
export function useMarkets(options: UseMarketsOptions = {}): UseMarketsReturn {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('markets')
        .select(`
          *,
          celebrity:celebrities(id, name, slug, image_url, category)
        `)
        .order('created_at', { ascending: false });

      if (options.category) {
        query = query.eq('category', options.category);
      }
      if (options.status) {
        query = query.eq('status', options.status);
      }
      if (options.celebrityId) {
        query = query.eq('celebrity_id', options.celebrityId);
      }
      if (options.featured) {
        query = query.eq('featured', true);
      }
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setMarkets(data as Market[]);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [options.category, options.status, options.celebrityId, options.featured, options.limit]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  return {
    markets,
    loading,
    error,
    refresh: fetchMarkets,
  };
}

/**
 * Fetch single market by ID - simplified without realtime to avoid infinite loops
 */
export function useMarket(marketId: string | null): UseMarketReturn {
  const [market, setMarket] = useState<Market | null>(null);
  const [celebrity, setCelebrity] = useState<Celebrity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMarket = useCallback(async () => {
    if (!marketId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('markets')
        .select(`
          *,
          celebrity:celebrities(*)
        `)
        .eq('id', marketId)
        .single();

      if (fetchError) throw fetchError;

      setMarket(data as Market);
      setCelebrity(data.celebrity as Celebrity);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  useEffect(() => {
    fetchMarket();
  }, [fetchMarket]);

  return {
    market,
    celebrity,
    loading,
    error,
    refresh: fetchMarket,
  };
}

/**
 * Fetch active markets
 */
export function useActiveMarkets(limit: number = 10): UseMarketsReturn {
  return useMarkets({ status: 'ACTIVE', limit });
}

/**
 * Fetch featured markets
 */
export function useFeaturedMarkets(limit: number = 5): UseMarketsReturn {
  return useMarkets({ status: 'ACTIVE', featured: true, limit });
}

/**
 * Fetch markets by category
 */
export function useMarketsByCategory(
  category: MarketCategory,
  limit: number = 20
): UseMarketsReturn {
  return useMarkets({ category, status: 'ACTIVE', limit });
}

/**
 * Fetch markets for a celebrity
 */
export function useCelebrityMarkets(
  celebrityId: string,
  limit: number = 10
): UseMarketsReturn {
  return useMarkets({ celebrityId, limit });
}

// =====================================================
// CELEBRITY HOOKS
// =====================================================

/**
 * Fetch celebrities with filters
 */
export function useCelebrities(options: UseCelebritiesOptions = {}): UseCelebritiesReturn {
  const [celebrities, setCelebrities] = useState<Celebrity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCelebrities = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('celebrities')
        .select('*')
        .order('created_at', { ascending: false });

      if (options.category) {
        query = query.eq('category', options.category);
      }
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setCelebrities(data as Celebrity[]);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [options.category, options.limit]);

  useEffect(() => {
    fetchCelebrities();
  }, [fetchCelebrities]);

  return {
    celebrities,
    loading,
    error,
    refetch: fetchCelebrities,
  };
}

/**
 * Fetch single celebrity by ID
 */
export function useCelebrity(celebrityId: string | undefined): UseCelebrityReturn {
  const [celebrity, setCelebrity] = useState<Celebrity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCelebrity = useCallback(async () => {
    if (!celebrityId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('celebrities')
        .select('*')
        .eq('id', celebrityId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      setCelebrity(data as Celebrity);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [celebrityId]);

  useEffect(() => {
    fetchCelebrity();
  }, [fetchCelebrity]);

  return {
    celebrity,
    loading,
    error,
    refetch: fetchCelebrity,
  };
}

// =====================================================
// SEARCH
// =====================================================

/**
 * Search markets by title
 */
export function useMarketSearch(query: string) {
  const [results, setResults] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const search = useCallback(async () => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: searchError } = await supabase
        .from('markets')
        .select(`
          *,
          celebrity:celebrities(id, name, image_url)
        `)
        .ilike('title', `%${query}%`)
        .eq('status', 'ACTIVE')
        .limit(10);

      if (searchError) {
        throw searchError;
      }

      setResults(data as Market[]);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [search]);

  return { results, loading, error };
}

/**
 * Search celebrities by name
 */
export function useCelebritySearch(query: string) {
  const [results, setResults] = useState<Celebrity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const search = useCallback(async () => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: searchError } = await supabase
        .from('celebrities')
        .select('*')
        .ilike('name', `%${query}%`)
        .limit(10);

      if (searchError) {
        throw searchError;
      }

      setResults(data as Celebrity[]);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [search]);

  return { results, loading, error };
}
