-- Migration: Add onboarding and user preference columns
-- Stores user interests, terms acceptance, and onboarding completion status

-- Add onboarding columns to user_profiles
DO $$ 
BEGIN
    -- User interests array
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'interests') THEN
        ALTER TABLE user_profiles ADD COLUMN interests TEXT[] DEFAULT '{}';
    END IF;
    
    -- Age confirmed checkbox
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'age_confirmed') THEN
        ALTER TABLE user_profiles ADD COLUMN age_confirmed BOOLEAN NOT NULL DEFAULT false;
    END IF;
    
    -- Terms accepted
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'terms_accepted') THEN
        ALTER TABLE user_profiles ADD COLUMN terms_accepted BOOLEAN NOT NULL DEFAULT false;
    END IF;
    
    -- Terms accepted timestamp
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'terms_accepted_at') THEN
        ALTER TABLE user_profiles ADD COLUMN terms_accepted_at TIMESTAMPTZ;
    END IF;
    
    -- Onboarding completed flag
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'onboarding_completed') THEN
        ALTER TABLE user_profiles ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT false;
    END IF;
    
    -- Preferred currency mode
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'preferred_currency') THEN
        ALTER TABLE user_profiles ADD COLUMN preferred_currency TEXT NOT NULL DEFAULT 'VIRTUAL' 
            CHECK (preferred_currency IN ('VIRTUAL', 'REAL'));
    END IF;
    
    -- Push notifications enabled
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'push_notifications') THEN
        ALTER TABLE user_profiles ADD COLUMN push_notifications BOOLEAN NOT NULL DEFAULT true;
    END IF;
    
    -- Marketing emails opt-in
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'marketing_emails') THEN
        ALTER TABLE user_profiles ADD COLUMN marketing_emails BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- Create index for onboarding status
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding ON user_profiles(onboarding_completed);
CREATE INDEX IF NOT EXISTS idx_user_profiles_interests ON user_profiles USING GIN(interests);

-- Function to auto-create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (id, email, username, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            LOWER(SPLIT_PART(NEW.email, '@', 1)),
            'user_' || SUBSTRING(NEW.id::text, 1, 8)
        ),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
