// Process News - AI Market Generation for StarTrade
// Creates celebrities on-demand with researched data when market involves them
// IMPORTANT: Only creates markets for FUTURE events that haven't happened yet
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get current date for context
const getCurrentDateContext = () => {
  const now = new Date();
  return {
    date: now.toISOString().split('T')[0],
    year: now.getFullYear(),
    month: now.toLocaleString('en-US', { month: 'long' }),
    dayOfWeek: now.toLocaleString('en-US', { weekday: 'long' }),
  };
};

interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  url: string;
  source_outlet: string;
  published_at: string;
}

interface MarketSuggestion {
  title: string;
  description: string;
  category: string;
  celebrity_name: string | null;
  celebrity_category: string | null;
  yes_odds: number;
  no_odds: number;
  confidence: number;
  reasoning: string;
  closes_in_days: number;
  resolves_in_days: number;
}

interface CelebrityResearch {
  name: string;
  category: string;
  bio: string;
  metrics: {
    spotify_streams: number;
    youtube_views: number;
    instagram_followers: number;
    twitter_followers: number;
    tiktok_followers: number;
    trend_score: number;
    sentiment_score: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch unprocessed news
    const { data: newsItems, error: newsError } = await supabase
      .from('news_feed')
      .select('*')
      .eq('processed', false)
      .limit(10);

    if (newsError) throw newsError;
    if (!newsItems || newsItems.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No unprocessed news items' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let marketsCreated = 0;
    let celebritiesCreated = 0;

    for (const news of newsItems as NewsItem[]) {
      try {
        // Get current date context for AI
        const dateContext = getCurrentDateContext();
        
  // Ask AI to analyze and create market suggestion
  // FOCUS: Only high-stakes, polarizing topics with clear outcomes
  const analysisPrompt = `You are a prediction market expert who creates VIRAL, POLARIZING betting questions.
Your job is to find the most CONTROVERSIAL and ENGAGING angles on news stories, and REJECT soft content that people won't fight over.

CURRENT DATE: ${dateContext.date} (${dateContext.dayOfWeek}, ${dateContext.month} ${dateContext.year})

NEWS TO ANALYZE:
Headline: "${news.headline}"
Summary: "${news.summary || 'No summary available'}"
Source: ${news.source_outlet}
Published: ${news.published_at || 'Unknown'}

=== WHAT MAKES A GREAT MARKET ===

🔥 HIGH-STAKES DRAMA - Things with real consequences (PRIORITIZE THESE):
- Legal battles: "Will Diddy get less than 10 years?" "Will Young Thug's charges be dropped?"
- Career-ending moments: "Will [artist] ever release music again?"
- Billion-dollar decisions: "Will the Drake vs Kendrick beef result in a diss track response?"

🎮 GAMING & ESPORTS - Huge passionate fanbases (MEGATITLES ONLY):
- "Will GTA 6 actually release in Fall 2025?"
- "Will [game] be delayed again?"
- "Will [streamer] hit 100K subscribers by [date]?"
- "Will [esports team] win the championship?"

💔 RELATIONSHIP DRAMA - Only A-list couples or confirmed rumors:
- "Will [celebrity couple] break up by end of year?"
- "Will [artist] confirm dating [person]?"
- Celebrity divorces, cheating scandals, surprise marriages

🏆 AWARDS & ACHIEVEMENTS - Clear winners/losers (TOP awards only):
- "Will [artist] win Album of the Year at the Grammys?"
- "Will [movie] win Best Picture?"
- "Will [artist] go #1 on Billboard with their next single?"
- "Will [streamer] win Streamer of the Year?"

📉 FAILS & FLOPS - Schadenfreude sells (avoid generic PR fluff):
- "Will [hyped project] flop on release?"
- "Will [tour] get cancelled?"
- "Will [controversial figure] face consequences?"

🤝 BEEFS & FEUDS - Pick a side (only real, current feuds):
- Artist vs Artist battles
- Label disputes going public
- Social media wars

=== POLARIZING EXAMPLES (GOOD) ===
✅ "Will Diddy be found GUILTY on federal charges?"
✅ "Will GTA 6 actually release before 2026?"
✅ "Will Drake drop a Kendrick response track?"
✅ "Will Taylor Swift and Travis Kelce get engaged in 2025?"
✅ "Will Kanye's next album go #1?"
✅ "Will the Minecraft movie flop at box office?"
✅ "Will Young Thug get released from prison this year?"
✅ "Will Ice Spice fall off in 2025?" 
✅ "Will Beyoncé finally win Album of the Year?"
✅ "Will xQc hit 15 million followers this year?"

=== REJECT THESE (BORING / LOW-STAKES) ===
❌ Brand campaigns, endorsements, micro-trends
❌ Local politics without national attention
❌ Soft PR news (new podcast, minor collab, charity events)
❌ Vague predictions like "will release music" or "will do well"
❌ Anything about past events

=== RULES ===
1. ONLY future events that haven't happened yet
2. Must be VERIFIABLE with clear YES/NO outcome
3. Must be something people will ARGUE about
4. Stakes should feel REAL (careers, money, relationships, legacy)
5. Question should make someone say "Oh I HAVE to bet on this"

=== ODDS GUIDANCE ===
- 5000 = 50% (coin flip - maximum engagement!)
- 6500 = 65% likely (slight favorite)
- 3500 = 35% likely (underdog but possible)
- 7500 = 75% likely (heavy favorite)
- 2500 = 25% likely (long shot)
- Controversial topics should be closer to 50/50 to maximize bets on both sides

=== VIRALITY SCORE ===
Rate 1-10 how likely this question is to:
- Get shared on social media
- Start arguments in comments
- Make people NEED to place a bet

Only create markets with virality score 8+ (otherwise reject)

Respond with JSON only:
{
  "should_create_market": boolean,
  "rejection_reason": "Why rejected (if not creating market)",
  "is_future_event": boolean,
  "virality_score": 1-10,
  "event_date_estimate": "YYYY-MM-DD or 'unknown'",
  "market": {
  "title": "Polarizing YES/NO question that people will FIGHT over (legal, release date, feud, awards)",
    "description": "What we're predicting and exactly how it resolves",
  "category": "LEGAL|GAMING|AWARDS|MUSIC|FILM|STREAMING|SOCIAL|OTHER",
    "celebrity_name": "Main celebrity/company involved or null",
    "celebrity_category": "Music|Film|Social Media|TV|Gaming|Tech or null",
    "yes_odds": number 1500-8500 (closer to 5000 = more bets),
    "no_odds": number 1500-8500,
    "confidence": 1-100,
  "reasoning": "Why people will be DIVIDED on this (cite specific stakes, dates, outcomes)",
    "closes_in_days": number,
    "resolves_in_days": number
  }
}`;

        const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4-turbo-preview',
            messages: [{ role: 'user', content: analysisPrompt }],
            response_format: { type: 'json_object' },
            temperature: 0.7,
          }),
        });

        const analysisData = await analysisResponse.json();
        const analysis = JSON.parse(analysisData.choices[0].message.content);

        // Mark as processed with analysis
        await supabase
          .from('news_feed')
          .update({ 
            processed: true, 
            processable: analysis.should_create_market && analysis.is_future_event,
            ai_analysis: analysis
          })
          .eq('id', news.id);

        // CRITICAL: Double-check this is a future event
        if (!analysis.should_create_market) {
          console.log(`Skipped: ${analysis.rejection_reason || 'AI rejected'}`);
          continue;
        }
        
        if (!analysis.is_future_event) {
          console.log(`Skipped: Event is not in the future`);
          continue;
        }

        // Check virality score - only create markets people will actually bet on
        if (analysis.virality_score < 8) {
          console.log(`Skipped: Low virality score (${analysis.virality_score}/10) - not polarizing enough`);
          continue;
        }

        // Additional validation: ensure closes_in_days is reasonable
        const suggestion: MarketSuggestion = analysis.market;
        if (suggestion.closes_in_days < 1 || suggestion.closes_in_days > 365) {
          console.log(`Skipped: Invalid closes_in_days (${suggestion.closes_in_days})`);
          continue;
        }

        // Extra hard filters to keep output on-brand
        const titleLower = suggestion.title.toLowerCase();
        const isLowStakesTrend = /(trend|look|outfit|fashion|meme|viral|beauty|sale|deal)/i.test(titleLower);
        if (isLowStakesTrend) {
          console.log(`Skipped: Low-stakes/trend topic: ${suggestion.title}`);
          continue;
        }

        let celebrityId: string | null = null;

        // If market involves a celebrity, find or create them
        if (suggestion.celebrity_name) {
          const slug = suggestion.celebrity_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          
          // Check if celebrity exists
          const { data: existingCelebrity } = await supabase
            .from('celebrities')
            .select('id')
            .eq('slug', slug)
            .single();

          if (existingCelebrity) {
            celebrityId = existingCelebrity.id;
          } else {
            // Research celebrity data with AI
            const researchPrompt = `Research this celebrity and provide real estimated data:

Name: ${suggestion.celebrity_name}
Category: ${suggestion.celebrity_category || 'Entertainment'}

Provide realistic estimates based on your knowledge. Respond with JSON only:
{
  "name": "${suggestion.celebrity_name}",
  "category": "${suggestion.celebrity_category || 'Music'}",
  "bio": "Brief 1-2 sentence bio",
  "metrics": {
    "spotify_streams": estimated monthly listeners or 0 if not musician,
    "youtube_views": estimated total views,
    "instagram_followers": estimated count,
    "twitter_followers": estimated count,
    "tiktok_followers": estimated count,
    "trend_score": 1-100 based on current relevance,
    "sentiment_score": -100 to 100 based on public perception
  }
}`;

            const researchResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openaiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gpt-4-turbo-preview',
                messages: [{ role: 'user', content: researchPrompt }],
                response_format: { type: 'json_object' },
                temperature: 0.3,
              }),
            });

            const researchData = await researchResponse.json();
            const research: CelebrityResearch = JSON.parse(researchData.choices[0].message.content);

            // Create celebrity
            const { data: newCelebrity, error: celebError } = await supabase
              .from('celebrities')
              .insert({
                name: research.name,
                slug: slug,
                category: research.category,
                bio: research.bio,
                metrics: research.metrics,
              })
              .select('id')
              .single();

            if (celebError) {
              console.error('Error creating celebrity:', celebError);
            } else {
              celebrityId = newCelebrity.id;
              celebritiesCreated++;
            }
          }
        }

        // Calculate dates
        const now = new Date();
        const closesAt = new Date(now.getTime() + suggestion.closes_in_days * 24 * 60 * 60 * 1000);
        const resolvesAt = new Date(now.getTime() + suggestion.resolves_in_days * 24 * 60 * 60 * 1000);

        // Create market
        const { error: marketError } = await supabase
          .from('markets')
          .insert({
            celebrity_id: celebrityId,
            title: suggestion.title,
            description: suggestion.description,
            category: suggestion.category,
            status: 'ACTIVE',
            yes_odds: suggestion.yes_odds,
            no_odds: suggestion.no_odds,
            initial_yes_odds: suggestion.yes_odds,
            initial_no_odds: suggestion.no_odds,
            closes_at: closesAt.toISOString(),
            resolves_at: resolvesAt.toISOString(),
            ai_generated: true,
            ai_confidence: suggestion.confidence,
            ai_reasoning: suggestion.reasoning,
            source_headline: news.headline,
            source_url: news.url,
          });

        if (marketError) {
          console.error('Error creating market:', marketError);
        } else {
          marketsCreated++;
          
          // Mark news as market generated
          await supabase
            .from('news_feed')
            .update({ market_generated: true })
            .eq('id', news.id);
        }

      } catch (itemError) {
        console.error('Error processing news item:', itemError);
        // Mark as processed to avoid infinite loop
        await supabase
          .from('news_feed')
          .update({ processed: true, processable: false })
          .eq('id', news.id);
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Processing complete',
        processed: newsItems.length,
        marketsCreated,
        celebritiesCreated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
