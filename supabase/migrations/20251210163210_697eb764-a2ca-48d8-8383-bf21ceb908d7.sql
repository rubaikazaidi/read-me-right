-- Create borrowing history table to track all completed borrowings
CREATE TABLE public.borrowing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  book_title text NOT NULL,
  book_author text NOT NULL,
  borrowed_at timestamp with time zone NOT NULL,
  returned_at timestamp with time zone NOT NULL DEFAULT now(),
  was_late boolean NOT NULL DEFAULT false,
  days_late integer DEFAULT 0,
  fine_amount numeric(10,2) DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.borrowing_history ENABLE ROW LEVEL SECURITY;

-- Students can view their own borrowing history
CREATE POLICY "Users can view own borrowing history"
ON public.borrowing_history
FOR SELECT
USING (auth.uid() = user_id);

-- Librarians can view all borrowing history
CREATE POLICY "Librarians can view all borrowing history"
ON public.borrowing_history
FOR SELECT
USING (has_role(auth.uid(), 'librarian'::app_role));

-- Librarians can insert borrowing history (when marking books as returned)
CREATE POLICY "Librarians can insert borrowing history"
ON public.borrowing_history
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'librarian'::app_role));