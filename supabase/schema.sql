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
    usdc_balance BIGINT NOT NULL DEFAULT 0, -- Available balance in cents ($1 = 100)
    escrowed_balance BIGINT NOT NULL DEFAULT 0, -- Locked in active bets
    lifetime_deposited BIGINT NOT NULL DEFAULT 0,
    lifetime_withdrawn BIGINT NOT NULL DEFAULT 0,
    lifetime_winnings BIGINT NOT NULL DEFAULT 0,
    lifetime_losses BIGINT NOT NULL DEFAULT 0,
    -- Limits (in cents)
    deposit_limit BIGINT NOT NULL DEFAULT 10000, -- $100 default
    betting_limit BIGINT NOT NULL DEFAULT 2500, -- $25 max per bet
    -- KYC Status
    kyc_status TEXT NOT NULL DEFAULT 'NONE' CHECK (kyc_status IN ('NONE', 'PENDING', 'VERIFIED', 'REJECTED')),
    kyc_verified_at TIMESTAMPTZ,
    kyc_provider TEXT, -- 'persona', 'jumio', etc.
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
-- TRANSACTIONS TABLE
-- All USDC deposits/withdrawals
-- =====================================================
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('DEPOSIT', 'WITHDRAWAL', 'BET_PLACED', 'BET_WON', 'BET_LOST', 'BET_CANCELLED', 'CHALLENGE_STAKE', 'CHALLENGE_WON', 'CHALLENGE_LOST', 'REFUND')),
    amount BIGINT NOT NULL, -- In cents
    -- Blockchain data
    tx_hash TEXT,
    block_number BIGINT,
    from_address TEXT,
    to_address TEXT,
    -- Status
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED')),
    confirmations INTEGER DEFAULT 0,
    -- Reference
    reference_type TEXT, -- 'bet', 'challenge', 'market'
    reference_id UUID,
    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);

-- =====================================================
-- CELEBRITIES TABLE
-- Entertainment figures with metrics
-- =====================================================
CREATE TABLE IF NOT EXISTS celebrities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    image_url TEXT,
    category TEXT NOT NULL DEFAULT 'Music' CHECK (category IN ('Music', 'Film', 'Sports', 'Social Media', 'TV', 'Gaming')),
    bio TEXT,
    -- Entertainment metrics from APIs
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
    total_volume BIGINT DEFAULT 0, -- In cents
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- MARKETS TABLE
-- Prediction markets (AI-generated or manual)
-- =====================================================
CREATE TABLE IF NOT EXISTS markets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    celebrity_id UUID REFERENCES celebrities(id) ON DELETE SET NULL,
    -- Market details
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'MUSIC' CHECK (category IN ('MUSIC', 'FILM', 'SPORTS', 'SOCIAL', 'AWARDS', 'CHARTS', 'STREAMING', 'OTHER')),
    -- Status
    status TEXT NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING', 'ACTIVE', 'CLOSED', 'RESOLVED', 'CANCELLED')),
    -- Odds (stored as basis points, 5000 = 50%)
    yes_odds INTEGER NOT NULL DEFAULT 5000 CHECK (yes_odds >= 100 AND yes_odds <= 9900),
    no_odds INTEGER NOT NULL DEFAULT 5000 CHECK (no_odds >= 100 AND no_odds <= 9900),
    initial_yes_odds INTEGER NOT NULL DEFAULT 5000,
    initial_no_odds INTEGER NOT NULL DEFAULT 5000,
    -- Pool amounts (in cents)
    yes_pool BIGINT NOT NULL DEFAULT 0,
    no_pool BIGINT NOT NULL DEFAULT 0,
    total_volume BIGINT NOT NULL DEFAULT 0,
    total_bets INTEGER NOT NULL DEFAULT 0,
    -- Liquidity requirements
    min_pool_size BIGINT NOT NULL DEFAULT 10000, -- $100 minimum on each side
    -- Timing
    opens_at TIMESTAMPTZ DEFAULT NOW(),
    closes_at TIMESTAMPTZ NOT NULL,
    resolves_at TIMESTAMPTZ NOT NULL,
    -- Resolution
    resolved_outcome BOOLEAN, -- true = YES wins, false = NO wins, null = unresolved
    resolution_source TEXT,
    resolution_notes TEXT,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    -- AI Generation
    ai_generated BOOLEAN DEFAULT false,
    ai_confidence INTEGER CHECK (ai_confidence >= 0 AND ai_confidence <= 100),
    ai_reasoning TEXT,
    -- Source
    source_headline TEXT,
    source_url TEXT,
    -- Metadata
    featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- BETS TABLE
-- User bets on markets (Parimutuel system)
-- =====================================================
CREATE TABLE IF NOT EXISTS bets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    -- Bet details
    side TEXT NOT NULL CHECK (side IN ('YES', 'NO')),
    amount BIGINT NOT NULL CHECK (amount >= 100 AND amount <= 2500), -- $1 min, $25 max in cents
    odds_at_placement INTEGER NOT NULL, -- Odds when bet was placed (basis points)
    -- Potential payout (calculated at placement, may change with parimutuel)
    potential_payout BIGINT NOT NULL,
    actual_payout BIGINT, -- Set when resolved
    -- Status
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'WON', 'LOST', 'CANCELLED', 'REFUNDED')),
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- =====================================================
-- CHALLENGES TABLE (Beef Mode - H2H)
-- Direct user-to-user challenges
-- =====================================================
CREATE TABLE IF NOT EXISTS challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    -- Challenger (initiator)
    challenger_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    challenger_side TEXT NOT NULL CHECK (challenger_side IN ('YES', 'NO')),
    challenger_amount BIGINT NOT NULL CHECK (challenger_amount >= 100), -- Min $1
    -- Opponent
    opponent_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    opponent_accepted_at TIMESTAMPTZ,
    -- Stakes
    total_pot BIGINT NOT NULL, -- Both sides combined
    platform_fee BIGINT NOT NULL DEFAULT 0, -- 5% fee
    winner_payout BIGINT NOT NULL, -- Total pot minus fee
    -- Status
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'MATCHED', 'RESOLVED', 'CANCELLED', 'EXPIRED')),
    winner_id UUID REFERENCES user_profiles(id),
    -- Timing
    expires_at TIMESTAMPTZ NOT NULL, -- Challenge expires if not matched
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- =====================================================
-- AI MARKET SUGGESTIONS TABLE
-- AI-generated market suggestions for review
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_market_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Source
    source_headline TEXT NOT NULL,
    source_url TEXT,
    source_published_at TIMESTAMPTZ,
    source_outlet TEXT,
    -- Suggested market
    suggested_title TEXT NOT NULL,
    suggested_description TEXT,
    suggested_category TEXT NOT NULL,
    suggested_celebrity_id UUID REFERENCES celebrities(id),
    suggested_yes_odds INTEGER NOT NULL DEFAULT 5000,
    suggested_no_odds INTEGER NOT NULL DEFAULT 5000,
    suggested_closes_at TIMESTAMPTZ,
    suggested_resolves_at TIMESTAMPTZ,
    -- AI Analysis
    ai_confidence INTEGER NOT NULL CHECK (ai_confidence >= 0 AND ai_confidence <= 100),
    ai_reasoning TEXT NOT NULL,
    ai_viral_score INTEGER CHECK (ai_viral_score >= 0 AND ai_viral_score <= 10),
    -- Resolution criteria
    resolution_criteria JSONB, -- How to verify outcome
    -- Review
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'AUTO_PUBLISHED')),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    -- If approved, link to created market
    market_id UUID REFERENCES markets(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- AI INSIGHTS TABLE
-- Real-time AI analysis and alerts
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    market_id UUID REFERENCES markets(id) ON DELETE CASCADE,
    celebrity_id UUID REFERENCES celebrities(id) ON DELETE CASCADE,
    -- Insight
    type TEXT NOT NULL CHECK (type IN ('ODDS_CHANGE', 'TREND_ALERT', 'BREAKING_NEWS', 'CONFIDENCE_UPDATE', 'MARKET_ANALYSIS')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    -- Data
    old_value JSONB, -- Previous state
    new_value JSONB, -- New state
    change_magnitude INTEGER, -- Percentage change if applicable
    -- Importance
    priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    -- Display
    emoji TEXT, -- For notifications
    is_read BOOLEAN DEFAULT false,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ -- When insight is no longer relevant
);

-- =====================================================
-- NEWS FEED TABLE
-- Ingested entertainment news for AI processing
-- =====================================================
CREATE TABLE IF NOT EXISTS news_feed (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Source
    headline TEXT NOT NULL,
    summary TEXT,
    url TEXT UNIQUE NOT NULL,
    source_outlet TEXT,
    published_at TIMESTAMPTZ,
    -- Classification
    category TEXT,
    celebrities TEXT[], -- Names mentioned
    celebrity_ids UUID[], -- Matched celebrity IDs
    -- AI Processing
    processed BOOLEAN DEFAULT false,
    processable BOOLEAN, -- Can this generate a market?
    ai_analysis JSONB, -- Full AI response
    -- Market generation
    market_generated BOOLEAN DEFAULT false,
    suggestion_id UUID REFERENCES ai_market_suggestions(id),
    -- Timestamps
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

-- Updated at trigger
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
    -- Update pool
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
    
    -- Recalculate odds
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
    -- Get market
    SELECT * INTO market_record FROM markets WHERE id = market_id_param AND status = 'CLOSED';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Market not found or not in CLOSED status';
    END IF;
    
    -- Calculate platform fee (4%)
    platform_fee := (market_record.total_volume * 4) / 100;
    payout_pool := market_record.total_volume - platform_fee;
    
    -- Calculate payout per cent bet on winning side
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
    
    -- Update winning bets
    FOR bet_record IN 
        SELECT * FROM bets 
        WHERE market_id = market_id_param 
        AND status = 'ACTIVE'
        AND side = CASE WHEN outcome THEN 'YES' ELSE 'NO' END
    LOOP
        user_payout := (bet_record.amount * payout_per_cent)::BIGINT;
        
        -- Update bet
        UPDATE bets SET 
            status = 'WON',
            actual_payout = user_payout,
            resolved_at = NOW()
        WHERE id = bet_record.id;
        
        -- Credit user
        UPDATE user_profiles SET
            usdc_balance = usdc_balance + user_payout,
            escrowed_balance = escrowed_balance - bet_record.amount,
            lifetime_winnings = lifetime_winnings + (user_payout - bet_record.amount),
            winning_bets = winning_bets + 1
        WHERE id = bet_record.user_id;
        
        -- Record transaction
        INSERT INTO transactions (user_id, type, amount, reference_type, reference_id, status)
        VALUES (bet_record.user_id, 'BET_WON', user_payout, 'bet', bet_record.id, 'CONFIRMED');
    END LOOP;
    
    -- Update losing bets
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
        
        -- Update user stats (escrow already deducted)
        UPDATE user_profiles SET
            escrowed_balance = escrowed_balance - bet_record.amount,
            lifetime_losses = lifetime_losses + bet_record.amount
        WHERE id = bet_record.user_id;
        
        -- Record transaction
        INSERT INTO transactions (user_id, type, amount, reference_type, reference_id, status)
        VALUES (bet_record.user_id, 'BET_LOST', bet_record.amount, 'bet', bet_record.id, 'CONFIRMED');
    END LOOP;
    
    -- Update market
    UPDATE markets SET
        status = 'RESOLVED',
        resolved_outcome = outcome,
        resolution_source = resolution_source_param,
        resolution_notes = notes,
        resolved_by = resolver_id,
        resolved_at = NOW()
    WHERE id = market_id_param;
    
    -- Update user accuracy stats
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
    -- Validate user
    SELECT * INTO user_record FROM user_profiles WHERE id = user_id_param;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    -- Check self-exclusion
    IF user_record.self_excluded_until IS NOT NULL AND user_record.self_excluded_until > NOW() THEN
        RAISE EXCEPTION 'Account is self-excluded until %', user_record.self_excluded_until;
    END IF;
    
    -- Check balance
    IF user_record.usdc_balance < amount_param THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;
    
    -- Check bet limits
    IF amount_param > user_record.betting_limit THEN
        RAISE EXCEPTION 'Bet exceeds maximum limit of $%', user_record.betting_limit / 100;
    END IF;
    
    -- Validate market
    SELECT * INTO market_record FROM markets WHERE id = market_id_param AND status = 'ACTIVE';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Market not available for betting';
    END IF;
    
    IF market_record.closes_at < NOW() THEN
        RAISE EXCEPTION 'Market is closed for betting';
    END IF;
    
    -- Get current odds
    IF side_param = 'YES' THEN
        current_odds := market_record.yes_odds;
    ELSE
        current_odds := market_record.no_odds;
    END IF;
    
    -- Calculate potential payout (parimutuel - this is estimated)
    potential_payout := (amount_param * 10000) / current_odds;
    
    -- Deduct from user balance, add to escrow
    UPDATE user_profiles SET
        usdc_balance = usdc_balance - amount_param,
        escrowed_balance = escrowed_balance + amount_param
    WHERE id = user_id_param;
    
    -- Create bet
    INSERT INTO bets (user_id, market_id, side, amount, odds_at_placement, potential_payout)
    VALUES (user_id_param, market_id_param, side_param, amount_param, current_odds, potential_payout)
    RETURNING id INTO new_bet_id;
    
    -- Record transaction
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

-- User profiles: Users see own, public sees limited
CREATE POLICY "Users can view own full profile"
    ON user_profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON user_profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON user_profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Transactions: Users see own only
CREATE POLICY "Users can view own transactions"
    ON transactions FOR SELECT
    USING (auth.uid() = user_id);

-- Celebrities: Public read
CREATE POLICY "Celebrities are public"
    ON celebrities FOR SELECT USING (true);

-- Markets: Public read
CREATE POLICY "Markets are public"
    ON markets FOR SELECT USING (true);

-- Bets: Users see own
CREATE POLICY "Users can view own bets"
    ON bets FOR SELECT
    USING (auth.uid() = user_id);

-- Challenges: Users see own or public open ones
CREATE POLICY "Users can view challenges"
    ON challenges FOR SELECT
    USING (auth.uid() = challenger_id OR auth.uid() = opponent_id OR status = 'OPEN');

-- AI insights: Public
CREATE POLICY "AI insights are public"
    ON ai_insights FOR SELECT USING (true);

-- AI suggestions: Admin only (handled by service role)
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

-- =====================================================
-- SAMPLE DATA
-- =====================================================

-- Celebrities
INSERT INTO celebrities (name, slug, image_url, category, bio, metrics) VALUES
    ('Taylor Swift', 'taylor-swift', 'https://placeholder.com/taylor.jpg', 'Music', 'Grammy-winning artist and global pop icon', '{"spotify_streams": 85000000000, "instagram_followers": 283000000, "twitter_followers": 95000000, "engagement_rate": 4.2, "trend_score": 92, "sentiment_score": 78}'),
    ('Drake', 'drake', 'https://placeholder.com/drake.jpg', 'Music', 'Hip-hop artist and cultural trendsetter', '{"spotify_streams": 75000000000, "instagram_followers": 146000000, "twitter_followers": 39000000, "engagement_rate": 3.8, "trend_score": 85, "sentiment_score": 65}'),
    ('MrBeast', 'mrbeast', 'https://placeholder.com/mrbeast.jpg', 'Social Media', 'YouTube phenomenon and philanthropist', '{"youtube_views": 45000000000, "youtube_subscribers": 340000000, "instagram_followers": 58000000, "twitter_followers": 31000000, "engagement_rate": 8.5, "trend_score": 94, "sentiment_score": 88}'),
    ('Zendaya', 'zendaya', 'https://placeholder.com/zendaya.jpg', 'Film', 'Emmy-winning actress and fashion icon', '{"instagram_followers": 182000000, "twitter_followers": 21000000, "engagement_rate": 5.2, "trend_score": 82, "sentiment_score": 85}'),
    ('LeBron James', 'lebron-james', 'https://placeholder.com/lebron.jpg', 'Sports', 'NBA legend and entrepreneur', '{"instagram_followers": 159000000, "twitter_followers": 53000000, "engagement_rate": 2.8, "trend_score": 78, "sentiment_score": 72}'),
    ('Pokimane', 'pokimane', 'https://placeholder.com/pokimane.jpg', 'Gaming', 'Twitch streamer and content creator', '{"youtube_views": 1500000000, "instagram_followers": 9400000, "twitter_followers": 4200000, "twitch_followers": 9500000, "engagement_rate": 6.5, "trend_score": 75, "sentiment_score": 70}');

-- Sample Markets
INSERT INTO markets (celebrity_id, title, description, category, status, yes_odds, no_odds, initial_yes_odds, initial_no_odds, closes_at, resolves_at, ai_generated, ai_confidence, ai_reasoning, min_pool_size) VALUES
    ((SELECT id FROM celebrities WHERE slug = 'taylor-swift'), 'Will Taylor Swift''s next single hit 1B Spotify streams in first week?', 'Based on official Spotify streaming data for her upcoming release. Resolution will be based on Spotify''s official announcement.', 'STREAMING', 'ACTIVE', 7200, 2800, 7000, 3000, '2025-12-30 23:59:59+00', '2025-12-31 23:59:59+00', true, 85, 'Based on her last 5 single releases which averaged 800M first-week streams, with Eras Tour momentum, 1B is achievable.', 10000),
    ((SELECT id FROM celebrities WHERE slug = 'mrbeast'), 'Will MrBeast reach 400M YouTube subscribers by July 2025?', 'Official YouTube subscriber count from socialblade.com or YouTube directly.', 'SOCIAL', 'ACTIVE', 6500, 3500, 6500, 3500, '2025-06-30 23:59:59+00', '2025-07-01 23:59:59+00', true, 78, 'Current growth rate of ~3M/month would put him at ~380M. Needs acceleration or viral moment.', 10000),
    ((SELECT id FROM celebrities WHERE slug = 'drake'), 'Will Drake''s next album debut at #1 on Billboard 200?', 'Official Billboard Hot 200 chart position for first tracking week.', 'CHARTS', 'ACTIVE', 8500, 1500, 8500, 1500, '2025-03-31 23:59:59+00', '2025-04-07 23:59:59+00', true, 92, 'Drake has debuted at #1 with his last 7 albums. Strong pre-release buzz.', 10000),
    ((SELECT id FROM celebrities WHERE slug = 'zendaya'), 'Will Zendaya win a Golden Globe in 2025?', 'Official Golden Globe Awards ceremony results.', 'AWARDS', 'ACTIVE', 4500, 5500, 4500, 5500, '2025-01-05 23:59:59+00', '2025-01-06 23:59:59+00', true, 65, 'Strong performance in Challengers, but competitive field.', 10000);

-- Sample AI Insights
INSERT INTO ai_insights (market_id, celebrity_id, type, title, description, priority, emoji) VALUES
    ((SELECT id FROM markets WHERE title LIKE '%Taylor Swift%'), (SELECT id FROM celebrities WHERE slug = 'taylor-swift'), 'TREND_ALERT', 'Taylor Swift Engagement Surge', 'Social media engagement up 15% this week following tour announcement. Historically correlates with streaming spikes.', 'HIGH', '📈'),
    ((SELECT id FROM markets WHERE title LIKE '%MrBeast%'), (SELECT id FROM celebrities WHERE slug = 'mrbeast'), 'CONFIDENCE_UPDATE', 'MrBeast Growth Analysis', 'Subscriber growth accelerating - 4.2M gained in last 30 days vs 3.1M monthly average.', 'NORMAL', '🚀'),
    (NULL, NULL, 'MARKET_ANALYSIS', 'Awards Season Volatility', 'Golden Globe nominations announced - expect odds movements on award markets.', 'HIGH', '🏆');
