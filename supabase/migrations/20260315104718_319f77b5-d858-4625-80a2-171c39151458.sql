CREATE POLICY "Students can delete own requests"
ON public.book_requests
FOR DELETE
TO authenticated
USING (auth.uid() = user_id AND has_role(auth.uid(), 'student'::app_role));