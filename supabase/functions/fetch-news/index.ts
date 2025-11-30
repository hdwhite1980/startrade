// StarTrade - News Fetcher Edge Function
// Fetches entertainment news from NewsAPI and stores in database
// FOCUS: POLARIZING topics - Legal drama, beefs, gaming, relationships, high-stakes events

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =============================================================
// HIGH-ENGAGEMENT TOPICS - Stuff people will actually bet on
// =============================================================

// LEGAL DRAMA - Everyone has an opinion
const LEGAL_DRAMA = [
  'Diddy trial', 'Diddy case', 'Diddy charges', 'Sean Combs',
  'Young Thug trial', 'Young Thug case', 'YSL trial',
  'Tory Lanez', 'R Kelly', 'Harvey Weinstein',
  'lawsuit', 'indictment', 'verdict', 'sentenced', 'prison',
  'federal charges', 'racketeering', 'trafficking',
];

// GAMING - Massive passionate fanbases
const GAMING_TOPICS = [
  'GTA 6', 'GTA VI', 'Rockstar Games', 'Grand Theft Auto',
  'Call of Duty', 'Fortnite', 'Minecraft movie',
  'PlayStation', 'Xbox', 'Nintendo', 'Switch 2',
  'game delay', 'release date', 'launch',
  'Twitch', 'streaming', 'esports',
];

// CELEBRITY BEEFS - Pick a side
const BEEFS_AND_FEUDS = [
  'Drake Kendrick', 'Drake beef', 'Kendrick beef', 'diss track',
  'Nicki Cardi', 'Nicki Minaj Cardi B',
  'Kanye', 'Ye', 'feud', 'beef', 'claps back', 'responds',
  'shots fired', 'subliminal', 'rivalry',
];

// RELATIONSHIP DRAMA - Obsession fuel
const RELATIONSHIP_DRAMA = [
  'Taylor Swift Travis Kelce', 'engaged', 'engagement',
  'breakup', 'divorce', 'split', 'dating', 'married',
  'pregnant', 'baby', 'cheating scandal', 'affair',
  'Kardashian', 'celebrity couple',
];

// AWARDS & ACHIEVEMENTS - Clear winners
const AWARDS_TOPICS = [
  'Grammy', 'Grammys 2025', 'Grammy nominations',
  'Oscar', 'Academy Awards', 'Best Picture',
  'Billboard', 'number one', '#1', 'platinum',
  'MTV VMA', 'BET Awards', 'American Music Awards',
];

// FLOPS & FAILS - Schadenfreude
const FLOPS_AND_FAILS = [
  'flop', 'flopped', 'bombed', 'disaster', 'cancelled',
  'delayed', 'postponed', 'controversy', 'backlash',
  'worst', 'failure', 'tanked',
];

// BIG RELEASES - Will it deliver?
const BIG_RELEASES = [
  'album release', 'new album', 'drops', 'releasing',
  'movie release', 'box office', 'premiere',
  'tour announcement', 'world tour', 'concert',
  'comeback', 'return', 'new music',
];

// Combine all into search groups
const POLARIZING_TOPICS = [
  ...LEGAL_DRAMA,
  ...GAMING_TOPICS,
  ...BEEFS_AND_FEUDS,
  ...RELATIONSHIP_DRAMA,
  ...AWARDS_TOPICS,
  ...FLOPS_AND_FAILS,
  ...BIG_RELEASES,
];

// High-profile names people care about
const HOT_NAMES = [
  // Legal drama figures
  'Diddy', 'Sean Combs', 'Young Thug',
  // Music heavyweights  
  'Drake', 'Kendrick Lamar', 'Taylor Swift', 'Beyonce', 'Kanye', 'Ye',
  'Travis Scott', 'Nicki Minaj', 'Cardi B', 'Ice Spice', 'SZA',
  // Relationship drama
  'Travis Kelce', 'Kardashian', 'Kim Kardashian',
  // Gaming
  'Rockstar', 'GTA',
];

// Keywords that indicate FUTURE events (good for prediction markets)
const FUTURE_KEYWORDS = [
  'will', 'expected', 'set to', 'plans to', 'announces',
  'reportedly', 'rumored', 'could', 'may', 'upcoming',
  'scheduled', 'slated', 'confirmed for', 'coming',
];

// Keywords that indicate PAST events (skip these)
const PAST_EVENT_INDICATORS = [
  'won', 'wins', 'defeated', 'beats', 'beat ', 'lost to', 'swept',
  'review:', 'recap', 'highlights', 'broke record', 'achieved',
];

// Terms that indicate non-entertainment content to filter out
const EXCLUDE_TERMS = ['politician', 'election', 'congress', 'senate'];

// Prefer entertainment and gaming outlets
const PREFERRED_DOMAINS = [
  'tmz.com', 'variety.com', 'hollywoodreporter.com', 'deadline.com', 'rollingstone.com',
  'billboard.com', 'complex.com', 'pitchfork.com', 'hiphopdx.com', 'xxlmag.com',
  'ign.com', 'gamespot.com', 'kotaku.com', 'polygon.com', 'pcgamer.com', 'gameinformer.com',
  'screenrant.com', 'theverge.com'
].join(',');

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

    // Build search query - focus on POLARIZING topics
    // Strategy: Mix hot names with controversial topics for maximum engagement
    const randomNames = HOT_NAMES
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    
    const randomTopics = POLARIZING_TOPICS
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    
    const randomFuture = FUTURE_KEYWORDS
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);
    
  // Combine: "(Diddy OR Drake OR GTA 6) AND (trial OR beef OR release)"
    const nameQuery = randomNames.map((n: string) => `"${n}"`).join(' OR ');
    const topicQuery = [...randomTopics, ...randomFuture].join(' OR ');
    // Drop NOT exclusion; filter post-fetch to keep query short
    const query = `(${nameQuery}) AND (${topicQuery})`;

    // Fetch from NewsAPI - last 7 days for enough volume
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fromDate = sevenDaysAgo.toISOString().split('T')[0];

    // No domain filter on initial request to increase volume
    const requestUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&from=${fromDate}&pageSize=50`;
    let newsResponse = await fetch(requestUrl, {
      headers: { 'X-Api-Key': newsApiKey },
    });

    // If the domain-restricted query yields nothing, fallback to a broader search without domain limits and more generic future terms
    if (newsResponse.ok) {
      const preview = await newsResponse.clone().json().catch(() => ({ articles: [] }));
      if (!preview.articles || preview.articles.length === 0) {
        const fallbackFuture = ['will', 'expected', 'may', 'rumored'];
  const fallbackTopics = [...LEGAL_DRAMA, ...GAMING_TOPICS].slice(0, 6).join(' OR ');
  // Shorter query in fallback to avoid hitting NewsAPI max length
  const fallbackQuery = `(${nameQuery}) AND (${fallbackTopics} OR ${fallbackFuture.join(' OR ')})`;
  const fallbackUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(fallbackQuery)}&language=en&sortBy=publishedAt&from=${fromDate}&pageSize=50`;
        newsResponse = await fetch(fallbackUrl, { headers: { 'X-Api-Key': newsApiKey } });
      }
    }

    if (!newsResponse.ok) {
      const error = await newsResponse.text();
      throw new Error(`NewsAPI error: ${error}`);
    }

    const newsData = await newsResponse.json();
    let stored = 0;
    let duplicates = 0;
    let skippedPast = 0;

    for (const article of newsData.articles || []) {
      // Skip articles without proper data
      if (!article.title || !article.url) continue;
      
      // Skip articles that are clearly about past events OR irrelevant content
      const lowerTitle = article.title.toLowerCase();
      const isPastEvent = PAST_EVENT_INDICATORS.some(indicator => 
        lowerTitle.includes(indicator.toLowerCase())
      );
      const isIrrelevant = EXCLUDE_TERMS.some(t => lowerTitle.includes(t.toLowerCase()));
      
      if (isPastEvent || isIrrelevant) {
        skippedPast++;
        continue;
      }

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
        skippedPastEvents: skippedPast,
        searchQuery: query,
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
