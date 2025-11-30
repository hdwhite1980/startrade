-- Allow anonymous users to delete for cleanup purposes
DROP POLICY IF EXISTS "Allow delete on ai_market_suggestions" ON ai_market_suggestions;
CREATE POLICY "Allow delete on ai_market_suggestions" ON ai_market_suggestions FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow delete on bets" ON bets;
CREATE POLICY "Allow delete on bets" ON bets FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow delete on ai_insights" ON ai_insights;
CREATE POLICY "Allow delete on ai_insights" ON ai_insights FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow delete on celebrities" ON celebrities;
CREATE POLICY "Allow delete on celebrities" ON celebrities FOR DELETE USING (true);
