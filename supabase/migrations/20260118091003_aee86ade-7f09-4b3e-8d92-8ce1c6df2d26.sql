-- Fix: Critical Role Escalation in User Signup
-- The handle_new_user function must NEVER trust client-provided role metadata
-- Always assign 'student' role by default. Librarian promotion must be done separately.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY FIX: Always assign 'student' role by default
  -- Never trust client-provided role metadata to prevent privilege escalation
  -- Librarian roles must be assigned through a separate secure process
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  
  RETURN NEW;
END;
$$;