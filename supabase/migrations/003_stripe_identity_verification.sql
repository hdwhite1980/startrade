-- Migration: Add Stripe Identity verification for age-gated USDC betting
-- Users must be 21+ verified to bet with real USDC

-- Add identity verification columns to user_profiles
DO $$ 
BEGIN
    -- Stripe Identity verification status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'identity_status') THEN
        ALTER TABLE user_profiles ADD COLUMN identity_status TEXT NOT NULL DEFAULT 'UNVERIFIED' 
            CHECK (identity_status IN ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED', 'REQUIRES_INPUT'));
    END IF;
    
    -- Stripe verification session ID
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'stripe_verification_session_id') THEN
        ALTER TABLE user_profiles ADD COLUMN stripe_verification_session_id TEXT;
    END IF;
    
    -- Date of birth from verification
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'date_of_birth') THEN
        ALTER TABLE user_profiles ADD COLUMN date_of_birth DATE;
    END IF;
    
    -- Is user 21+
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'is_21_plus') THEN
        ALTER TABLE user_profiles ADD COLUMN is_21_plus BOOLEAN NOT NULL DEFAULT false;
    END IF;
    
    -- Verified at timestamp
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'identity_verified_at') THEN
        ALTER TABLE user_profiles ADD COLUMN identity_verified_at TIMESTAMPTZ;
    END IF;
    
    -- Legal name from verification
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'legal_first_name') THEN
        ALTER TABLE user_profiles ADD COLUMN legal_first_name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'legal_last_name') THEN
        ALTER TABLE user_profiles ADD COLUMN legal_last_name TEXT;
    END IF;
    
    -- Country from ID document
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'id_country') THEN
        ALTER TABLE user_profiles ADD COLUMN id_country TEXT;
    END IF;
END $$;

-- Create index for identity status queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_identity_status ON user_profiles(identity_status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_21_plus ON user_profiles(is_21_plus);

-- Update place_bet to enforce 21+ for real USDC bets
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
    -- Get user record
    SELECT * INTO user_record FROM user_profiles WHERE id = user_id_param;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    -- ENFORCE AGE VERIFICATION FOR REAL USDC
    IF NOT user_record.is_21_plus THEN
        RAISE EXCEPTION 'Age verification required. You must be 21+ to bet with real USDC. Use virtual currency instead.';
    END IF;
    
    IF user_record.identity_status != 'VERIFIED' THEN
        RAISE EXCEPTION 'Identity verification required to bet with real USDC.';
    END IF;
    
    -- Check self-exclusion
    IF user_record.self_excluded_until IS NOT NULL AND user_record.self_excluded_until > NOW() THEN
        RAISE EXCEPTION 'Account is self-excluded until %', user_record.self_excluded_until;
    END IF;
    
    -- Check balance
    IF user_record.usdc_balance < amount_param THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;
    
    -- Check betting limit
    IF amount_param > user_record.betting_limit THEN
        RAISE EXCEPTION 'Bet exceeds maximum limit of $%', user_record.betting_limit / 100;
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
    
    -- Deduct from balance and escrow
    UPDATE user_profiles SET
        usdc_balance = usdc_balance - amount_param,
        escrowed_balance = escrowed_balance + amount_param
    WHERE id = user_id_param;
    
    -- Create bet
    INSERT INTO bets (user_id, market_id, side, amount, odds_at_placement, potential_payout, is_virtual)
    VALUES (user_id_param, market_id_param, side_param, amount_param, current_odds, potential_payout, false)
    RETURNING id INTO new_bet_id;
    
    -- Record transaction
    INSERT INTO transactions (user_id, type, amount, reference_type, reference_id, status)
    VALUES (user_id_param, 'BET_PLACED', amount_param, 'bet', new_bet_id, 'CONFIRMED');
    
    RETURN new_bet_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update identity verification status (called by webhook)
CREATE OR REPLACE FUNCTION update_identity_verification(
    user_id_param UUID,
    verification_status TEXT,
    dob DATE DEFAULT NULL,
    first_name TEXT DEFAULT NULL,
    last_name TEXT DEFAULT NULL,
    country TEXT DEFAULT NULL,
    session_id TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    user_age INTEGER;
BEGIN
    -- Calculate age if DOB provided
    IF dob IS NOT NULL THEN
        user_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, dob));
    END IF;
    
    UPDATE user_profiles SET
        identity_status = verification_status,
        stripe_verification_session_id = COALESCE(session_id, stripe_verification_session_id),
        date_of_birth = COALESCE(dob, date_of_birth),
        legal_first_name = COALESCE(first_name, legal_first_name),
        legal_last_name = COALESCE(last_name, legal_last_name),
        id_country = COALESCE(country, id_country),
        is_21_plus = CASE 
            WHEN dob IS NOT NULL AND user_age >= 21 THEN true 
            ELSE false 
        END,
        identity_verified_at = CASE 
            WHEN verification_status = 'VERIFIED' THEN NOW() 
            ELSE identity_verified_at 
        END,
        updated_at = NOW()
    WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- RLS policy for identity fields (users can only see their own)
DROP POLICY IF EXISTS "Users can view own identity info" ON user_profiles;
CREATE POLICY "Users can view own identity info"
    ON user_profiles FOR SELECT USING (auth.uid() = id);
