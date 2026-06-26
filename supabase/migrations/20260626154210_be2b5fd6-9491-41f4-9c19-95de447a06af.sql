CREATE OR REPLACE FUNCTION public.enforce_librarian_limit_per_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  librarian_count integer;
  is_librarian boolean;
BEGIN
  -- Only check when an organization is being set/changed to a non-null value
  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id THEN
    RETURN NEW;
  END IF;

  -- Is the profile owner a librarian?
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.id AND role = 'librarian'::app_role
  ) INTO is_librarian;

  IF NOT is_librarian THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO librarian_count
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.organization_id = NEW.organization_id
    AND ur.role = 'librarian'::app_role
    AND p.id <> NEW.id;

  IF librarian_count >= 5 THEN
    RAISE EXCEPTION 'Organization already has the maximum of 5 librarian accounts'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_librarian_limit_on_profiles ON public.profiles;
CREATE TRIGGER enforce_librarian_limit_on_profiles
BEFORE INSERT OR UPDATE OF organization_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_librarian_limit_per_org();

-- Also enforce when a user is later granted the librarian role while already attached to an org
CREATE OR REPLACE FUNCTION public.enforce_librarian_limit_on_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_org uuid;
  librarian_count integer;
BEGIN
  IF NEW.role <> 'librarian'::app_role THEN
    RETURN NEW;
  END IF;

  SELECT organization_id INTO user_org FROM public.profiles WHERE id = NEW.user_id;
  IF user_org IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO librarian_count
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.organization_id = user_org
    AND ur.role = 'librarian'::app_role
    AND p.id <> NEW.user_id;

  IF librarian_count >= 5 THEN
    RAISE EXCEPTION 'Organization already has the maximum of 5 librarian accounts'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_librarian_limit_on_user_roles ON public.user_roles;
CREATE TRIGGER enforce_librarian_limit_on_user_roles
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_librarian_limit_on_role();