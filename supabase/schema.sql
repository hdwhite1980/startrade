-- StarTrade - Celebrity Prediction Market Database Schema
-- Real USDC Betting on Base (Coinbase L2)
-- Run this in your Supabase SQL Editor

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS / WALLETS TABLE
-- User accounts with wallet addresses and balances
-- =====================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    email TEXT,
    avatar_url TEXT,
    -- Wallet
    wallet_address TEXT UNIQUE,
    -- USDC Balances (stored as cents to avoid floating point issues)
    usdc_balance BIGINT NOT NULL DEFAULT 0,
    escrowed_balance BIGINT NOT NULL DEFAULT 0,
    lifetime_deposited BIGINT NOT NULL DEFAULT 0,
    lifetime_withdrawn BIGINT NOT NULL DEFAULT 0,
    lifetime_winnings BIGINT NOT NULL DEFAULT 0,
    lifetime_losses BIGINT NOT NULL DEFAULT 0,
    -- Limits (in cents)
    deposit_limit BIGINT NOT NULL DEFAULT 10000,
    betting_limit BIGINT NOT NULL DEFAULT 2500,
    -- KYC Status
    kyc_status TEXT NOT NULL DEFAULT 'NONE' CHECK (kyc_status IN ('NONE', 'PENDING', 'VERIFIED', 'REJECTED')),
    kyc_verified_at TIMESTAMPTZ,
    kyc_provider TEXT,
    kyc_reference_id TEXT,
    -- Stats
    total_bets INTEGER DEFAULT 0,
    winning_bets INTEGER DEFAULT 0,
    prediction_accuracy DECIMAL(5, 2) DEFAULT 0,
    rank_title TEXT DEFAULT 'Rookie' CHECK (rank_title IN ('Rookie', 'Rising Star', 'Pro Bettor', 'High Roller', 'Legend')),
    -- Responsible Gaming
    self_excluded_until TIMESTAMPTZ,
    cooling_off_until TIMESTAMPTZ,
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CELEBRITIES TABLE
-- Public figures with social metrics for market creation
-- =====================================================
CREATE TABLE IF NOT EXISTS celebrities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    image_url TEXT,
    category TEXT NOT NULL DEFAULT 'Music' CHECK (category IN ('Music', 'Film', 'Sports', 'Social Media', 'TV', 'Gaming')),
    bio TEXT,
    metrics JSONB NOT NULL DEFAULT '{
        "spotify_streams": 0,
        "youtube_views": 0,
        "youtube_subscribers": 0,
        "instagram_followers": 0,
        "twitter_followers": 0,
        "tiktok_followers": 0,
        "engagement_rate": 0,
        "trend_score": 50,
        "sentiment_score": 0
    }'::jsonb,
    -- Betting stats
    total_markets INTEGER DEFAULT 0,
    total_volume BIGINT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TRANSACTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('DEPOSIT', 'WITHDRAWAL', 'BET_PLACED', 'BET_WON', 'BET_LOST', 'BET_CANCELLED', 'CHALLENGE_STAKE', 'CHALLENGE_WON', 'CHALLENGE_LOST', 'REFUND')),
    amount BIGINT NOT NULL,
    tx_hash TEXT,
    block_number BIGINT,
    from_address TEXT,
    to_address TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED')),
    confirmations INTEGER DEFAULT 0,
    reference_type TEXT,
    reference_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);

-- =====================================================
-- MARKETS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS markets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    celebrity_id UUID REFERENCES celebrities(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'MUSIC' CHECK (category IN ('MUSIC', 'FILM', 'SPORTS', 'SOCIAL', 'AWARDS', 'CHARTS', 'STREAMING', 'OTHER')),
    status TEXT NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING', 'ACTIVE', 'CLOSED', 'RESOLVED', 'CANCELLED')),
    yes_odds INTEGER NOT NULL DEFAULT 5000 CHECK (yes_odds >= 100 AND yes_odds <= 9900),
    no_odds INTEGER NOT NULL DEFAULT 5000 CHECK (no_odds >= 100 AND no_odds <= 9900),
    initial_yes_odds INTEGER NOT NULL DEFAULT 5000,
    initial_no_odds INTEGER NOT NULL DEFAULT 5000,
    yes_pool BIGINT NOT NULL DEFAULT 0,
    no_pool BIGINT NOT NULL DEFAULT 0,
    total_volume BIGINT NOT NULL DEFAULT 0,
    total_bets INTEGER NOT NULL DEFAULT 0,
    min_pool_size BIGINT NOT NULL DEFAULT 10000,
    opens_at TIMESTAMPTZ DEFAULT NOW(),
    closes_at TIMESTAMPTZ NOT NULL,
    resolves_at TIMESTAMPTZ NOT NULL,
    resolved_outcome BOOLEAN,
    resolution_source TEXT,
    resolution_notes TEXT,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    ai_generated BOOLEAN DEFAULT false,
    ai_confidence INTEGER CHECK (ai_confidence >= 0 AND ai_confidence <= 100),
    ai_reasoning TEXT,
    source_headline TEXT,
    source_url TEXT,
    featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- BETS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS bets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    side TEXT NOT NULL CHECK (side IN ('YES', 'NO')),
    amount BIGINT NOT NULL CHECK (amount >= 100 AND amount <= 2500),
    odds_at_placement INTEGER NOT NULL,
    potential_payout BIGINT NOT NULL,
    actual_payout BIGINT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'WON', 'LOST', 'CANCELLED', 'REFUNDED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- =====================================================
-- CHALLENGES TABLE (Beef Mode - H2H)
-- =====================================================
CREATE TABLE IF NOT EXISTS challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    challenger_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    challenger_side TEXT NOT NULL CHECK (challenger_side IN ('YES', 'NO')),
    challenger_amount BIGINT NOT NULL CHECK (challenger_amount >= 100),
    opponent_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    opponent_accepted_at TIMESTAMPTZ,
    total_pot BIGINT NOT NULL,
    platform_fee BIGINT NOT NULL DEFAULT 0,
    winner_payout BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'MATCHED', 'RESOLVED', 'CANCELLED', 'EXPIRED')),
    winner_id UUID REFERENCES user_profiles(id),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- =====================================================
-- AI MARKET SUGGESTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_market_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_headline TEXT NOT NULL,
    source_url TEXT,
    source_published_at TIMESTAMPTZ,
    source_outlet TEXT,
    suggested_title TEXT NOT NULL,
    suggested_description TEXT,
    suggested_category TEXT NOT NULL,
    suggested_celebrity_id UUID REFERENCES celebrities(id),
    suggested_yes_odds INTEGER NOT NULL DEFAULT 5000,
    suggested_no_odds INTEGER NOT NULL DEFAULT 5000,
    suggested_closes_at TIMESTAMPTZ,
    suggested_resolves_at TIMESTAMPTZ,
    ai_confidence INTEGER NOT NULL CHECK (ai_confidence >= 0 AND ai_confidence <= 100),
    ai_reasoning TEXT NOT NULL,
    ai_viral_score INTEGER CHECK (ai_viral_score >= 0 AND ai_viral_score <= 10),
    resolution_criteria JSONB,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'AUTO_PUBLISHED')),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    market_id UUID REFERENCES markets(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- AI INSIGHTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    market_id UUID REFERENCES markets(id) ON DELETE CASCADE,
    celebrity_id UUID REFERENCES celebrities(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('ODDS_CHANGE', 'TREND_ALERT', 'BREAKING_NEWS', 'CONFIDENCE_UPDATE', 'MARKET_ANALYSIS')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    change_magnitude INTEGER,
    priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    emoji TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- =====================================================
-- NEWS FEED TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS news_feed (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    headline TEXT NOT NULL,
    summary TEXT,
    url TEXT UNIQUE NOT NULL,
    source_outlet TEXT,
    published_at TIMESTAMPTZ,
    category TEXT,
    celebrities TEXT[],
    celebrity_ids UUID[],
    processed BOOLEAN DEFAULT false,
    processable BOOLEAN,
    ai_analysis JSONB,
    market_generated BOOLEAN DEFAULT false,
    suggestion_id UUID REFERENCES ai_market_suggestions(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_user_profiles_wallet ON user_profiles(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_profiles_kyc ON user_profiles(kyc_status);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_celebrities_category ON celebrities(category);
CREATE INDEX IF NOT EXISTS idx_celebrities_slug ON celebrities(slug);
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_celebrity ON markets(celebrity_id);
CREATE INDEX IF NOT EXISTS idx_markets_closes_at ON markets(closes_at);
CREATE INDEX IF NOT EXISTS idx_markets_featured ON markets(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_bets_user ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_market ON bets(market_id);
CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(status);
CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON challenges(challenger_id);
CREATE INDEX IF NOT EXISTS idx_challenges_opponent ON challenges(opponent_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_status ON ai_market_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_ai_insights_market ON ai_insights(market_id);
CREATE INDEX IF NOT EXISTS idx_news_feed_processed ON news_feed(processed);

-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER celebrities_updated_at
    BEFORE UPDATE ON celebrities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER markets_updated_at
    BEFORE UPDATE ON markets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Calculate parimutuel odds
CREATE OR REPLACE FUNCTION calculate_odds(market_id_param UUID)
RETURNS TABLE(yes_odds_out INTEGER, no_odds_out INTEGER) AS $$
DECLARE
    yes_total BIGINT;
    no_total BIGINT;
    total BIGINT;
BEGIN
    SELECT yes_pool, no_pool INTO yes_total, no_total
    FROM markets WHERE id = market_id_param;
    
    total := yes_total + no_total;
    
    IF total = 0 THEN
        RETURN QUERY SELECT 5000, 5000;
    ELSE
        RETURN QUERY SELECT 
            GREATEST(100, LEAST(9900, (yes_total * 10000 / total)::INTEGER)),
            GREATEST(100, LEAST(9900, (no_total * 10000 / total)::INTEGER));
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Update market odds after bet
CREATE OR REPLACE FUNCTION update_market_after_bet()
RETURNS TRIGGER AS $$
DECLARE
    new_yes_odds INTEGER;
    new_no_odds INTEGER;
BEGIN
    IF NEW.side = 'YES' THEN
        UPDATE markets SET 
            yes_pool = yes_pool + NEW.amount,
            total_volume = total_volume + NEW.amount,
            total_bets = total_bets + 1
        WHERE id = NEW.market_id;
    ELSE
        UPDATE markets SET 
            no_pool = no_pool + NEW.amount,
            total_volume = total_volume + NEW.amount,
            total_bets = total_bets + 1
        WHERE id = NEW.market_id;
    END IF;
    
    SELECT * INTO new_yes_odds, new_no_odds FROM calculate_odds(NEW.market_id);
    
    UPDATE markets SET 
        yes_odds = new_yes_odds,
        no_odds = new_no_odds
    WHERE id = NEW.market_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_market_after_bet_trigger
    AFTER INSERT ON bets
    FOR EACH ROW EXECUTE FUNCTION update_market_after_bet();

-- Resolve market and pay winners
CREATE OR REPLACE FUNCTION resolve_market(
    market_id_param UUID,
    outcome BOOLEAN,
    resolver_id UUID,
    resolution_source_param TEXT DEFAULT NULL,
    notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    market_record RECORD;
    bet_record RECORD;
    platform_fee BIGINT;
    payout_pool BIGINT;
    payout_per_cent DECIMAL(20, 10);
    user_payout BIGINT;
BEGIN
    SELECT * INTO market_record FROM markets WHERE id = market_id_param AND status = 'CLOSED';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Market not found or not in CLOSED status';
    END IF;
    
    platform_fee := (market_record.total_volume * 4) / 100;
    payout_pool := market_record.total_volume - platform_fee;
    
    IF outcome = true THEN
        IF market_record.yes_pool > 0 THEN
            payout_per_cent := payout_pool::DECIMAL / market_record.yes_pool;
        ELSE
            payout_per_cent := 0;
        END IF;
    ELSE
        IF market_record.no_pool > 0 THEN
            payout_per_cent := payout_pool::DECIMAL / market_record.no_pool;
        ELSE
            payout_per_cent := 0;
        END IF;
    END IF;
    
    FOR bet_record IN 
        SELECT * FROM bets 
        WHERE market_id = market_id_param 
        AND status = 'ACTIVE'
        AND side = CASE WHEN outcome THEN 'YES' ELSE 'NO' END
    LOOP
        user_payout := (bet_record.amount * payout_per_cent)::BIGINT;
        
        UPDATE bets SET 
            status = 'WON',
            actual_payout = user_payout,
            resolved_at = NOW()
        WHERE id = bet_record.id;
        
        UPDATE user_profiles SET
            usdc_balance = usdc_balance + user_payout,
            escrowed_balance = escrowed_balance - bet_record.amount,
            lifetime_winnings = lifetime_winnings + (user_payout - bet_record.amount),
            winning_bets = winning_bets + 1
        WHERE id = bet_record.user_id;
        
        INSERT INTO transactions (user_id, type, amount, reference_type, reference_id, status)
        VALUES (bet_record.user_id, 'BET_WON', user_payout, 'bet', bet_record.id, 'CONFIRMED');
    END LOOP;
    
    FOR bet_record IN 
        SELECT * FROM bets 
        WHERE market_id = market_id_param 
        AND status = 'ACTIVE'
        AND side = CASE WHEN outcome THEN 'NO' ELSE 'YES' END
    LOOP
        UPDATE bets SET 
            status = 'LOST',
            actual_payout = 0,
            resolved_at = NOW()
        WHERE id = bet_record.id;
        
        UPDATE user_profiles SET
            escrowed_balance = escrowed_balance - bet_record.amount,
            lifetime_losses = lifetime_losses + bet_record.amount
        WHERE id = bet_record.user_id;
        
        INSERT INTO transactions (user_id, type, amount, reference_type, reference_id, status)
        VALUES (bet_record.user_id, 'BET_LOST', bet_record.amount, 'bet', bet_record.id, 'CONFIRMED');
    END LOOP;
    
    UPDATE markets SET
        status = 'RESOLVED',
        resolved_outcome = outcome,
        resolution_source = resolution_source_param,
        resolution_notes = notes,
        resolved_by = resolver_id,
        resolved_at = NOW()
    WHERE id = market_id_param;
    
    UPDATE user_profiles up SET
        total_bets = (SELECT COUNT(*) FROM bets WHERE user_id = up.id AND status IN ('WON', 'LOST')),
        prediction_accuracy = (
            SELECT ROUND(
                (COUNT(*) FILTER (WHERE status = 'WON')::DECIMAL / 
                NULLIF(COUNT(*) FILTER (WHERE status IN ('WON', 'LOST')), 0)) * 100,
                2
            )
            FROM bets WHERE user_id = up.id
        ),
        rank_title = CASE 
            WHEN (SELECT COUNT(*) FROM bets WHERE user_id = up.id AND status = 'WON') >= 100 THEN 'Legend'
            WHEN (SELECT COUNT(*) FROM bets WHERE user_id = up.id AND status = 'WON') >= 50 THEN 'High Roller'
            WHEN (SELECT COUNT(*) FROM bets WHERE user_id = up.id AND status = 'WON') >= 20 THEN 'Pro Bettor'
            WHEN (SELECT COUNT(*) FROM bets WHERE user_id = up.id AND status = 'WON') >= 5 THEN 'Rising Star'
            ELSE 'Rookie'
        END
    WHERE up.id IN (SELECT DISTINCT user_id FROM bets WHERE market_id = market_id_param);
END;
$$ LANGUAGE plpgsql;

-- Place bet function
CREATE OR REPLACE FUNCTION place_bet(
    user_id_param UUID,
    market_id_param UUID,
    side_param TEXT,
    amount_param BIGINT
)
RETURNS UUID AS $$
DECLARE
    user_record RECORD;
    market_record RECORD;
    new_bet_id UUID;
    current_odds INTEGER;
    potential_payout BIGINT;
BEGIN
    SELECT * INTO user_record FROM user_profiles WHERE id = user_id_param;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    IF user_record.self_excluded_until IS NOT NULL AND user_record.self_excluded_until > NOW() THEN
        RAISE EXCEPTION 'Account is self-excluded until %', user_record.self_excluded_until;
    END IF;
    
    IF user_record.usdc_balance < amount_param THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;
    
    IF amount_param > user_record.betting_limit THEN
        RAISE EXCEPTION 'Bet exceeds maximum limit of $%', user_record.betting_limit / 100;
    END IF;
    
    SELECT * INTO market_record FROM markets WHERE id = market_id_param AND status = 'ACTIVE';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Market not available for betting';
    END IF;
    
    IF market_record.closes_at < NOW() THEN
        RAISE EXCEPTION 'Market is closed for betting';
    END IF;
    
    IF side_param = 'YES' THEN
        current_odds := market_record.yes_odds;
    ELSE
        current_odds := market_record.no_odds;
    END IF;
    
    potential_payout := (amount_param * 10000) / current_odds;
    
    UPDATE user_profiles SET
        usdc_balance = usdc_balance - amount_param,
        escrowed_balance = escrowed_balance + amount_param
    WHERE id = user_id_param;
    
    INSERT INTO bets (user_id, market_id, side, amount, odds_at_placement, potential_payout)
    VALUES (user_id_param, market_id_param, side_param, amount_param, current_odds, potential_payout)
    RETURNING id INTO new_bet_id;
    
    INSERT INTO transactions (user_id, type, amount, reference_type, reference_id, status)
    VALUES (user_id_param, 'BET_PLACED', amount_param, 'bet', new_bet_id, 'CONFIRMED');
    
    RETURN new_bet_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE celebrities ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_market_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_feed ENABLE ROW LEVEL SECURITY;

-- User profiles
CREATE POLICY "Users can view own full profile"
    ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
    ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
    ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Transactions
CREATE POLICY "Users can view own transactions"
    ON transactions FOR SELECT USING (auth.uid() = user_id);

-- Celebrities: Public read
CREATE POLICY "Celebrities are public"
    ON celebrities FOR SELECT USING (true);

-- Markets: Public read
CREATE POLICY "Markets are public"
    ON markets FOR SELECT USING (true);

-- Bets
CREATE POLICY "Users can view own bets"
    ON bets FOR SELECT USING (auth.uid() = user_id);

-- Challenges
CREATE POLICY "Users can view challenges"
    ON challenges FOR SELECT
    USING (auth.uid() = challenger_id OR auth.uid() = opponent_id OR status = 'OPEN');

-- AI insights: Public
CREATE POLICY "AI insights are public"
    ON ai_insights FOR SELECT USING (true);

-- AI suggestions: Admin only
CREATE POLICY "AI suggestions admin only"
    ON ai_market_suggestions FOR SELECT USING (false);

-- News feed: Admin only
CREATE POLICY "News feed admin only"
    ON news_feed FOR SELECT USING (false);

-- =====================================================
-- REALTIME
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE markets;
ALTER PUBLICATION supabase_realtime ADD TABLE bets;
ALTER PUBLICATION supabase_realtime ADD TABLE ai_insights;
