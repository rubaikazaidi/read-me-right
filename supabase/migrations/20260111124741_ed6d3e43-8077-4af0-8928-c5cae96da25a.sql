-- Add new columns to profiles table for student information
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS grade text,
ADD COLUMN IF NOT EXISTS organization text,
ADD COLUMN IF NOT EXISTS age integer,
ADD COLUMN IF NOT EXISTS gr_number text,
ADD COLUMN IF NOT EXISTS profile_picture_url text;