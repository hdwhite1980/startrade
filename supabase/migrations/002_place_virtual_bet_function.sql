-- Migration: Add place_virtual_bet function for virtual currency betting
-- Also ensure virtual_balance and is_virtual columns exist

-- Add virtual_balance to user_profiles if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'virtual_balance') THEN
        ALTER TABLE user_profiles ADD COLUMN virtual_balance BIGINT NOT NULL DEFAULT 100000;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'virtual_winnings') THEN
        ALTER TABLE user_profiles ADD COLUMN virtual_winnings BIGINT NOT NULL DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'virtual_escrowed') THEN
        ALTER TABLE user_profiles ADD COLUMN virtual_escrowed BIGINT NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Add is_virtual to bets if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'bets' AND column_name = 'is_virtual') THEN
        ALTER TABLE bets ADD COLUMN is_virtual BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- Place virtual bet function
CREATE OR REPLACE FUNCTION place_virtual_bet(
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
    -- Get user record
    SELECT * INTO user_record FROM user_profiles WHERE id = user_id_param;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    -- Check virtual balance
    IF user_record.virtual_balance < amount_param THEN
        RAISE EXCEPTION 'Insufficient virtual balance';
    END IF;
    
    -- Get market record
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
    
    -- Calculate potential payout
    potential_payout := (amount_param * 10000) / current_odds;
    
    -- Deduct from virtual balance and add to virtual escrowed
    UPDATE user_profiles SET
        virtual_balance = virtual_balance - amount_param,
        virtual_escrowed = virtual_escrowed + amount_param
    WHERE id = user_id_param;
    
    -- Create bet with is_virtual = true
    INSERT INTO bets (user_id, market_id, side, amount, odds_at_placement, potential_payout, is_virtual)
    VALUES (user_id_param, market_id_param, side_param, amount_param, current_odds, potential_payout, true)
    RETURNING id INTO new_bet_id;
    
    RETURN new_bet_id;
END;
$$ LANGUAGE plpgsql;

-- Update resolve_market to handle virtual bets separately
CREATE OR REPLACE FUNCTION resolve_virtual_bets(
    market_id_param UUID,
    outcome BOOLEAN
)
RETURNS VOID AS $$
DECLARE
    market_record RECORD;
    bet_record RECORD;
    total_virtual_pool BIGINT;
    winning_virtual_pool BIGINT;
    payout_per_cent DECIMAL(20, 10);
    user_payout BIGINT;
BEGIN
    -- Get market
    SELECT * INTO market_record FROM markets WHERE id = market_id_param;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Market not found';
    END IF;
    
    -- Calculate total virtual pools
    SELECT 
        COALESCE(SUM(amount), 0) INTO total_virtual_pool
    FROM bets 
    WHERE market_id = market_id_param 
    AND is_virtual = true 
    AND status = 'ACTIVE';
    
    -- Calculate winning pool
    SELECT 
        COALESCE(SUM(amount), 0) INTO winning_virtual_pool
    FROM bets 
    WHERE market_id = market_id_param 
    AND is_virtual = true 
    AND status = 'ACTIVE'
    AND side = CASE WHEN outcome THEN 'YES' ELSE 'NO' END;
    
    -- Calculate payout ratio
    IF winning_virtual_pool > 0 THEN
        payout_per_cent := total_virtual_pool::DECIMAL / winning_virtual_pool;
    ELSE
        payout_per_cent := 0;
    END IF;
    
    -- Process winning virtual bets
    FOR bet_record IN 
        SELECT * FROM bets 
        WHERE market_id = market_id_param 
        AND is_virtual = true
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
            virtual_balance = virtual_balance + user_payout,
            virtual_escrowed = virtual_escrowed - bet_record.amount,
            virtual_winnings = virtual_winnings + (user_payout - bet_record.amount)
        WHERE id = bet_record.user_id;
    END LOOP;
    
    -- Process losing virtual bets
    FOR bet_record IN 
        SELECT * FROM bets 
        WHERE market_id = market_id_param 
        AND is_virtual = true
        AND status = 'ACTIVE'
        AND side = CASE WHEN outcome THEN 'NO' ELSE 'YES' END
    LOOP
        UPDATE bets SET 
            status = 'LOST',
            actual_payout = 0,
            resolved_at = NOW()
        WHERE id = bet_record.id;
        
        UPDATE user_profiles SET
            virtual_escrowed = virtual_escrowed - bet_record.amount
        WHERE id = bet_record.user_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create virtual leaderboard view (drop if exists as table)
DROP TABLE IF EXISTS virtual_leaderboard CASCADE;
DROP VIEW IF EXISTS virtual_leaderboard CASCADE;

CREATE OR REPLACE VIEW virtual_leaderboard AS
SELECT 
    up.id,
    up.username,
    up.avatar_url,
    up.virtual_balance + up.virtual_escrowed AS total_virtual_value,
    up.virtual_winnings,
    (SELECT COUNT(*) FROM bets WHERE user_id = up.id AND is_virtual = true AND status = 'WON') AS virtual_wins,
    (SELECT COUNT(*) FROM bets WHERE user_id = up.id AND is_virtual = true AND status IN ('WON', 'LOST')) AS virtual_total_bets,
    CASE 
        WHEN (SELECT COUNT(*) FROM bets WHERE user_id = up.id AND is_virtual = true AND status IN ('WON', 'LOST')) > 0
        THEN ROUND(
            ((SELECT COUNT(*) FROM bets WHERE user_id = up.id AND is_virtual = true AND status = 'WON')::DECIMAL / 
            (SELECT COUNT(*) FROM bets WHERE user_id = up.id AND is_virtual = true AND status IN ('WON', 'LOST'))) * 100,
            2
        )
        ELSE 0
    END AS virtual_win_rate,
    RANK() OVER (ORDER BY up.virtual_balance + up.virtual_escrowed DESC) AS rank
FROM user_profiles up
WHERE up.virtual_balance > 0 OR up.virtual_escrowed > 0;

-- Allow anyone to read the leaderboard
GRANT SELECT ON virtual_leaderboard TO anon, authenticated;
