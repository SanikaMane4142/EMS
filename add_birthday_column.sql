-- Add birthday column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS birthday DATE;
