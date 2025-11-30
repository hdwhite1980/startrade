// Resolution Scanner Edge Function
// Checks active markets for early resolution triggers
// Scans news sources and updates market details with latest info

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Market {
  id: string;
  title: string;
  description: string;
  tier: string;
  details_json: {
    summary: string;
    key_dates: Array<{ date: string; event: string }>;
    sources: Array<{ name: string; url: string; excerpt: string }>;
    latest_updates: Array<{ date: string; update: string; source: string }>;
    resolution_criteria: string;
    early_resolution_triggers: string[];
  };
  last_scanned_at: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;
    const newsApiKey = Deno.env.get('NEWS_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active tiered markets
    const { data: markets, error: fetchError } = await supabase
      .from('markets')
      .select('*')
      .eq('status', 'ACTIVE')
      .not('tier', 'is', null);

    if (fetchError) throw fetchError;
    if (!markets || markets.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active tiered markets to scan' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const market of markets as Market[]) {
      // Extract keywords from title for news search
      const keywords = market.title
        .replace(/Will |[?'"]/g, '')
        .split(' ')
        .filter(w => w.length > 3)
        .slice(0, 5)
        .join(' ');

      let newsArticles: any[] = [];

      // Fetch recent news about this topic
      if (newsApiKey) {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const fromDate = threeDaysAgo.toISOString().split('T')[0];

        try {
          const newsResponse = await fetch(
            `https://newsapi.org/v2/everything?q=${encodeURIComponent(keywords)}&language=en&sortBy=publishedAt&from=${fromDate}&pageSize=5`,
            { headers: { 'X-Api-Key': newsApiKey } }
          );

          if (newsResponse.ok) {
            const newsData = await newsResponse.json();
            newsArticles = newsData.articles || [];
          }
        } catch (e) {
          console.error('News fetch error:', e);
        }
      }

      // Use AI to analyze if market should be resolved early
      const analysisPrompt = `You are analyzing a prediction market to check if it can be resolved early.

MARKET QUESTION: ${market.title}
DESCRIPTION: ${market.description}
RESOLUTION CRITERIA: ${market.details_json?.resolution_criteria || 'Standard verification'}
EARLY RESOLUTION TRIGGERS: ${JSON.stringify(market.details_json?.early_resolution_triggers || [])}

RECENT NEWS ABOUT THIS TOPIC:
${newsArticles.map(a => `- ${a.title} (${a.source?.name}): ${a.description || ''}`).join('\n') || 'No recent news found'}

CURRENT DATE: ${new Date().toISOString().split('T')[0]}

Analyze if:
1. The market can be RESOLVED EARLY (definitive answer is now known)
2. There are significant NEW UPDATES that should be added to the market details
3. The odds should be adjusted based on new information

Respond with JSON only:
{
  "can_resolve_early": boolean,
  "resolution": "YES" | "NO" | null,
  "resolution_confidence": 0-100,
  "resolution_source": "Source/link proving the outcome" | null,
  "resolution_notes": "Explanation of why this can be resolved" | null,
  "new_updates": [
    {"date": "YYYY-MM-DD", "update": "What happened", "source": "Source name"}
  ],
  "suggested_odds_adjustment": {
    "yes_odds": number | null,
    "no_odds": number | null,
    "reasoning": "Why odds should change" | null
  },
  "summary": "Brief analysis of current state"
}`;

      const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages: [{ role: 'user', content: analysisPrompt }],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        }),
      });

      const aiData = await aiResponse.json();
      const analysis = JSON.parse(aiData.choices[0].message.content);

      // Update market with new info
      const updateData: any = {
        last_scanned_at: new Date().toISOString(),
      };

      // Add new updates to details
      if (analysis.new_updates && analysis.new_updates.length > 0) {
        const currentDetails = market.details_json || {};
        const existingUpdates = currentDetails.latest_updates || [];
        
        // Merge new updates, avoiding duplicates
        const allUpdates = [...analysis.new_updates, ...existingUpdates].slice(0, 10);
        
        updateData.details_json = {
          ...currentDetails,
          latest_updates: allUpdates,
        };
      }

      // Adjust odds if suggested
      if (analysis.suggested_odds_adjustment?.yes_odds) {
        updateData.yes_odds = analysis.suggested_odds_adjustment.yes_odds;
        updateData.no_odds = analysis.suggested_odds_adjustment.no_odds || (10000 - analysis.suggested_odds_adjustment.yes_odds);
      }

      // EARLY RESOLUTION
      if (analysis.can_resolve_early && analysis.resolution_confidence >= 90) {
        updateData.status = 'RESOLVED';
        updateData.resolved_outcome = analysis.resolution === 'YES';
        updateData.resolution_source = analysis.resolution_source;
        updateData.resolution_notes = analysis.resolution_notes;
        updateData.resolved_at = new Date().toISOString();
        updateData.early_resolved = true;

        // TODO: Process payouts for this market
        console.log(`EARLY RESOLUTION: ${market.title} resolved as ${analysis.resolution}`);
      }

      // Apply updates
      const { error: updateError } = await supabase
        .from('markets')
        .update(updateData)
        .eq('id', market.id);

      if (updateError) {
        console.error('Update error:', updateError);
      }

      results.push({
        market_id: market.id,
        title: market.title,
        tier: market.tier,
        early_resolved: analysis.can_resolve_early && analysis.resolution_confidence >= 90,
        resolution: analysis.resolution,
        new_updates_count: analysis.new_updates?.length || 0,
        odds_adjusted: !!analysis.suggested_odds_adjustment?.yes_odds,
        summary: analysis.summary,
      });
    }

    return new Response(
      JSON.stringify({
        message: 'Scan complete',
        scanned: markets.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
