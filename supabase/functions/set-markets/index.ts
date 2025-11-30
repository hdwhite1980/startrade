// Set Markets Edge Function
// Creates/updates the 3 curated markets (WEEKLY, MIDTERM, YEARLY)
// Each market includes rich details scraped from multiple sources

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MarketDetails {
  summary: string;
  key_dates: Array<{ date: string; event: string }>;
  sources: Array<{ name: string; url: string; excerpt: string }>;
  related_links: Array<{ title: string; url: string }>;
  key_players: Array<{ name: string; role: string }>;
  latest_updates: Array<{ date: string; update: string; source: string }>;
  resolution_criteria: string;
  early_resolution_triggers: string[];
}

interface MarketInput {
  tier: 'WEEKLY' | 'MIDTERM' | 'YEARLY';
  title: string;
  description: string;
  category: string;
  celebrity_name?: string;
  yes_odds: number;
  no_odds: number;
  closes_in_days: number;
  details: MarketDetails;
}

// Calculate days until resolution based on tier
const getTierDays = (tier: string): number => {
  switch (tier) {
    case 'WEEKLY': return 7;
    case 'MIDTERM': return 75; // ~2.5 months
    case 'YEARLY': return 365;
    default: return 30;
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, market, topic } = body;

    // ACTION: generate - Use AI to generate a market for a given topic and tier
    if (action === 'generate') {
      const { tier, topic: marketTopic } = body;
      
      if (!tier || !marketTopic) {
        throw new Error('Missing tier or topic');
      }

      const daysUntilResolution = getTierDays(tier);
      const now = new Date();
      
      const prompt = `You are creating a prediction market question for a celebrity/entertainment betting app.

TOPIC: ${marketTopic}
TIER: ${tier} (resolves in approximately ${daysUntilResolution} days)
CURRENT DATE: ${now.toISOString().split('T')[0]}

Create a compelling, polarizing YES/NO question that:
1. Has a clear, verifiable outcome
2. Will generate strong opinions on both sides
3. Matches the timeframe (${tier === 'WEEKLY' ? '~1 week' : tier === 'MIDTERM' ? '~2-3 months' : '~1 year'})
4. Is about something people CARE about and will argue over

IMPORTANT: Gather ALL relevant information about this topic to help bettors make informed decisions.

Respond with JSON only:
{
  "title": "The YES/NO question (make it punchy and clear)",
  "description": "2-3 sentences explaining what we're betting on",
  "category": "MUSIC|FILM|SOCIAL|AWARDS|STREAMING|OTHER",
  "celebrity_name": "Primary celebrity/entity involved (or null)",
  "yes_odds": 5000, // 1-9900, where 5000 = 50%
  "no_odds": 5000,
  "details": {
    "summary": "Comprehensive 3-4 paragraph summary of the situation, background, and why this matters",
    "key_dates": [
      {"date": "YYYY-MM-DD", "event": "Important upcoming date related to this"},
      {"date": "YYYY-MM-DD", "event": "Another key date"}
    ],
    "sources": [
      {"name": "Source Name", "url": "https://...", "excerpt": "Key quote or fact from this source"},
      {"name": "Another Source", "url": "https://...", "excerpt": "Another relevant excerpt"}
    ],
    "related_links": [
      {"title": "Related Article", "url": "https://..."},
      {"title": "Background Info", "url": "https://..."}
    ],
    "key_players": [
      {"name": "Person Name", "role": "Their relevance to this market"},
      {"name": "Another Person", "role": "Why they matter"}
    ],
    "latest_updates": [
      {"date": "YYYY-MM-DD", "update": "Most recent development", "source": "Source name"},
      {"date": "YYYY-MM-DD", "update": "Previous update", "source": "Source name"}
    ],
    "resolution_criteria": "Exactly how this market will be resolved - what counts as YES, what counts as NO",
    "early_resolution_triggers": [
      "Condition that would trigger early YES resolution",
      "Condition that would trigger early NO resolution"
    ]
  }
}`;

      const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.7,
        }),
      });

      const aiData = await aiResponse.json();
      const generatedMarket = JSON.parse(aiData.choices[0].message.content);

      // Validate and map category to allowed values
      const VALID_CATEGORIES = ['MUSIC', 'FILM', 'SOCIAL', 'AWARDS', 'CHARTS', 'STREAMING', 'OTHER'];
      let category = generatedMarket.category?.toUpperCase() || 'OTHER';
      if (!VALID_CATEGORIES.includes(category)) {
        // Map common variations
        if (category === 'LEGAL' || category === 'LAW') category = 'OTHER';
        else if (category === 'GAMING' || category === 'GAMES') category = 'OTHER';
        else if (category === 'ENTERTAINMENT') category = 'OTHER';
        else category = 'OTHER';
      }

      // Calculate dates
      const closesAt = new Date(now.getTime() + daysUntilResolution * 24 * 60 * 60 * 1000);
      const resolvesAt = new Date(closesAt.getTime() + 24 * 60 * 60 * 1000); // +1 day after close

      // Find or create celebrity if specified
      let celebrityId = null;
      if (generatedMarket.celebrity_name) {
        const slug = generatedMarket.celebrity_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        
        const { data: existingCeleb } = await supabase
          .from('celebrities')
          .select('id')
          .eq('slug', slug)
          .single();

        if (existingCeleb) {
          celebrityId = existingCeleb.id;
        } else {
          // Create celebrity
          const { data: newCeleb } = await supabase
            .from('celebrities')
            .insert({
              name: generatedMarket.celebrity_name,
              slug: slug,
              category: generatedMarket.category === 'MUSIC' ? 'Music' : 
                       generatedMarket.category === 'FILM' ? 'Film' :
                       generatedMarket.category === 'GAMING' ? 'Gaming' : 'Social Media',
            })
            .select('id')
            .single();
          
          if (newCeleb) celebrityId = newCeleb.id;
        }
      }

      // Archive any existing active market for this tier
      await supabase
        .from('markets')
        .update({ status: 'CLOSED' })
        .eq('tier', tier)
        .eq('status', 'ACTIVE');

      // Create the new market
      const { data: newMarket, error: marketError } = await supabase
        .from('markets')
        .insert({
          celebrity_id: celebrityId,
          title: generatedMarket.title,
          description: generatedMarket.description,
          category: category,
          tier: tier,
          status: 'ACTIVE',
          yes_odds: generatedMarket.yes_odds,
          no_odds: generatedMarket.no_odds,
          initial_yes_odds: generatedMarket.yes_odds,
          initial_no_odds: generatedMarket.no_odds,
          closes_at: closesAt.toISOString(),
          resolves_at: resolvesAt.toISOString(),
          details_json: generatedMarket.details,
          ai_generated: true,
          ai_confidence: 85,
          ai_reasoning: `Generated for ${tier} tier market`,
        })
        .select()
        .single();

      if (marketError) throw marketError;

      return new Response(
        JSON.stringify({
          message: `${tier} market created successfully`,
          market: newMarket,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: get - Get current active markets
    if (action === 'get') {
      const { data: markets, error } = await supabase
        .from('markets')
        .select('*, celebrity:celebrities(*)')
        .eq('status', 'ACTIVE')
        .not('tier', 'is', null)
        .order('tier');

      if (error) throw error;

      return new Response(
        JSON.stringify({ markets }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: set - Manually set a market (for admin use)
    if (action === 'set') {
      const marketInput: MarketInput = market;
      
      if (!marketInput || !marketInput.tier || !marketInput.title) {
        throw new Error('Missing market data');
      }

      const now = new Date();
      const closesAt = new Date(now.getTime() + marketInput.closes_in_days * 24 * 60 * 60 * 1000);
      const resolvesAt = new Date(closesAt.getTime() + 24 * 60 * 60 * 1000);

      // Archive existing market for this tier
      await supabase
        .from('markets')
        .update({ status: 'CLOSED' })
        .eq('tier', marketInput.tier)
        .eq('status', 'ACTIVE');

      // Create new market
      const { data: newMarket, error } = await supabase
        .from('markets')
        .insert({
          title: marketInput.title,
          description: marketInput.description,
          category: marketInput.category,
          tier: marketInput.tier,
          status: 'ACTIVE',
          yes_odds: marketInput.yes_odds,
          no_odds: marketInput.no_odds,
          initial_yes_odds: marketInput.yes_odds,
          initial_no_odds: marketInput.no_odds,
          closes_at: closesAt.toISOString(),
          resolves_at: resolvesAt.toISOString(),
          details_json: marketInput.details,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ message: 'Market set successfully', market: newMarket }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action. Use: generate, get, or set');

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
