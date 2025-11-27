# Supabase Edge Functions Configuration
# Add these secrets in Supabase Dashboard > Project Settings > Edge Functions

# Required Secrets:
# - OPENAI_API_KEY: Your OpenAI API key (already in .env)
# - NEWS_API_KEY: Get free key from https://newsapi.org

# Deployment:
# 1. Install Supabase CLI: npm install -g supabase
# 2. Login: supabase login
# 3. Link project: supabase link --project-ref jymtchtqphanosxpguqi
# 4. Set secrets:
#    supabase secrets set OPENAI_API_KEY=sk-your-key
#    supabase secrets set NEWS_API_KEY=your-newsapi-key
# 5. Deploy functions:
#    supabase functions deploy fetch-news
#    supabase functions deploy process-news

# Scheduled Execution (via pg_cron in Supabase):
# Run this SQL in Supabase SQL Editor after deploying functions:

# -- Enable pg_cron extension
# CREATE EXTENSION IF NOT EXISTS pg_cron;
#
# -- Fetch news every hour
# SELECT cron.schedule(
#   'fetch-news-hourly',
#   '0 * * * *',
#   $$
#   SELECT net.http_post(
#     url := 'https://jymtchtqphanosxpguqi.supabase.co/functions/v1/fetch-news',
#     headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
#   );
#   $$
# );
#
# -- Process news every hour (15 min after fetch)
# SELECT cron.schedule(
#   'process-news-hourly',
#   '15 * * * *',
#   $$
#   SELECT net.http_post(
#     url := 'https://jymtchtqphanosxpguqi.supabase.co/functions/v1/process-news',
#     headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
#   );
#   $$
# );

# Manual Testing:
# curl -X POST https://jymtchtqphanosxpguqi.supabase.co/functions/v1/fetch-news \
#   -H "Authorization: Bearer YOUR_ANON_KEY"
#
# curl -X POST https://jymtchtqphanosxpguqi.supabase.co/functions/v1/process-news \
#   -H "Authorization: Bearer YOUR_ANON_KEY"
