-- ==========================================
-- SCHEMA INITIALIZATION FOR PROMESSÔMETRO
-- ==========================================

-- Enable the uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Politicians Table
CREATE TABLE public.politicians (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL, -- e.g., Prefeito, Governador, Deputado
  party TEXT,
  state TEXT,
  city TEXT,
  photo_url TEXT,
  bio TEXT,
  website_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Promises Table
CREATE TABLE public.promises (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  politician_id UUID REFERENCES public.politicians(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT, -- e.g., Saúde, Educação, Segurança
  status TEXT DEFAULT 'pending' CHECK (status IN ('fulfilled', 'partial', 'broken', 'pending')),
  evidence_url TEXT, -- Link to news or official doc
  date_promised TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Promise Updates Table
CREATE TABLE public.updates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  promise_id UUID REFERENCES public.promises(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  source_url TEXT,
  status_after TEXT CHECK (status_after IN ('fulfilled', 'partial', 'broken', 'pending')),
  evidence_image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. User Reports/Submissions Table
CREATE TABLE public.reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  politician_id UUID REFERENCES public.politicians(id),
  promise_id UUID REFERENCES public.promises(id), -- Optional if reporting a new promise
  type TEXT CHECK (type IN ('new_promise', 'status_update')),
  description TEXT NOT NULL,
  evidence_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RLS (Row Level Security)
ALTER TABLE public.politicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can read politicians" ON public.politicians FOR SELECT USING (true);
CREATE POLICY "Anyone can read promises" ON public.promises FOR SELECT USING (true);
CREATE POLICY "Anyone can read updates" ON public.updates FOR SELECT USING (true);

-- Users can insert reports, admins can do everything
CREATE POLICY "Users can insert reports" ON public.reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own reports" ON public.reports FOR SELECT USING (auth.uid() = user_id);

-- Admin Logic (reusing role from existing users table if present)
-- Assuming admin checks will be done via server-side or a specific role column
