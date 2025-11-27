// StarTrade AI Market Generation Service
// Uses Claude/GPT to analyze news and generate betting markets

import { supabase } from '@/lib/supabase';
import type { AIMarketSuggestion, Celebrity, MarketCategory } from '@/types/database';

// =====================================================
// TYPES
// =====================================================

interface NewsArticle {
  headline: string;
  summary?: string;
  url: string;
  source: string;
  publishedAt: string;
  category?: string;
}

interface AIMarketResponse {
  is_bettable: boolean;
  suggested_title: string;
  suggested_description: string;
  suggested_category: MarketCategory;
  celebrity_name?: string;
  yes_odds: number; // 0-100
  no_odds: number; // 0-100
  confidence: number; // 0-100
  reasoning: string;
  viral_score: number; // 1-10
  resolution_criteria: {
    source: string;
    metric?: string;
    threshold?: number;
    date?: string;
  };
  suggested_close_days: number;
  suggested_resolve_days: number;
}

// =====================================================
// CONFIGURATION
// =====================================================

const AI_CONFIG = {
  model: 'claude-3-sonnet-20240229', // or 'gpt-4-turbo-preview'
  maxTokens: 1024,
  temperature: 0.7,
};

// News API sources
const NEWS_SOURCES = {
  newsapi: 'https://newsapi.org/v2/everything',
  // Add more sources as needed
};

// Categories we care about
const ENTERTAINMENT_KEYWORDS = [
  'album', 'single', 'tour', 'concert', 'streaming', 'spotify',
  'billboard', 'chart', 'grammy', 'oscar', 'emmy', 'golden globe',
  'box office', 'movie', 'film', 'netflix', 'youtube', 'subscribers',
  'followers', 'viral', 'trending', 'tiktok', 'instagram',
  'nba', 'nfl', 'championship', 'playoffs', 'record',
];

// =====================================================
// NEWS FETCHING
// =====================================================

/**
 * Fetch entertainment news from NewsAPI
 */
export async function fetchEntertainmentNews(
  apiKey: string,
  pageSize: number = 20
): Promise<NewsArticle[]> {
  const query = ENTERTAINMENT_KEYWORDS.slice(0, 10).join(' OR ');
  
  const response = await fetch(
    `${NEWS_SOURCES.newsapi}?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=${pageSize}`,
    {
      headers: {
        'X-Api-Key': apiKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`NewsAPI error: ${response.statusText}`);
  }

  const data = await response.json();
  
  return data.articles.map((article: any) => ({
    headline: article.title,
    summary: article.description,
    url: article.url,
    source: article.source.name,
    publishedAt: article.publishedAt,
  }));
}

/**
 * Store news article in database
 */
export async function storeNewsArticle(article: NewsArticle): Promise<string | null> {
  const { data, error } = await supabase
    .from('news_feed')
    .upsert({
      headline: article.headline,
      summary: article.summary,
      url: article.url,
      source_outlet: article.source,
      published_at: article.publishedAt,
      processed: false,
    }, {
      onConflict: 'url',
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to store news:', error);
    return null;
  }

  return data?.id;
}

// =====================================================
// AI MARKET GENERATION
// =====================================================

/**
 * Generate market suggestion from news using AI
 */
export async function generateMarketFromNews(
  article: NewsArticle,
  celebrities: Celebrity[],
  anthropicApiKey: string
): Promise<AIMarketResponse | null> {
  const celebrityNames = celebrities.map(c => c.name).join(', ');
  
  const prompt = `You are an AI assistant for StarTrade, a celebrity prediction market platform. Analyze this entertainment news headline and determine if it can generate a betting market.

NEWS HEADLINE: "${article.headline}"
${article.summary ? `SUMMARY: "${article.summary}"` : ''}
SOURCE: ${article.source}
PUBLISHED: ${article.publishedAt}

KNOWN CELEBRITIES ON PLATFORM: ${celebrityNames}

RULES FOR MARKETS:
1. Must be about a verifiable future outcome
2. Must resolve within 1-90 days
3. Must be based on public data (charts, streams, awards, etc.)
4. Cannot be about personal life, scandals, or sensitive topics
5. Must be engaging and have viral potential
6. YES/NO odds must sum to 100

RESPOND IN THIS EXACT JSON FORMAT:
{
  "is_bettable": true/false,
  "suggested_title": "Will [X] achieve [Y] by [date]?",
  "suggested_description": "Detailed description of the market...",
  "suggested_category": "MUSIC|FILM|SPORTS|SOCIAL|AWARDS|CHARTS|STREAMING|OTHER",
  "celebrity_name": "Name if mentioned, or null",
  "yes_odds": 50,
  "no_odds": 50,
  "confidence": 75,
  "reasoning": "Why these odds...",
  "viral_score": 7,
  "resolution_criteria": {
    "source": "spotify|billboard|youtube|...",
    "metric": "streams|position|subscribers|...",
    "threshold": 1000000000,
    "date": "2025-01-15"
  },
  "suggested_close_days": 7,
  "suggested_resolve_days": 8
}

If the headline cannot generate a valid market, set is_bettable to false and explain why in reasoning.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        max_tokens: AI_CONFIG.maxTokens,
        temperature: AI_CONFIG.temperature,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text;
    
    if (!content) {
      return null;
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in AI response');
      return null;
    }

    return JSON.parse(jsonMatch[0]) as AIMarketResponse;
  } catch (error) {
    console.error('AI generation failed:', error);
    return null;
  }
}

/**
 * Store market suggestion in database
 */
export async function storeMarketSuggestion(
  newsId: string,
  article: NewsArticle,
  aiResponse: AIMarketResponse,
  celebrityId: string | null
): Promise<string | null> {
  const closeDate = new Date();
  closeDate.setDate(closeDate.getDate() + aiResponse.suggested_close_days);
  
  const resolveDate = new Date();
  resolveDate.setDate(resolveDate.getDate() + aiResponse.suggested_resolve_days);

  const { data, error } = await supabase
    .from('ai_market_suggestions')
    .insert({
      source_headline: article.headline,
      source_url: article.url,
      source_published_at: article.publishedAt,
      source_outlet: article.source,
      suggested_title: aiResponse.suggested_title,
      suggested_description: aiResponse.suggested_description,
      suggested_category: aiResponse.suggested_category,
      suggested_celebrity_id: celebrityId,
      suggested_yes_odds: aiResponse.yes_odds * 100, // Convert to basis points
      suggested_no_odds: aiResponse.no_odds * 100,
      suggested_closes_at: closeDate.toISOString(),
      suggested_resolves_at: resolveDate.toISOString(),
      ai_confidence: aiResponse.confidence,
      ai_reasoning: aiResponse.reasoning,
      ai_viral_score: aiResponse.viral_score,
      resolution_criteria: aiResponse.resolution_criteria,
      status: aiResponse.viral_score >= 8 && aiResponse.confidence >= 80 
        ? 'AUTO_PUBLISHED' 
        : 'PENDING',
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to store suggestion:', error);
    return null;
  }

  // Update news article as processed
  await supabase
    .from('news_feed')
    .update({
      processed: true,
      processable: aiResponse.is_bettable,
      ai_analysis: aiResponse,
      market_generated: true,
      suggestion_id: data?.id,
    })
    .eq('id', newsId);

  return data?.id;
}

/**
 * Find celebrity by name
 */
export async function findCelebrityByName(name: string): Promise<Celebrity | null> {
  const { data, error } = await supabase
    .from('celebrities')
    .select('*')
    .ilike('name', `%${name}%`)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Celebrity;
}

/**
 * Create market from approved suggestion
 */
export async function createMarketFromSuggestion(
  suggestionId: string
): Promise<string | null> {
  // Get suggestion
  const { data: suggestion, error: fetchError } = await supabase
    .from('ai_market_suggestions')
    .select('*')
    .eq('id', suggestionId)
    .single();

  if (fetchError || !suggestion) {
    console.error('Suggestion not found:', fetchError);
    return null;
  }

  // Create market
  const { data: market, error: createError } = await supabase
    .from('markets')
    .insert({
      celebrity_id: suggestion.suggested_celebrity_id,
      title: suggestion.suggested_title,
      description: suggestion.suggested_description,
      category: suggestion.suggested_category,
      status: 'ACTIVE',
      yes_odds: suggestion.suggested_yes_odds,
      no_odds: suggestion.suggested_no_odds,
      initial_yes_odds: suggestion.suggested_yes_odds,
      initial_no_odds: suggestion.suggested_no_odds,
      closes_at: suggestion.suggested_closes_at,
      resolves_at: suggestion.suggested_resolves_at,
      ai_generated: true,
      ai_confidence: suggestion.ai_confidence,
      ai_reasoning: suggestion.ai_reasoning,
      source_headline: suggestion.source_headline,
      source_url: suggestion.source_url,
    })
    .select('id')
    .single();

  if (createError) {
    console.error('Failed to create market:', createError);
    return null;
  }

  // Update suggestion with market ID
  await supabase
    .from('ai_market_suggestions')
    .update({
      status: 'APPROVED',
      market_id: market?.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', suggestionId);

  return market?.id;
}

// =====================================================
// ODDS ADJUSTMENT
// =====================================================

/**
 * Adjust odds based on betting volume
 */
export async function adjustMarketOdds(marketId: string): Promise<void> {
  const { data: market, error } = await supabase
    .from('markets')
    .select('yes_pool, no_pool, total_volume')
    .eq('id', marketId)
    .single();

  if (error || !market) {
    return;
  }

  const total = market.yes_pool + market.no_pool;
  if (total === 0) return;

  // Calculate new odds based on betting distribution
  const yesOdds = Math.round((market.yes_pool / total) * 10000);
  const noOdds = Math.round((market.no_pool / total) * 10000);

  // Clamp to reasonable range (1% - 99%)
  const clampedYes = Math.max(100, Math.min(9900, yesOdds));
  const clampedNo = Math.max(100, Math.min(9900, noOdds));

  await supabase
    .from('markets')
    .update({
      yes_odds: clampedYes,
      no_odds: clampedNo,
    })
    .eq('id', marketId);
}

// =====================================================
// BATCH PROCESSING
// =====================================================

/**
 * Process all unprocessed news articles
 */
export async function processNewsQueue(
  anthropicApiKey: string
): Promise<number> {
  // Get unprocessed articles
  const { data: articles, error } = await supabase
    .from('news_feed')
    .select('*')
    .eq('processed', false)
    .limit(10);

  if (error || !articles) {
    console.error('Failed to fetch news queue:', error);
    return 0;
  }

  // Get all celebrities
  const { data: celebrities } = await supabase
    .from('celebrities')
    .select('*');

  let processed = 0;

  for (const article of articles) {
    const aiResponse = await generateMarketFromNews(
      {
        headline: article.headline,
        summary: article.summary,
        url: article.url,
        source: article.source_outlet,
        publishedAt: article.published_at,
      },
      celebrities || [],
      anthropicApiKey
    );

    if (aiResponse && aiResponse.is_bettable) {
      // Find celebrity if mentioned
      let celebrityId: string | null = null;
      if (aiResponse.celebrity_name) {
        const celebrity = await findCelebrityByName(aiResponse.celebrity_name);
        celebrityId = celebrity?.id || null;
      }

      await storeMarketSuggestion(
        article.id,
        {
          headline: article.headline,
          summary: article.summary,
          url: article.url,
          source: article.source_outlet,
          publishedAt: article.published_at,
        },
        aiResponse,
        celebrityId
      );
    } else {
      // Mark as processed but not bettable
      await supabase
        .from('news_feed')
        .update({
          processed: true,
          processable: false,
          ai_analysis: aiResponse,
        })
        .eq('id', article.id);
    }

    processed++;
  }

  return processed;
}

// =====================================================
// EXPORT
// =====================================================

export const AIMarketService = {
  fetchEntertainmentNews,
  storeNewsArticle,
  generateMarketFromNews,
  storeMarketSuggestion,
  findCelebrityByName,
  createMarketFromSuggestion,
  adjustMarketOdds,
  processNewsQueue,
};
