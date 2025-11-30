-- Migration: Email verification codes for signup
-- Stores 5-character alphanumeric codes sent to users during signup

-- Create email_verification_codes table
CREATE TABLE IF NOT EXISTS email_verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT false,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_email_verification_email ON email_verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_email_verification_code ON email_verification_codes(code);
CREATE INDEX IF NOT EXISTS idx_email_verification_expires ON email_verification_codes(expires_at);

-- RLS policies
ALTER TABLE email_verification_codes ENABLE ROW LEVEL SECURITY;

-- Only allow inserts via service role (edge functions)
CREATE POLICY "Service role can manage verification codes" ON email_verification_codes
    FOR ALL USING (auth.role() = 'service_role');

-- Function to generate a random 5-character alphanumeric code
CREATE OR REPLACE FUNCTION generate_verification_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- Excludes I, O, 0, 1 to avoid confusion
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..5 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to create and store a verification code
CREATE OR REPLACE FUNCTION create_verification_code(email_param TEXT)
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
BEGIN
    -- Generate unique code
    new_code := generate_verification_code();
    
    -- Delete any existing codes for this email
    DELETE FROM email_verification_codes WHERE email = email_param;
    
    -- Insert new code with 10-minute expiry
    INSERT INTO email_verification_codes (email, code, expires_at)
    VALUES (email_param, new_code, NOW() + INTERVAL '10 minutes');
    
    RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify a code
CREATE OR REPLACE FUNCTION verify_email_code(email_param TEXT, code_param TEXT)
RETURNS JSONB AS $$
DECLARE
    verification_record RECORD;
BEGIN
    -- Get the verification record
    SELECT * INTO verification_record 
    FROM email_verification_codes 
    WHERE email = email_param 
    AND verified = false
    ORDER BY created_at DESC 
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'No verification code found');
    END IF;
    
    -- Check if expired
    IF verification_record.expires_at < NOW() THEN
        DELETE FROM email_verification_codes WHERE id = verification_record.id;
        RETURN jsonb_build_object('success', false, 'error', 'Code has expired');
    END IF;
    
    -- Check attempts (max 5)
    IF verification_record.attempts >= 5 THEN
        DELETE FROM email_verification_codes WHERE id = verification_record.id;
        RETURN jsonb_build_object('success', false, 'error', 'Too many attempts. Please request a new code.');
    END IF;
    
    -- Check code (case insensitive)
    IF UPPER(verification_record.code) != UPPER(code_param) THEN
        UPDATE email_verification_codes 
        SET attempts = attempts + 1 
        WHERE id = verification_record.id;
        RETURN jsonb_build_object('success', false, 'error', 'Invalid code');
    END IF;
    
    -- Mark as verified
    UPDATE email_verification_codes 
    SET verified = true 
    WHERE id = verification_record.id;
    
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup old verification codes (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS void AS $$
BEGIN
    DELETE FROM email_verification_codes 
    WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_verification_code(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION verify_email_code(TEXT, TEXT) TO anon, authenticated, service_role;
