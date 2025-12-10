import { Book } from "@/types/book";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { BookOpen, Pencil, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface BookCardProps {
  book: Book;
  onRequestBook?: (bookId: string) => void;
  onLeaveQueue?: (bookId: string) => void;
  isLibrarian?: boolean;
  onEdit?: () => void;
  onViewDetails?: () => void;
  userRequest?: { status: string; queue_position: number | null } | null;
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

export function BookCard({ book, onRequestBook, onLeaveQueue, isLibrarian = false, onEdit, onViewDetails, userRequest }: BookCardProps) {
  const statusStyle = statusConfig[book.status];

  return (
    <Card 
      className={`group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${isLibrarian ? 'cursor-pointer' : ''}`}
      onClick={isLibrarian && onViewDetails ? onViewDetails : undefined}
    >
      <CardHeader className="p-0">
        <div className="aspect-[2/3] overflow-hidden bg-muted relative">
          {book.cover_image_url ? (
            <img 
              src={book.cover_image_url} 
              alt={book.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
              <BookOpen className="w-10 h-10 text-primary/40" />
            </div>
          )}
          <Badge className={`absolute top-2 right-2 text-xs ${statusStyle.className}`}>
            {statusStyle.label}
          </Badge>
          {onEdit && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-2 left-2 h-6 w-6"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
            >
              <Pencil className="w-3 h-3" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-3">
        <h3 className="font-semibold text-sm line-clamp-2 mb-1 text-foreground">
          {book.title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-1">
          by {book.author}
        </p>
        {book.category && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
            {book.category}
          </p>
        )}
      </CardContent>
      {onRequestBook && !userRequest && (
        <CardFooter className="px-3 pb-3 pt-0">
          <Button 
            onClick={() => onRequestBook(book.id)} 
            className="w-full text-xs h-8"
            size="sm"
            variant={book.status === "available" ? "default" : "outline"}
          >
            {book.status === "available" ? "Borrow" : "Join Queue"}
          </Button>
        </CardFooter>
      )}
      {userRequest && (
        <CardFooter className="px-3 pb-3 pt-0">
          <div className="w-full flex items-center justify-center gap-2 p-2 bg-muted rounded-md">
            <p className="text-xs font-medium">
              {userRequest.status === "approved" ? (
                "✓ Borrowed"
              ) : userRequest.queue_position ? (
                <>Queue #{userRequest.queue_position}</>
              ) : (
                "Pending"
              )}
            </p>
            {userRequest.status === "pending" && userRequest.queue_position && onLeaveQueue && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-muted-foreground hover:text-destructive"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Leave Queue?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to leave the queue for "{book.title}"? You will lose your current position.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onLeaveQueue(book.id)}>
                      Leave Queue
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardFooter>
      )}
      {isLibrarian && (book.borrowed_by || book.due_date) && (
        <CardFooter className="px-3 pb-3 pt-0 text-xs text-muted-foreground flex-col items-start">
          {book.borrowed_by && <p className="line-clamp-1">By: {book.borrowed_by}</p>}
          {book.due_date && <p>Due: {new Date(book.due_date).toLocaleDateString()}</p>}
        </CardFooter>
      )}
    </Card>
  );
}
