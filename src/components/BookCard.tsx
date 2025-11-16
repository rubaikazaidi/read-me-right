import { Book } from "@/types/book";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

interface BookCardProps {
  book: Book;
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

export function BookCard({ book }: BookCardProps) {
  const statusStyle = statusConfig[book.status];

  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      <CardHeader className="p-0">
        <div className="aspect-[2/3] overflow-hidden bg-muted relative">
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              alt={`Cover of ${book.title}`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
              <BookOpen className="w-16 h-16 text-primary/40" />
            </div>
          )}
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
      </CardContent>
      {(book.borrowedBy || book.dueDate) && (
        <CardFooter className="px-4 pb-4 pt-0 text-xs text-muted-foreground">
          {book.borrowedBy && <p>Borrowed by: {book.borrowedBy}</p>}
          {book.dueDate && <p>Due: {new Date(book.dueDate).toLocaleDateString()}</p>}
        </CardFooter>
      )}
    </Card>
  );
}
