// StarTrade - News Fetcher Edge Function
// Fetches entertainment news from NewsAPI and stores in database

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Entertainment keywords to search for
const ENTERTAINMENT_KEYWORDS = [
  'album release', 'billboard', 'grammy', 'oscar', 'emmy',
  'spotify streams', 'youtube subscribers', 'box office',
  'tour announcement', 'netflix', 'viral', 'trending',
  'nba', 'nfl', 'championship', 'super bowl',
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const newsApiKey = Deno.env.get('NEWS_API_KEY');

    if (!newsApiKey) {
      throw new Error('NEWS_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build search query
    const query = ENTERTAINMENT_KEYWORDS.slice(0, 5).join(' OR ');

    // Fetch from NewsAPI
    const newsResponse = await fetch(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=20`,
      {
        headers: {
          'X-Api-Key': newsApiKey,
        },
      }
    );

    if (!newsResponse.ok) {
      const error = await newsResponse.text();
      throw new Error(`NewsAPI error: ${error}`);
    }

    const newsData = await newsResponse.json();
    let stored = 0;
    let duplicates = 0;

    for (const article of newsData.articles || []) {
      // Skip articles without proper data
      if (!article.title || !article.url) continue;

      const { error } = await supabase
        .from('news_feed')
        .upsert(
          {
            headline: article.title,
            summary: article.description,
            url: article.url,
            source_outlet: article.source?.name,
            published_at: article.publishedAt,
            processed: false,
          },
          { onConflict: 'url' }
        );

      if (error) {
        if (error.code === '23505') {
          duplicates++;
        } else {
          console.error('Failed to store article:', error);
        }
      } else {
        stored++;
      }
    }

    return new Response(
      JSON.stringify({
        message: 'News fetch complete',
        total: newsData.articles?.length || 0,
        stored,
        duplicates,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
