-- UNL City Hub — Supabase schema
-- Run this in the Supabase SQL Editor after creating your project.

-- Cache table: stores fetched API responses for longitudinal analysis
CREATE TABLE IF NOT EXISTS public.data_cache (
  id BIGSERIAL PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  city TEXT NOT NULL,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by key and recent fetches
CREATE INDEX IF NOT EXISTS idx_data_cache_key ON public.data_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_data_cache_fetched ON public.data_cache(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_cache_city ON public.data_cache(city);

-- Row Level Security (RLS) — allow public read, authenticated write
ALTER TABLE public.data_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read"
  ON public.data_cache FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated insert"
  ON public.data_cache FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Pageviews table for analytics
CREATE TABLE IF NOT EXISTS public.pageviews (
  id BIGSERIAL PRIMARY KEY,
  path TEXT NOT NULL,
  referrer TEXT,
  country TEXT,
  city TEXT,
  language TEXT,
  user_agent TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pageviews_timestamp ON public.pageviews(timestamp DESC);

ALTER TABLE public.pageviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert"
  ON public.pageviews FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public read"
  ON public.pageviews FOR SELECT
  USING (true);
