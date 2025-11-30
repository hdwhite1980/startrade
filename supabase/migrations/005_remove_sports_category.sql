-- Migration: Remove SPORTS category from the platform
-- StarTrade focuses on entertainment predictions only, no sports betting

-- Update markets category constraint (remove SPORTS)
ALTER TABLE markets DROP CONSTRAINT IF EXISTS markets_category_check;
ALTER TABLE markets ADD CONSTRAINT markets_category_check 
    CHECK (category IN ('MUSIC', 'FILM', 'SOCIAL', 'AWARDS', 'CHARTS', 'STREAMING', 'OTHER'));

-- Update celebrities category constraint (remove Sports)
ALTER TABLE celebrities DROP CONSTRAINT IF EXISTS celebrities_category_check;
ALTER TABLE celebrities ADD CONSTRAINT celebrities_category_check 
    CHECK (category IN ('Music', 'Film', 'Social Media', 'TV', 'Gaming'));

-- Update any existing SPORTS markets to OTHER
UPDATE markets SET category = 'OTHER' WHERE category = 'SPORTS';

-- Update any existing Sports celebrities to Social Media (generic)
UPDATE celebrities SET category = 'Social Media' WHERE category = 'Sports';
