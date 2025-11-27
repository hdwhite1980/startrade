// StarTrade AI Insights Service
// Real-time trend alerts and market analysis

import { supabase } from '@/lib/supabase';
import type { AIInsight, AIInsightType, AIInsightPriority, Market, Celebrity } from '@/types/database';

// =====================================================
// TYPES
// =====================================================

interface OddsChange {
  marketId: string;
  oldYesOdds: number;
  newYesOdds: number;
  oldNoOdds: number;
  newNoOdds: number;
  changeMagnitude: number;
}

interface TrendData {
  celebrityId: string;
  metric: string;
  oldValue: number;
  newValue: number;
  percentChange: number;
}

// =====================================================
// INSIGHT GENERATION
// =====================================================

/**
 * Create odds change insight
 */
export async function createOddsChangeInsight(
  change: OddsChange,
  market: Market
): Promise<void> {
  const direction = change.newYesOdds > change.oldYesOdds ? 'up' : 'down';
  const emoji = direction === 'up' ? '📈' : '📉';
  const magnitude = Math.abs(change.changeMagnitude);
  
  let priority: AIInsightPriority = 'NORMAL';
  if (magnitude >= 20) priority = 'URGENT';
  else if (magnitude >= 10) priority = 'HIGH';
  else if (magnitude < 5) priority = 'LOW';

  const insight: Partial<AIInsight> = {
    market_id: change.marketId,
    celebrity_id: market.celebrity_id,
    type: 'ODDS_CHANGE',
    title: `${market.title.substring(0, 50)}... odds ${direction} ${magnitude}%`,
    description: `YES odds moved from ${(change.oldYesOdds / 100).toFixed(0)}% to ${(change.newYesOdds / 100).toFixed(0)}%. ${
      direction === 'up' 
        ? 'More bettors think YES will win.' 
        : 'Sentiment shifting towards NO.'
    }`,
    old_value: { yes_odds: change.oldYesOdds, no_odds: change.oldNoOdds },
    new_value: { yes_odds: change.newYesOdds, no_odds: change.newNoOdds },
    change_magnitude: change.changeMagnitude,
    priority,
    emoji,
  };

  await supabase.from('ai_insights').insert(insight);
}

/**
 * Create trend alert insight
 */
export async function createTrendAlert(
  trend: TrendData,
  celebrity: Celebrity
): Promise<void> {
  const direction = trend.percentChange > 0 ? 'up' : 'down';
  const emoji = direction === 'up' ? '🔥' : '📉';
  const magnitude = Math.abs(trend.percentChange);
  
  let priority: AIInsightPriority = 'NORMAL';
  if (magnitude >= 50) priority = 'URGENT';
  else if (magnitude >= 25) priority = 'HIGH';
  else if (magnitude < 10) priority = 'LOW';

  const metricLabels: Record<string, string> = {
    spotify_streams: 'Spotify streams',
    youtube_views: 'YouTube views',
    instagram_followers: 'Instagram followers',
    twitter_followers: 'Twitter followers',
    engagement_rate: 'engagement rate',
    trend_score: 'trend score',
    sentiment_score: 'sentiment score',
  };

  const insight: Partial<AIInsight> = {
    celebrity_id: trend.celebrityId,
    type: 'TREND_ALERT',
    title: `${celebrity.name} ${metricLabels[trend.metric] || trend.metric} ${direction} ${magnitude.toFixed(0)}%`,
    description: `${celebrity.name}'s ${metricLabels[trend.metric] || trend.metric} ${
      direction === 'up' ? 'surged' : 'dropped'
    } from ${formatNumber(trend.oldValue)} to ${formatNumber(trend.newValue)}. This may affect related markets.`,
    old_value: { [trend.metric]: trend.oldValue },
    new_value: { [trend.metric]: trend.newValue },
    change_magnitude: Math.round(trend.percentChange),
    priority,
    emoji,
  };

  await supabase.from('ai_insights').insert(insight);
}

/**
 * Create breaking news insight
 */
export async function createBreakingNewsInsight(
  headline: string,
  summary: string,
  celebrityId: string | null,
  relatedMarketIds: string[]
): Promise<void> {
  const insight: Partial<AIInsight> = {
    celebrity_id: celebrityId,
    market_id: relatedMarketIds[0] || null,
    type: 'BREAKING_NEWS',
    title: headline,
    description: summary,
    priority: 'URGENT',
    emoji: '⚡',
    new_value: { related_markets: relatedMarketIds },
  };

  await supabase.from('ai_insights').insert(insight);
}

/**
 * Create confidence update insight
 */
export async function createConfidenceUpdate(
  marketId: string,
  market: Market,
  oldConfidence: number,
  newConfidence: number,
  reason: string
): Promise<void> {
  const direction = newConfidence > oldConfidence ? 'increased' : 'decreased';
  const change = newConfidence - oldConfidence;
  
  const insight: Partial<AIInsight> = {
    market_id: marketId,
    celebrity_id: market.celebrity_id,
    type: 'CONFIDENCE_UPDATE',
    title: `AI confidence ${direction} to ${newConfidence}%`,
    description: `Our AI's confidence in "${market.title.substring(0, 40)}..." ${direction} by ${Math.abs(change)}%. ${reason}`,
    old_value: { confidence: oldConfidence },
    new_value: { confidence: newConfidence },
    change_magnitude: change,
    priority: Math.abs(change) >= 15 ? 'HIGH' : 'NORMAL',
    emoji: newConfidence > oldConfidence ? '🎯' : '❓',
  };

  await supabase.from('ai_insights').insert(insight);
}

/**
 * Create market analysis insight
 */
export async function createMarketAnalysis(
  marketId: string | null,
  celebrityId: string | null,
  title: string,
  analysis: string,
  priority: AIInsightPriority = 'NORMAL'
): Promise<void> {
  const insight: Partial<AIInsight> = {
    market_id: marketId,
    celebrity_id: celebrityId,
    type: 'MARKET_ANALYSIS',
    title,
    description: analysis,
    priority,
    emoji: '🧠',
  };

  await supabase.from('ai_insights').insert(insight);
}

// =====================================================
// INSIGHT FETCHING
// =====================================================

/**
 * Get latest insights for a user
 */
export async function getLatestInsights(
  limit: number = 20
): Promise<AIInsight[]> {
  const { data, error } = await supabase
    .from('ai_insights')
    .select(`
      *,
      market:markets(id, title, status, yes_odds, no_odds),
      celebrity:celebrities(id, name, image_url)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch insights:', error);
    return [];
  }

  return data as AIInsight[];
}

/**
 * Get insights for a specific market
 */
export async function getMarketInsights(
  marketId: string,
  limit: number = 10
): Promise<AIInsight[]> {
  const { data, error } = await supabase
    .from('ai_insights')
    .select('*')
    .eq('market_id', marketId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch market insights:', error);
    return [];
  }

  return data as AIInsight[];
}

/**
 * Get insights for a specific celebrity
 */
export async function getCelebrityInsights(
  celebrityId: string,
  limit: number = 10
): Promise<AIInsight[]> {
  const { data, error } = await supabase
    .from('ai_insights')
    .select('*')
    .eq('celebrity_id', celebrityId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch celebrity insights:', error);
    return [];
  }

  return data as AIInsight[];
}

/**
 * Get unread high-priority insights
 */
export async function getUrgentInsights(): Promise<AIInsight[]> {
  const { data, error } = await supabase
    .from('ai_insights')
    .select('*')
    .in('priority', ['HIGH', 'URGENT'])
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Failed to fetch urgent insights:', error);
    return [];
  }

  return data as AIInsight[];
}

/**
 * Mark insight as read
 */
export async function markInsightRead(insightId: string): Promise<void> {
  await supabase
    .from('ai_insights')
    .update({ is_read: true })
    .eq('id', insightId);
}

/**
 * Mark all insights as read
 */
export async function markAllInsightsRead(): Promise<void> {
  await supabase
    .from('ai_insights')
    .update({ is_read: true })
    .eq('is_read', false);
}

// =====================================================
// MONITORING
// =====================================================

/**
 * Check for significant odds changes across all active markets
 */
export async function monitorOddsChanges(): Promise<void> {
  // Get all active markets with their recent odds history
  const { data: markets, error } = await supabase
    .from('markets')
    .select('*')
    .eq('status', 'ACTIVE');

  if (error || !markets) {
    console.error('Failed to fetch markets for monitoring:', error);
    return;
  }

  // For each market, check if odds have changed significantly
  // This would typically compare to a cached previous value
  // For now, we'll skip as this requires state management
}

/**
 * Monitor celebrity metrics for significant changes
 */
export async function monitorCelebrityMetrics(
  celebrityId: string,
  newMetrics: Record<string, number>,
  oldMetrics: Record<string, number>
): Promise<void> {
  const { data: celebrity, error } = await supabase
    .from('celebrities')
    .select('*')
    .eq('id', celebrityId)
    .single();

  if (error || !celebrity) {
    return;
  }

  // Check each metric for significant changes
  const metricsToMonitor = [
    'spotify_streams',
    'youtube_views',
    'instagram_followers',
    'engagement_rate',
    'trend_score',
    'sentiment_score',
  ];

  for (const metric of metricsToMonitor) {
    const oldValue = oldMetrics[metric] || 0;
    const newValue = newMetrics[metric] || 0;
    
    if (oldValue === 0) continue;
    
    const percentChange = ((newValue - oldValue) / oldValue) * 100;
    
    // Alert if change is significant (>10%)
    if (Math.abs(percentChange) >= 10) {
      await createTrendAlert(
        {
          celebrityId,
          metric,
          oldValue,
          newValue,
          percentChange,
        },
        celebrity as Celebrity
      );
    }
  }
}

// =====================================================
// UTILITIES
// =====================================================

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toFixed(0);
}

// =====================================================
// SUBSCRIPTIONS
// =====================================================

/**
 * Subscribe to real-time insights
 */
export function subscribeToInsights(
  callback: (insight: AIInsight) => void
): () => void {
  const subscription = supabase
    .channel('ai_insights')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'ai_insights',
      },
      (payload) => {
        callback(payload.new as AIInsight);
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}

// =====================================================
// EXPORT
// =====================================================

export const AIInsightsService = {
  createOddsChangeInsight,
  createTrendAlert,
  createBreakingNewsInsight,
  createConfidenceUpdate,
  createMarketAnalysis,
  getLatestInsights,
  getMarketInsights,
  getCelebrityInsights,
  getUrgentInsights,
  markInsightRead,
  markAllInsightsRead,
  monitorOddsChanges,
  monitorCelebrityMetrics,
  subscribeToInsights,
};
