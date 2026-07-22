-- Migration: Add JSONB column for user UI preferences
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS ui_preferences JSONB DEFAULT '{}'::jsonb;
