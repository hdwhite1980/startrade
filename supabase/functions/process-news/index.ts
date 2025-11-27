// StarTrade - AI Market Generation Edge Function
// Processes news headlines and generates betting markets using OpenAI GPT-4

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AI Configuration
const AI_CONFIG = {
  model: 'gpt-4-turbo-preview',
  maxTokens: 1024,
  temperature: 0.7,
};

interface AIMarketResponse {
  is_bettable: boolean;
  suggested_title: string;
  suggested_description: string;
  suggested_category: string;
  celebrity_name: string | null;
  yes_odds: number;
  no_odds: number;
  confidence: number;
  reasoning: string;
  viral_score: number;
  resolution_criteria: {
    source: string;
    metric?: string;
    threshold?: number;
    date?: string;
  };
  suggested_close_days: number;
  suggested_resolve_days: number;
}

async function generateMarketFromNews(
  headline: string,
  summary: string | null,
  source: string,
  publishedAt: string,
  celebrityNames: string[],
  openaiApiKey: string
): Promise<AIMarketResponse | null> {
  const prompt = `You are an AI assistant for StarTrade, a celebrity prediction market platform. Analyze this entertainment news headline and determine if it can generate a betting market.

NEWS HEADLINE: "${headline}"
${summary ? `SUMMARY: "${summary}"` : ''}
SOURCE: ${source}
PUBLISHED: ${publishedAt}

KNOWN CELEBRITIES ON PLATFORM: ${celebrityNames.join(', ') || 'None yet'}

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
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        max_tokens: AI_CONFIG.maxTokens,
        temperature: AI_CONFIG.temperature,
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing entertainment news and creating engaging prediction markets. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API error:', error);
      return null;
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return null;
    }

    return JSON.parse(content) as AIMarketResponse;
  } catch (error) {
    console.error('AI generation failed:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get unprocessed news articles
    const { data: articles, error: fetchError } = await supabase
      .from('news_feed')
      .select('*')
      .eq('processed', false)
      .limit(10);

    if (fetchError) {
      throw new Error(`Failed to fetch news: ${fetchError.message}`);
    }

    if (!articles || articles.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No unprocessed articles', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all celebrities for matching
    const { data: celebrities } = await supabase
      .from('celebrities')
      .select('id, name, slug');

    const celebrityNames = celebrities?.map((c) => c.name) || [];

    let processed = 0;
    let marketsCreated = 0;

    for (const article of articles) {
      // Generate market suggestion using AI
      const aiResponse = await generateMarketFromNews(
        article.headline,
        article.summary,
        article.source_outlet || 'Unknown',
        article.published_at || new Date().toISOString(),
        celebrityNames,
        openaiApiKey
      );

      if (aiResponse && aiResponse.is_bettable) {
        // Find celebrity if mentioned
        let celebrityId: string | null = null;
        if (aiResponse.celebrity_name) {
          const matchedCelebrity = celebrities?.find(
            (c) => c.name.toLowerCase().includes(aiResponse.celebrity_name!.toLowerCase())
          );
          celebrityId = matchedCelebrity?.id || null;
        }

        // Calculate dates
        const closeDate = new Date();
        closeDate.setDate(closeDate.getDate() + aiResponse.suggested_close_days);

        const resolveDate = new Date();
        resolveDate.setDate(resolveDate.getDate() + aiResponse.suggested_resolve_days);

        // Determine if auto-publish (high confidence + viral)
        const autoPublish = aiResponse.viral_score >= 8 && aiResponse.confidence >= 80;

        // Store suggestion
        const { data: suggestion, error: suggestionError } = await supabase
          .from('ai_market_suggestions')
          .insert({
            source_headline: article.headline,
            source_url: article.url,
            source_published_at: article.published_at,
            source_outlet: article.source_outlet,
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
            status: autoPublish ? 'AUTO_PUBLISHED' : 'PENDING',
          })
          .select('id')
          .single();

        if (suggestionError) {
          console.error('Failed to store suggestion:', suggestionError);
        } else if (autoPublish && suggestion) {
          // Auto-create market for high-confidence suggestions
          const { data: market, error: marketError } = await supabase
            .from('markets')
            .insert({
              celebrity_id: celebrityId,
              title: aiResponse.suggested_title,
              description: aiResponse.suggested_description,
              category: aiResponse.suggested_category,
              status: 'ACTIVE',
              yes_odds: aiResponse.yes_odds * 100,
              no_odds: aiResponse.no_odds * 100,
              initial_yes_odds: aiResponse.yes_odds * 100,
              initial_no_odds: aiResponse.no_odds * 100,
              closes_at: closeDate.toISOString(),
              resolves_at: resolveDate.toISOString(),
              ai_generated: true,
              ai_confidence: aiResponse.confidence,
              ai_reasoning: aiResponse.reasoning,
              source_headline: article.headline,
              source_url: article.url,
            })
            .select('id')
            .single();

          if (!marketError && market) {
            // Link suggestion to market
            await supabase
              .from('ai_market_suggestions')
              .update({ market_id: market.id })
              .eq('id', suggestion.id);

            marketsCreated++;

            // Create AI insight for new market
            await supabase.from('ai_insights').insert({
              market_id: market.id,
              celebrity_id: celebrityId,
              type: 'BREAKING_NEWS',
              title: '🤖 AI-Generated Market',
              description: `New market created: ${aiResponse.suggested_title}`,
              priority: 'HIGH',
              emoji: '🔥',
            });
          }
        }

        // Update news article
        await supabase
          .from('news_feed')
          .update({
            processed: true,
            processable: true,
            ai_analysis: aiResponse,
            market_generated: autoPublish,
            suggestion_id: suggestion?.id,
          })
          .eq('id', article.id);
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

    return new Response(
      JSON.stringify({
        message: 'Processing complete',
        processed,
        marketsCreated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
