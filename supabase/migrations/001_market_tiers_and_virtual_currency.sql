-- StarTrade Migration: Market Tiers & Virtual Currency System
-- This transforms the app from many markets to exactly 3 curated markets at a time
-- Plus adds virtual currency for free-to-play users

-- =====================================================
-- 1. ADD MARKET TIER SYSTEM
-- Only 3 active markets: WEEKLY, MIDTERM, YEARLY
-- =====================================================

-- Add tier column to markets
ALTER TABLE markets 
ADD COLUMN IF NOT EXISTS tier TEXT CHECK (tier IN ('WEEKLY', 'MIDTERM', 'YEARLY'));

-- Add rich details JSON for storing scraped info about the topic
ALTER TABLE markets
ADD COLUMN IF NOT EXISTS details_json JSONB DEFAULT '{
    "summary": null,
    "key_dates": [],
    "sources": [],
    "related_links": [],
    "key_players": [],
    "latest_updates": [],
    "resolution_criteria": null,
    "early_resolution_triggers": []
}'::jsonb;

-- Add last_scanned timestamp for resolution scanning
ALTER TABLE markets
ADD COLUMN IF NOT EXISTS last_scanned_at TIMESTAMPTZ;

-- Add early_resolved flag
ALTER TABLE markets
ADD COLUMN IF NOT EXISTS early_resolved BOOLEAN DEFAULT false;

-- =====================================================
-- 2. ADD VIRTUAL CURRENCY SYSTEM
-- Users can play with fake money for free
-- =====================================================

-- Add virtual currency fields to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS virtual_balance BIGINT NOT NULL DEFAULT 100000,  -- Start with 1000.00 virtual dollars
ADD COLUMN IF NOT EXISTS virtual_lifetime_winnings BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS virtual_lifetime_losses BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS virtual_total_bets INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS virtual_winning_bets INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS virtual_prediction_accuracy DECIMAL(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS preferred_currency TEXT NOT NULL DEFAULT 'VIRTUAL' CHECK (preferred_currency IN ('REAL', 'VIRTUAL'));

-- Add is_virtual flag to bets table
ALTER TABLE bets
ADD COLUMN IF NOT EXISTS is_virtual BOOLEAN NOT NULL DEFAULT false;

-- =====================================================
-- 3. CREATE VIRTUAL LEADERBOARD TABLE
-- Track weekly/monthly/all-time virtual rankings
-- =====================================================

CREATE TABLE IF NOT EXISTS virtual_leaderboard (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    period_type TEXT NOT NULL CHECK (period_type IN ('WEEKLY', 'MONTHLY', 'ALL_TIME')),
    period_start DATE NOT NULL,
    period_end DATE,
    starting_balance BIGINT NOT NULL,
    ending_balance BIGINT,
    profit_loss BIGINT DEFAULT 0,
    total_bets INTEGER DEFAULT 0,
    winning_bets INTEGER DEFAULT 0,
    accuracy DECIMAL(5, 2) DEFAULT 0,
    rank INTEGER,
    prize_won BIGINT DEFAULT 0,
    prize_claimed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, period_type, period_start)
);

-- =====================================================
-- 4. CREATE PRIZES TABLE
-- Define prize structure for virtual currency winners
-- =====================================================

CREATE TABLE IF NOT EXISTS prizes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_type TEXT NOT NULL CHECK (period_type IN ('WEEKLY', 'MONTHLY', 'SEASON')),
    rank_position INTEGER NOT NULL CHECK (rank_position >= 1 AND rank_position <= 10),
    prize_type TEXT NOT NULL CHECK (prize_type IN ('USDC', 'VIRTUAL_BONUS', 'BADGE', 'MERCH')),
    prize_value BIGINT NOT NULL,  -- In cents for USDC, or virtual units
    prize_description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default prize structure
INSERT INTO prizes (period_type, rank_position, prize_type, prize_value, prize_description) VALUES
-- Weekly prizes (top 3 get virtual bonuses)
('WEEKLY', 1, 'VIRTUAL_BONUS', 50000, 'Weekly Champion - 500 Virtual Dollars Bonus'),
('WEEKLY', 2, 'VIRTUAL_BONUS', 25000, 'Weekly Runner-up - 250 Virtual Dollars Bonus'),
('WEEKLY', 3, 'VIRTUAL_BONUS', 10000, 'Weekly Third Place - 100 Virtual Dollars Bonus'),
-- Monthly prizes (top 3 get real USDC)
('MONTHLY', 1, 'USDC', 5000, 'Monthly Champion - $50 USDC'),
('MONTHLY', 2, 'USDC', 2500, 'Monthly Runner-up - $25 USDC'),
('MONTHLY', 3, 'USDC', 1000, 'Monthly Third Place - $10 USDC'),
-- Season prizes (bigger rewards)
('SEASON', 1, 'USDC', 50000, 'Season Champion - $500 USDC'),
('SEASON', 2, 'USDC', 25000, 'Season Runner-up - $250 USDC'),
('SEASON', 3, 'USDC', 10000, 'Season Third Place - $100 USDC')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 5. CREATE ACTIVE MARKETS VIEW
-- Easy way to get the 3 current active markets
-- =====================================================

CREATE OR REPLACE VIEW active_markets AS
SELECT 
    m.*,
    c.name as celebrity_name,
    c.image_url as celebrity_image,
    c.category as celebrity_category,
    CASE 
        WHEN m.tier = 'WEEKLY' THEN 1
        WHEN m.tier = 'MIDTERM' THEN 2
        WHEN m.tier = 'YEARLY' THEN 3
    END as tier_order
FROM markets m
LEFT JOIN celebrities c ON m.celebrity_id = c.id
WHERE m.status = 'ACTIVE' 
AND m.tier IS NOT NULL
ORDER BY tier_order;

-- =====================================================
-- 6. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_markets_tier ON markets(tier);
CREATE INDEX IF NOT EXISTS idx_markets_tier_status ON markets(tier, status);
CREATE INDEX IF NOT EXISTS idx_bets_is_virtual ON bets(is_virtual);
CREATE INDEX IF NOT EXISTS idx_virtual_leaderboard_period ON virtual_leaderboard(period_type, period_start);
CREATE INDEX IF NOT EXISTS idx_virtual_leaderboard_user ON virtual_leaderboard(user_id);

-- =====================================================
-- 7. RLS POLICIES FOR NEW TABLES
-- =====================================================

ALTER TABLE virtual_leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE prizes ENABLE ROW LEVEL SECURITY;

-- Everyone can view leaderboard
CREATE POLICY "Leaderboard viewable by all"
    ON virtual_leaderboard FOR SELECT USING (true);

-- Users can only see their own detailed stats
CREATE POLICY "Users view own leaderboard entries"
    ON virtual_leaderboard FOR SELECT USING (auth.uid() = user_id);

-- Prizes viewable by all
CREATE POLICY "Prizes viewable by all"
    ON prizes FOR SELECT USING (true);

-- =====================================================
-- 8. FUNCTION: Get or Create Current Period Leaderboard Entry
-- =====================================================

CREATE OR REPLACE FUNCTION get_or_create_leaderboard_entry(
    p_user_id UUID,
    p_period_type TEXT
) RETURNS UUID AS $$
DECLARE
    v_entry_id UUID;
    v_period_start DATE;
    v_starting_balance BIGINT;
BEGIN
    -- Calculate period start
    IF p_period_type = 'WEEKLY' THEN
        v_period_start := date_trunc('week', CURRENT_DATE)::DATE;
    ELSIF p_period_type = 'MONTHLY' THEN
        v_period_start := date_trunc('month', CURRENT_DATE)::DATE;
    ELSE
        v_period_start := date_trunc('year', CURRENT_DATE)::DATE;
    END IF;
    
    -- Get user's current virtual balance
    SELECT virtual_balance INTO v_starting_balance FROM user_profiles WHERE id = p_user_id;
    
    -- Try to get existing entry
    SELECT id INTO v_entry_id 
    FROM virtual_leaderboard 
    WHERE user_id = p_user_id 
    AND period_type = p_period_type 
    AND period_start = v_period_start;
    
    -- Create if doesn't exist
    IF v_entry_id IS NULL THEN
        INSERT INTO virtual_leaderboard (user_id, period_type, period_start, starting_balance)
        VALUES (p_user_id, p_period_type, v_period_start, v_starting_balance)
        RETURNING id INTO v_entry_id;
    END IF;
    
    RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
