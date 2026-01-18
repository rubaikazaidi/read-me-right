-- Fix get_next_queue_position to enforce organization isolation
CREATE OR REPLACE FUNCTION public.get_next_queue_position(book_id_param uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  book_org_id uuid;
  user_org_id uuid;
  result integer;
BEGIN
  -- Get book's organization
  SELECT organization_id INTO book_org_id
  FROM public.books
  WHERE id = book_id_param;
  
  -- Get user's organization
  user_org_id := get_user_organization_id(auth.uid());
  
  -- Verify same organization (deny if book not found or different org)
  IF book_org_id IS NULL OR book_org_id != user_org_id THEN
    RAISE EXCEPTION 'Access denied: book not in your organization';
  END IF;
  
  -- Return queue position for same organization only
  SELECT COALESCE(MAX(queue_position), 0) + 1 INTO result
  FROM public.book_requests
  WHERE book_id = book_id_param 
    AND status = 'pending'
    AND organization_id = user_org_id;
    
  RETURN result;
END;
$$;