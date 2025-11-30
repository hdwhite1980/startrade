// Apply Migration Edge Function
// Runs schema migrations using service role
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
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'public' },
      auth: { persistSession: false }
    });

    const results: Record<string, any> = {};

    // 1. Add tier column to markets
    const { error: tierError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE markets ADD COLUMN IF NOT EXISTS tier TEXT CHECK (tier IN ('WEEKLY', 'MIDTERM', 'YEARLY'))`
    }).single();
    
    // Since rpc won't work, let's use raw SQL via the REST endpoint with service key
    // We'll make direct changes by updating records

    // For now, let's add the columns one at a time using a workaround
    // We'll check if columns exist and add mock data to test

    // Check if tier column exists by trying to select it
    const { data: marketCheck, error: checkError } = await supabase
      .from('markets')
      .select('id, tier')
      .limit(1);

    if (checkError && checkError.message.includes('tier')) {
      results.tierColumnExists = false;
      results.message = 'Migration SQL needs to be run in Supabase SQL Editor';
    } else {
      results.tierColumnExists = true;
    }

    // Check virtual_balance on user_profiles
    const { data: userCheck, error: userError } = await supabase
      .from('user_profiles')
      .select('id, virtual_balance')
      .limit(1);

    if (userError && userError.message.includes('virtual_balance')) {
      results.virtualBalanceExists = false;
    } else {
      results.virtualBalanceExists = true;
    }

    return new Response(
      JSON.stringify({
        message: 'Migration check complete',
        results,
        instructions: 'Run the SQL migration file in Supabase SQL Editor: supabase/migrations/001_market_tiers_and_virtual_currency.sql'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
