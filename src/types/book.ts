export type BookStatus = "available" | "borrowed" | "late";

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  status: BookStatus;
  borrowed_by?: string | null;
  due_date?: string | null;
  created_at?: string;
  cover_image_url?: string | null;
}
