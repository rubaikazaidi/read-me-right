
-- Create table for organization join requests (students requesting to join an org)
CREATE TABLE public.organization_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  full_name text NOT NULL,
  email text,
  grade text,
  age integer,
  gr_number text,
  account_created_at timestamptz NOT NULL DEFAULT now(),
  requested_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id)
);

ALTER TABLE public.organization_join_requests ENABLE ROW LEVEL SECURITY;

-- Students can create their own request (they have no org yet, so we don't gate on get_user_organization_id)
CREATE POLICY "Users can create own join requests"
  ON public.organization_join_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own requests
CREATE POLICY "Users can view own join requests"
  ON public.organization_join_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete (cancel) their own pending requests
CREATE POLICY "Users can delete own join requests"
  ON public.organization_join_requests
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Librarians can view requests targeting their organization
CREATE POLICY "Librarians can view join requests for their org"
  ON public.organization_join_requests
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'librarian'::app_role)
    AND organization_id = get_user_organization_id(auth.uid())
  );

-- Librarians can update (approve/decline) requests for their org
CREATE POLICY "Librarians can update join requests for their org"
  ON public.organization_join_requests
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'librarian'::app_role)
    AND organization_id = get_user_organization_id(auth.uid())
  );

-- Approve function: sets the student's profile organization_id and marks the request approved.
-- Runs with definer privileges so the librarian can update a profile that currently has NULL org.
CREATE OR REPLACE FUNCTION public.approve_join_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req record;
  librarian_org uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'librarian'::app_role) THEN
    RAISE EXCEPTION 'Only librarians can approve join requests';
  END IF;

  librarian_org := get_user_organization_id(auth.uid());

  SELECT * INTO req FROM public.organization_join_requests WHERE id = _request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF req.organization_id != librarian_org THEN
    RAISE EXCEPTION 'You can only approve requests for your own organization';
  END IF;

  UPDATE public.profiles
  SET organization_id = req.organization_id
  WHERE id = req.user_id;

  UPDATE public.organization_join_requests
  SET status = 'approved'
  WHERE id = _request_id;
END;
$$;

-- Decline function (also definer for symmetry)
CREATE OR REPLACE FUNCTION public.decline_join_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  librarian_org uuid;
  req_org uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'librarian'::app_role) THEN
    RAISE EXCEPTION 'Only librarians can decline join requests';
  END IF;

  librarian_org := get_user_organization_id(auth.uid());

  SELECT organization_id INTO req_org FROM public.organization_join_requests WHERE id = _request_id;
  IF req_org IS NULL OR req_org != librarian_org THEN
    RAISE EXCEPTION 'You can only decline requests for your own organization';
  END IF;

  UPDATE public.organization_join_requests
  SET status = 'declined'
  WHERE id = _request_id;
END;
$$;
