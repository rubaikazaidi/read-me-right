-- Allow signup metadata to choose librarian role, default to student otherwise
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  requested_role text;
BEGIN
  requested_role := NEW.raw_user_meta_data->>'role';

  IF requested_role = 'librarian' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'librarian');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  END IF;

  RETURN NEW;
END;
$$;

-- Make sure the trigger exists (in case it was missing)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enforce one organization per librarian email
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_created_by_unique UNIQUE (created_by);
