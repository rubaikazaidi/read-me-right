import { Book } from "@/types/book";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

interface BookCardProps {
  book: Book;
  onRequestBook?: (bookId: string) => void;
  isLibrarian?: boolean;
}

const statusConfig = {
  available: {
    label: "Available",
    className: "bg-status-available text-white hover:bg-status-available/90",
  },
  borrowed: {
    label: "Borrowed",
    className: "bg-status-borrowed text-white hover:bg-status-borrowed/90",
  },
  late: {
    label: "Late",
    className: "bg-status-late text-white hover:bg-status-late/90",
  },
};

export function BookCard({ book, onRequestBook, isLibrarian = false }: BookCardProps) {
  const statusStyle = statusConfig[book.status];

  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      <CardHeader className="p-0">
        <div className="aspect-[2/3] overflow-hidden bg-muted relative">
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
            <BookOpen className="w-16 h-16 text-primary/40" />
          </div>
          <Badge className={`absolute top-3 right-3 ${statusStyle.className}`}>
            {statusStyle.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <h3 className="font-semibold text-lg line-clamp-2 mb-1 text-foreground">
          {book.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-1">
          by {book.author}
        </p>
        {book.isbn && (
          <p className="text-xs text-muted-foreground mt-2">
            ISBN: {book.isbn}
          </p>
        )}
        {book.category && (
          <p className="text-xs text-muted-foreground mt-1">
            Category: {book.category}
          </p>
        )}
      </CardContent>
      {onRequestBook && (
        <CardFooter className="px-4 pb-4 pt-0">
          <Button 
            onClick={() => onRequestBook(book.id)} 
            className="w-full"
            variant={book.status === "available" ? "default" : "outline"}
          >
            {book.status === "available" ? "Borrow Book" : "Join Queue"}
          </Button>
        </CardFooter>
      )}
      {isLibrarian && (book.borrowed_by || book.due_date) && (
        <CardFooter className="px-4 pb-4 pt-0 text-xs text-muted-foreground">
          {book.borrowed_by && <p>Borrowed by: {book.borrowed_by}</p>}
          {book.due_date && <p>Due: {new Date(book.due_date).toLocaleDateString()}</p>}
        </CardFooter>
      )}
    </Card>
  );
}
