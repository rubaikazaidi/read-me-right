
CREATE TABLE public.book_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  icon text DEFAULT 'BookOpen',
  color text DEFAULT '220 70% 50%',
  organization_id uuid REFERENCES public.organizations(id),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.book_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view categories"
  ON public.book_categories FOR SELECT
  TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()) OR organization_id IS NULL);

CREATE POLICY "Librarians can insert categories"
  ON public.book_categories FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'librarian'::app_role));

CREATE POLICY "Librarians can update categories"
  ON public.book_categories FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'librarian'::app_role));

CREATE POLICY "Librarians can delete categories"
  ON public.book_categories FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'librarian'::app_role));

-- Insert default categories
INSERT INTO public.book_categories (name, icon, color) VALUES
  ('Fiction', 'BookOpen', '280 60% 50%'),
  ('Non-Fiction', 'Newspaper', '200 70% 45%'),
  ('Textbooks', 'GraduationCap', '150 60% 40%'),
  ('Science', 'Atom', '170 70% 45%'),
  ('History', 'Landmark', '30 70% 45%'),
  ('Technology', 'Cpu', '210 80% 50%'),
  ('Biography', 'User', '340 60% 50%'),
  ('Other', 'Layers', '0 0% 50%');
