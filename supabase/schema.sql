-- StarTrade Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Markets table
CREATE TABLE IF NOT EXISTS markets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'General',
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'OPEN', 'CLOSED', 'RESOLVED')),
    current_odds JSONB NOT NULL DEFAULT '{"yes": 0.5, "no": 0.5}'::jsonb,
    total_volume DECIMAL(12, 2) DEFAULT 0,
    betting_closes_at TIMESTAMPTZ NOT NULL,
    resolves_at TIMESTAMPTZ NOT NULL,
    resolved_value BOOLEAN,
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bets table
CREATE TABLE IF NOT EXISTS bets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    position TEXT NOT NULL CHECK (position IN ('YES', 'NO')),
    amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 1 AND amount <= 25),
    odds_at_placement DECIMAL(5, 4) NOT NULL,
    potential_payout DECIMAL(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'WON', 'LOST', 'CANCELLED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    settled_at TIMESTAMPTZ
);

-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    total_winnings DECIMAL(12, 2) DEFAULT 0,
    win_rate DECIMAL(5, 2) DEFAULT 0,
    total_bets INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI bet suggestions table
CREATE TABLE IF NOT EXISTS ai_bet_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    suggested_odds JSONB NOT NULL DEFAULT '{"yes": 0.5, "no": 0.5}'::jsonb,
    source_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_category ON markets(category);
CREATE INDEX IF NOT EXISTS idx_markets_betting_closes ON markets(betting_closes_at);
CREATE INDEX IF NOT EXISTS idx_bets_user_id ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_market_id ON bets(market_id);
CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(status);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER markets_updated_at
    BEFORE UPDATE ON markets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Row Level Security (RLS)

-- Enable RLS
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_bet_suggestions ENABLE ROW LEVEL SECURITY;

-- Markets policies (public read, admin write)
CREATE POLICY "Markets are viewable by everyone"
    ON markets FOR SELECT
    USING (true);

CREATE POLICY "Markets can be inserted by authenticated users"
    ON markets FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Bets policies
CREATE POLICY "Users can view their own bets"
    ON bets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bets"
    ON bets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- User profiles policies
CREATE POLICY "Profiles are viewable by everyone"
    ON user_profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update their own profile"
    ON user_profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON user_profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- AI suggestions (admin only, viewable by all)
CREATE POLICY "AI suggestions are viewable by everyone"
    ON ai_bet_suggestions FOR SELECT
    USING (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE markets;
ALTER PUBLICATION supabase_realtime ADD TABLE bets;

-- Function to update odds after bet
CREATE OR REPLACE FUNCTION update_market_odds()
RETURNS TRIGGER AS $$
DECLARE
    yes_total DECIMAL;
    no_total DECIMAL;
    total DECIMAL;
BEGIN
    SELECT 
        COALESCE(SUM(CASE WHEN position = 'YES' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN position = 'NO' THEN amount ELSE 0 END), 0)
    INTO yes_total, no_total
    FROM bets
    WHERE market_id = NEW.market_id AND status = 'PENDING';
    
    total := yes_total + no_total;
    
    IF total > 0 THEN
        UPDATE markets
        SET 
            current_odds = jsonb_build_object(
                'yes', ROUND((yes_total / total)::numeric, 4),
                'no', ROUND((no_total / total)::numeric, 4)
            ),
            total_volume = total
        WHERE id = NEW.market_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_odds_after_bet
    AFTER INSERT ON bets
    FOR EACH ROW
    EXECUTE FUNCTION update_market_odds();

-- Function to settle bets when market resolves
CREATE OR REPLACE FUNCTION settle_market_bets()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'RESOLVED' AND OLD.status != 'RESOLVED' AND NEW.resolved_value IS NOT NULL THEN
        -- Update winning bets
        UPDATE bets
        SET 
            status = 'WON',
            settled_at = NOW()
        WHERE 
            market_id = NEW.id 
            AND status = 'PENDING'
            AND (
                (position = 'YES' AND NEW.resolved_value = true) OR
                (position = 'NO' AND NEW.resolved_value = false)
            );
        
        -- Update losing bets
        UPDATE bets
        SET 
            status = 'LOST',
            settled_at = NOW()
        WHERE 
            market_id = NEW.id 
            AND status = 'PENDING';
        
        -- Update user stats
        UPDATE user_profiles up
        SET 
            total_winnings = up.total_winnings + COALESCE(
                (SELECT SUM(potential_payout) FROM bets WHERE user_id = up.id AND market_id = NEW.id AND status = 'WON'),
                0
            ),
            total_bets = up.total_bets + (SELECT COUNT(*) FROM bets WHERE user_id = up.id AND market_id = NEW.id),
            win_rate = (
                SELECT ROUND(
                    (COUNT(*) FILTER (WHERE status = 'WON')::numeric / NULLIF(COUNT(*) FILTER (WHERE status IN ('WON', 'LOST')), 0)) * 100,
                    2
                )
                FROM bets
                WHERE user_id = up.id
            )
        WHERE up.id IN (SELECT DISTINCT user_id FROM bets WHERE market_id = NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER settle_bets_on_resolve
    AFTER UPDATE ON markets
    FOR EACH ROW
    EXECUTE FUNCTION settle_market_bets();

-- Sample data for testing
INSERT INTO markets (title, description, category, status, current_odds, betting_closes_at, resolves_at) VALUES
    ('Will Bitcoin hit $100k by end of 2025?', 'Bitcoin must reach $100,000 USD on any major exchange.', 'Crypto', 'OPEN', '{"yes": 0.65, "no": 0.35}', '2025-12-30 23:59:59+00', '2025-12-31 23:59:59+00'),
    ('Will Taylor Swift announce new album in Q1 2025?', 'Official announcement from Taylor Swift or her team.', 'Entertainment', 'OPEN', '{"yes": 0.40, "no": 0.60}', '2025-03-31 23:59:59+00', '2025-04-01 23:59:59+00'),
    ('Will Lakers make NBA playoffs 2025?', 'LA Lakers must qualify for NBA playoffs.', 'Sports', 'OPEN', '{"yes": 0.72, "no": 0.28}', '2025-04-15 23:59:59+00', '2025-04-20 23:59:59+00'),
    ('Will GPT-5 be released before July 2025?', 'OpenAI must officially release GPT-5 to the public.', 'Tech', 'OPEN', '{"yes": 0.55, "no": 0.45}', '2025-06-30 23:59:59+00', '2025-07-01 23:59:59+00'),
    ('Will there be a government shutdown in 2025?', 'US federal government must have a shutdown lasting at least 1 day.', 'Politics', 'OPEN', '{"yes": 0.48, "no": 0.52}', '2025-12-30 23:59:59+00', '2025-12-31 23:59:59+00');
