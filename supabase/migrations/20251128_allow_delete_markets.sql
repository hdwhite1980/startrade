-- Allow anonymous users to delete markets (for cleanup)
DROP POLICY IF EXISTS "Allow delete on markets" ON markets;
CREATE POLICY "Allow delete on markets" ON markets FOR DELETE USING (true);

-- Also allow delete on news_feed for cleanup
DROP POLICY IF EXISTS "Allow delete on news_feed" ON news_feed;
CREATE POLICY "Allow delete on news_feed" ON news_feed FOR DELETE USING (true);
