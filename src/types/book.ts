export type BookStatus = "available" | "borrowed" | "late";

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  status: BookStatus;
  borrowed_by?: string | null;
  borrowed_at?: string | null;
  due_date?: string | null;
  created_at?: string;
  cover_image_url?: string | null;
  copy_number?: number;
  dewey_decimal?: string | null;
  age_rating?: string | null;
}

export interface GroupedBook extends Book {
  totalCopies: number;
  availableCopies: number;
  borrowedCopies: number;
  lateCopies: number;
  allCopyIds: string[];
}

export function groupBooksByIsbn(books: Book[]): GroupedBook[] {
  const groups: Record<string, Book[]> = {};

  for (const book of books) {
    const key = book.isbn || book.id; // fallback to id if no isbn
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(book);
  }

  return Object.values(groups).map((copies) => {
    // Pick the first available copy as representative, or the first copy
    const representative =
      copies.find((c) => c.status === "available") || copies[0];

    const availableCopies = copies.filter((c) => c.status === "available").length;
    const borrowedCopies = copies.filter((c) => c.status === "borrowed").length;
    const lateCopies = copies.filter((c) => c.status === "late").length;

    // Determine the displayed status based on availability
    let displayStatus: BookStatus = "borrowed";
    if (availableCopies > 0) displayStatus = "available";
    else if (lateCopies > 0) displayStatus = "late";

    return {
      ...representative,
      status: copies.length > 1 ? displayStatus : representative.status,
      totalCopies: copies.length,
      availableCopies,
      borrowedCopies,
      lateCopies,
      allCopyIds: copies.map((c) => c.id),
    };
  });
}
