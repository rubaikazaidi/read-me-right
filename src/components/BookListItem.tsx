import { Book, GroupedBook } from "@/types/book";
import { Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

interface BookListItemProps {
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

export function BookListItem({ 
  book, 
  onRequestBook, 
  onLeaveQueue, 
  isLibrarian = false, 
  onEdit, 
  onViewDetails, 
  userRequest 
}: BookListItemProps) {
  const statusStyle = statusConfig[book.status];

  return (
    <div 
      className={`flex items-center gap-4 p-3 bg-card border rounded-lg hover:shadow-md transition-all ${isLibrarian ? 'cursor-pointer' : ''}`}
      onClick={isLibrarian && onViewDetails ? onViewDetails : undefined}
    >
      {/* Book Cover Thumbnail */}
      <div className="w-12 h-16 flex-shrink-0 rounded overflow-hidden bg-muted">
        {book.cover_image_url ? (
          <img 
            src={book.cover_image_url} 
            alt={book.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
            <BookOpen className="w-5 h-5 text-primary/40" />
          </div>
        )}
      </div>

      {/* Book Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm truncate text-foreground">
            {book.title}
          </h3>
          <Badge className={`text-xs flex-shrink-0 ${statusStyle.className}`}>
            {statusStyle.label}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">
          by {book.author}
        </p>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {book.category && <span>{book.category}</span>}
          {book.isbn && <span className="opacity-60">ISBN: {book.isbn}</span>}
          {isLibrarian && book.due_date && (
            <span>Due: {new Date(book.due_date).toLocaleDateString()}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {isLibrarian && onEdit && (
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            <Pencil className="w-3 h-3 mr-1" />
            Edit
          </Button>
        )}

        {onRequestBook && !userRequest && (
          <Button 
            onClick={(e) => { e.stopPropagation(); onRequestBook(book.id); }} 
            className="text-xs h-8"
            size="sm"
            variant={book.status === "available" ? "default" : "outline"}
          >
            {book.status === "available" ? "Borrow" : "Join Queue"}
          </Button>
        )}

        {userRequest && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md">
            <span className="text-xs font-medium">
              {userRequest.status === "approved" ? (
                "✓ Borrowed"
              ) : userRequest.queue_position ? (
                <>Queue #{userRequest.queue_position}</>
              ) : (
                "Pending"
              )}
            </span>
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
        )}
      </div>
    </div>
  );
}
