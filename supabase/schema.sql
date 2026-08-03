-- Complete Production Schema for Jewellery Video Automation SaaS Platform

-- Create Enum Types safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'shop_user');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'profile_status') THEN
        CREATE TYPE profile_status AS ENUM ('active', 'suspended');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_status') THEN
        CREATE TYPE shop_status AS ENUM ('pending', 'active', 'inactive');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
        CREATE TYPE subscription_status AS ENUM ('pending_approval', 'active', 'expired', 'suspended', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status') THEN
        CREATE TYPE video_status AS ENUM ('active', 'archived');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'template_status') THEN
        CREATE TYPE template_status AS ENUM ('active', 'archived');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'template_type') THEN
        CREATE TYPE template_type AS ENUM ('luxury', 'festival', 'offer', 'minimal', 'premium');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'occasion_status') THEN
        CREATE TYPE occasion_status AS ENUM ('draft', 'active', 'archived');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'schedule_status') THEN
        CREATE TYPE schedule_status AS ENUM ('scheduled', 'processing', 'completed', 'failed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'download_status') THEN
        CREATE TYPE download_status AS ENUM ('pending', 'downloaded');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'render_status') THEN
        CREATE TYPE render_status AS ENUM ('pending', 'rendering', 'rendered', 'failed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'batch_status') THEN
        CREATE TYPE batch_status AS ENUM ('draft', 'applied', 'rolled_back');
    END IF;
END$$;

-- Create Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create States Master Table
CREATE TABLE IF NOT EXISTS states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(10) NOT NULL UNIQUE
);

-- Create Districts Master Table
CREATE TABLE IF NOT EXISTS districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id UUID NOT NULL REFERENCES states(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  CONSTRAINT unique_state_district UNIQUE (state_id, name)
);

-- Create Languages Master Table
CREATE TABLE IF NOT EXISTS languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_name VARCHAR(100) NOT NULL UNIQUE,
  locale VARCHAR(10) NOT NULL UNIQUE
);

-- Create Shops Table
CREATE TABLE IF NOT EXISTS shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_code VARCHAR(20) UNIQUE NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name VARCHAR(255) NOT NULL,
  owner_name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  phone VARCHAR(15) NOT NULL,
  owner_phone VARCHAR(20),
  state_id UUID NOT NULL REFERENCES states(id),
  district_id UUID NOT NULL REFERENCES districts(id),
  city VARCHAR(100) NOT NULL,
  language_id UUID NOT NULL REFERENCES languages(id),
  logo_url TEXT NOT NULL,
  status shop_status NOT NULL DEFAULT 'pending',
  assigned_sales_admin_id UUID,
  created_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create Profiles Table (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  role user_role NOT NULL DEFAULT 'shop_user',
  shop_id UUID REFERENCES shops(id) ON DELETE SET NULL,
  managed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status profile_status NOT NULL DEFAULT 'active',
  permissions TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Link shops FKs to profiles (applied after profiles table exists)
ALTER TABLE shops ADD CONSTRAINT fk_shops_assigned_sales_admin FOREIGN KEY (assigned_sales_admin_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE shops ADD CONSTRAINT fk_shops_created_by FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Create Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  status subscription_status NOT NULL DEFAULT 'pending_approval',
  plan VARCHAR(50) DEFAULT 'Standard' NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  renewal_date DATE,
  razorpay_sub_id VARCHAR(255) UNIQUE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create Videos Table
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) DEFAULT 'Untitled Video' NOT NULL,
  cloudflare_url TEXT NOT NULL,
  thumbnail_url TEXT,
  category VARCHAR(100) NOT NULL,
  status video_status NOT NULL DEFAULT 'active',
  usage_count INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create Video tagging relationships (Normalized indexing)
CREATE TABLE IF NOT EXISTS video_languages (
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  language_id UUID NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
  PRIMARY KEY (video_id, language_id)
);

CREATE TABLE IF NOT EXISTS video_states (
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  state_id UUID NOT NULL REFERENCES states(id) ON DELETE CASCADE,
  PRIMARY KEY (video_id, state_id)
);

-- Create Occasions Table
CREATE TABLE IF NOT EXISTS occasions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  greetings JSONB NOT NULL,
  states VARCHAR(100)[] DEFAULT '{}'::VARCHAR(100)[] NOT NULL,
  languages VARCHAR(100)[] DEFAULT '{}'::VARCHAR(100)[] NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  priority INT DEFAULT 0 NOT NULL,
  overlay_url TEXT NOT NULL,
  status occasion_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create normalized video occasions
CREATE TABLE IF NOT EXISTS video_occasions (
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  occasion_id UUID NOT NULL REFERENCES occasions(id) ON DELETE CASCADE,
  PRIMARY KEY (video_id, occasion_id)
);

-- Create Templates Table
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  bg_image_url TEXT NOT NULL,
  outro_url TEXT NOT NULL,
  preview_url TEXT,
  config JSONB NOT NULL,
  status template_status NOT NULL DEFAULT 'active',
  template_type template_type NOT NULL DEFAULT 'minimal',
  version VARCHAR(20) DEFAULT '1.0.0' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create Gold Rates Table
CREATE TABLE IF NOT EXISTS gold_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_date DATE UNIQUE DEFAULT CURRENT_DATE NOT NULL,
  rate_22k NUMERIC(10,2) NOT NULL,
  rate_24k NUMERIC(10,2) NOT NULL,
  rate_18k NUMERIC(10,2) NOT NULL,
  rate_silver NUMERIC(10,2) NOT NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create Schedule Batches Table (For easy scheduler rollbacks)
CREATE TABLE IF NOT EXISTS schedule_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status batch_status NOT NULL DEFAULT 'draft',
  generated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create Schedules Table (Ensures strict 1-per-day shop limit)
CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE RESTRICT,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
  occasion_id UUID REFERENCES occasions(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  status schedule_status NOT NULL DEFAULT 'scheduled',
  download_status download_status NOT NULL DEFAULT 'pending',
  render_status render_status NOT NULL DEFAULT 'pending',
  priority INT DEFAULT 0 NOT NULL,
  batch_id UUID REFERENCES schedule_batches(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_shop_schedule_date UNIQUE (shop_id, scheduled_date)
);

-- Create Downloads Table
CREATE TABLE IF NOT EXISTS downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE RESTRICT,
  video_id UUID REFERENCES videos(id) ON DELETE SET NULL,
  render_time_ms INT,
  render_duration_ms INT,
  file_size_bytes BIGINT,
  download_ip VARCHAR(45),
  download_attempts INT DEFAULT 1 NOT NULL,
  device_info JSONB DEFAULT '{}'::JSONB NOT NULL,
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create System Settings Table (To avoid hardcoded properties)
CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create Indexing Strategies
CREATE INDEX IF NOT EXISTS idx_shops_assigned_sales_admin ON shops(assigned_sales_admin_id);
CREATE INDEX IF NOT EXISTS idx_shops_district_state_ids ON shops(state_id, district_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_role_shop ON profiles(role, shop_id);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_date ON subscriptions(status, end_date);
CREATE INDEX IF NOT EXISTS idx_videos_usage ON videos(usage_count);
CREATE INDEX IF NOT EXISTS idx_schedules_render_status ON schedules(render_status);
CREATE INDEX IF NOT EXISTS idx_downloads_video_id ON downloads(video_id);
CREATE INDEX IF NOT EXISTS idx_schedules_shop_date ON schedules(shop_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_downloads_shop_schedule ON downloads(shop_id, schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedules_batch ON schedules(batch_id);

-- User Auth synchronization triggers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', 'New User'),
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'shop_user'::user_role)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
