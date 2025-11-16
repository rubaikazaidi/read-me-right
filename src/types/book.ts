export type BookStatus = "available" | "borrowed" | "late";

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  coverUrl?: string;
  status: BookStatus;
  borrowedBy?: string;
  dueDate?: string;
  addedDate: string;
}
