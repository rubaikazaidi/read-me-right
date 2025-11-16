-- Add queue_position to book_requests
ALTER TABLE public.book_requests 
ADD COLUMN queue_position integer;

-- Add RLS policy for librarians to update requests
CREATE POLICY "Librarians can update requests"
ON public.book_requests
FOR UPDATE
USING (has_role(auth.uid(), 'librarian'::app_role));

-- Add RLS policy for librarians to delete requests
CREATE POLICY "Librarians can delete requests"
ON public.book_requests
FOR DELETE
USING (has_role(auth.uid(), 'librarian'::app_role));

-- Create function to get next queue position for a book
CREATE OR REPLACE FUNCTION public.get_next_queue_position(book_id_param uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(MAX(queue_position), 0) + 1
  FROM public.book_requests
  WHERE book_id = book_id_param AND status = 'pending';
$$;

-- Create function to handle book request with automatic assignment
CREATE OR REPLACE FUNCTION public.handle_book_request(
  book_id_param uuid,
  user_id_param uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  book_status text;
  queue_pos integer;
  result jsonb;
BEGIN
  -- Get current book status
  SELECT status INTO book_status
  FROM public.books
  WHERE id = book_id_param;

  IF book_status = 'available' THEN
    -- Book is available, assign it immediately
    UPDATE public.books
    SET status = 'borrowed',
        borrowed_by = user_id_param,
        due_date = NOW() + INTERVAL '14 days'
    WHERE id = book_id_param;

    -- Create request record with no queue position
    INSERT INTO public.book_requests (book_id, user_id, status, queue_position)
    VALUES (book_id_param, user_id_param, 'approved', NULL);

    result := jsonb_build_object(
      'success', true,
      'message', 'Book borrowed successfully',
      'queue_position', NULL
    );
  ELSE
    -- Book is borrowed, add to queue
    queue_pos := get_next_queue_position(book_id_param);
    
    INSERT INTO public.book_requests (book_id, user_id, status, queue_position)
    VALUES (book_id_param, user_id_param, 'pending', queue_pos);

    result := jsonb_build_object(
      'success', true,
      'message', 'Added to queue',
      'queue_position', queue_pos
    );
  END IF;

  RETURN result;
END;
$$;