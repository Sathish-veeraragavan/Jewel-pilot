-- Create Video Categories Table
CREATE TABLE IF NOT EXISTS video_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  code VARCHAR(10) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Seed initial categories
INSERT INTO video_categories (name, code) VALUES
('Necklace', 'NC'),
('Bracelets/Bangles', 'BG'),
('Rings', 'RG'),
('Earrings', 'ER'),
('Ankle Chains', 'AC'),
('Chains', 'CH')
ON CONFLICT (name) DO NOTHING;
