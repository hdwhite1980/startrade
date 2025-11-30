// Cleanup Markets - Admin function to delete all markets and reset news
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Use service role to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Delete in order to respect foreign keys
    const results: Record<string, any> = {};

    // 1. Delete ai_market_suggestions
    const { error: suggestionsError, count: suggestionsCount } = await supabase
      .from('ai_market_suggestions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    results.ai_market_suggestions = { deleted: !suggestionsError, error: suggestionsError?.message };

    // 2. Delete ai_insights
    const { error: insightsError } = await supabase
      .from('ai_insights')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    results.ai_insights = { deleted: !insightsError, error: insightsError?.message };

    // 3. Delete bets
    const { error: betsError } = await supabase
      .from('bets')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    results.bets = { deleted: !betsError, error: betsError?.message };

    // 4. Delete markets
    const { error: marketsError } = await supabase
      .from('markets')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    results.markets = { deleted: !marketsError, error: marketsError?.message };

    // 5. Reset news_feed to unprocessed
    const { error: newsError } = await supabase
      .from('news_feed')
      .update({ processed: false, market_generated: false })
      .neq('id', '00000000-0000-0000-0000-000000000000');
    results.news_feed = { reset: !newsError, error: newsError?.message };

    // 6. Optional: Delete celebrities too
    const { error: celebsError } = await supabase
      .from('celebrities')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    results.celebrities = { deleted: !celebsError, error: celebsError?.message };

    return new Response(
      JSON.stringify({
        message: 'Cleanup complete',
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
