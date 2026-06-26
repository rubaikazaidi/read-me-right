-- Allow up to 5 librarians per organization
CREATE OR REPLACE FUNCTION public.join_organization_as_librarian(_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  librarian_count integer;
  org_exists boolean;
BEGIN
  IF NOT has_role(auth.uid(), 'librarian'::app_role) THEN
    RAISE EXCEPTION 'Only librarian accounts can join an organization as a librarian';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.organizations WHERE id = _org_id) INTO org_exists;
  IF NOT org_exists THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  -- Count existing librarians attached to this org
  SELECT COUNT(*) INTO librarian_count
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.organization_id = _org_id AND ur.role = 'librarian'::app_role;

  IF librarian_count >= 5 THEN
    RAISE EXCEPTION 'This organization already has the maximum of 5 librarian accounts';
  END IF;

  -- Upsert profile and set organization
  INSERT INTO public.profiles (id, full_name, email, organization_id)
  VALUES (
    auth.uid(),
    COALESCE((SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = auth.uid()), ''),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    _org_id
  )
  ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;
END;
$$;

-- Helper to count current librarians per org (for UI use through the view)
CREATE OR REPLACE FUNCTION public.get_organization_librarian_count(_org_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.organization_id = _org_id AND ur.role = 'librarian'::app_role;
$$;

GRANT EXECUTE ON FUNCTION public.join_organization_as_librarian(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_organization_librarian_count(uuid) TO anon, authenticated;