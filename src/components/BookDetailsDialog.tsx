import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Book } from "@/types/book";
import { calculateFine, getFineSettings } from "./FineSettingsDialog";
import { differenceInDays } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, User, Mail, Calendar, Clock, History, AlertTriangle } from "lucide-react";
import { BookHistoryDialog } from "./BookHistoryDialog";

interface BookDetailsDialogProps {
  book: Book | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface BorrowerProfile {
  full_name: string;
  email: string | null;
}

interface QueueRequest {
  id: string;
  status: string;
  queue_position: number | null;
  requested_at: string;
  profiles: {
    full_name: string;
    email: string | null;
  };
}

interface CopyInfo {
  id: string;
  copy_number: number;
  status: "available" | "borrowed" | "late";
  due_date: string | null;
  borrower_name: string | null;
}

export function BookDetailsDialog({ book, open, onOpenChange }: BookDetailsDialogProps) {
  const [borrower, setBorrower] = useState<BorrowerProfile | null>(null);
  const [queueRequests, setQueueRequests] = useState<QueueRequest[]>([]);
  const [copies, setCopies] = useState<CopyInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (book && open) {
      fetchBookDetails();
    }
  }, [book, open]);

  const fetchBookDetails = async () => {
    if (!book) return;
    setLoading(true);

    try {
      // Fetch borrower details if book is borrowed
      if (book.borrowed_by) {
        const { data: borrowerData } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", book.borrowed_by)
          .maybeSingle();
        
        setBorrower(borrowerData);
      } else {
        setBorrower(null);
      }

      // Fetch queue requests for this book
      const { data: requestsData } = await supabase
        .from("book_requests")
        .select(`
          id,
          status,
          queue_position,
          requested_at,
          profiles:user_id (full_name, email)
        `)
        .eq("book_id", book.id)
        .order("queue_position", { ascending: true, nullsFirst: false });

      setQueueRequests(requestsData as QueueRequest[] || []);

      // Fetch all copies of this book (grouped by ISBN within the same org)
      if (book.isbn) {
        const { data: copyData } = await supabase
          .from("books")
          .select("id, copy_number, status, due_date, borrowed_by")
          .eq("isbn", book.isbn)
          .order("copy_number", { ascending: true });

        if (copyData && copyData.length > 1) {
          const borrowerIds = copyData
            .map((c) => c.borrowed_by)
            .filter((v): v is string => !!v);
          let borrowerMap: Record<string, string> = {};
          if (borrowerIds.length > 0) {
            const { data: profs } = await supabase
              .from("profiles")
              .select("id, full_name")
              .in("id", borrowerIds);
            borrowerMap = Object.fromEntries(
              (profs || []).map((p) => [p.id, p.full_name])
            );
          }
          setCopies(
            copyData.map((c) => ({
              id: c.id,
              copy_number: c.copy_number,
              status: c.status as CopyInfo["status"],
              due_date: c.due_date,
              borrower_name: c.borrowed_by ? borrowerMap[c.borrowed_by] ?? null : null,
            }))
          );
        } else {
          setCopies([]);
        }
      } else {
        setCopies([]);
      }
    } catch (error) {
      console.error("Error fetching book details:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!book) return null;

  const statusConfig = {
    available: { label: "Available", className: "bg-status-available text-white" },
    borrowed: { label: "Borrowed", className: "bg-status-borrowed text-white" },
    late: { label: "Late", className: "bg-status-late text-white" },
  };

  const statusStyle = statusConfig[book.status];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Book Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Book Info */}
          <div className="flex gap-4">
            <div className="w-24 h-36 bg-muted rounded-md overflow-hidden flex-shrink-0">
              {book.cover_image_url ? (
                <img src={book.cover_image_url} alt={book.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <BookOpen className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{book.title}</h3>
              <p className="text-muted-foreground">by {book.author}</p>
              <p className="text-sm text-muted-foreground mt-1">ISBN: {book.isbn}</p>
              <p className="text-sm text-muted-foreground">Category: {book.category}</p>
              <p className="text-sm text-muted-foreground">
                Dewey Decimal: <span className="font-mono font-medium text-foreground">{book.dewey_decimal || "—"}</span>
              </p>
              <Badge className={`mt-2 ${statusStyle.className}`}>{statusStyle.label}</Badge>
            </div>
          </div>

          {/* Borrower Details */}
          {(book.status === "borrowed" || book.status === "late") && borrower && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Current Borrower</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{borrower.full_name || "Unknown"}</span>
                </div>
                {borrower.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{borrower.email}</span>
                  </div>
                )}
                {book.borrowed_at && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Borrowed: {new Date(book.borrowed_at).toLocaleDateString()}</span>
                  </div>
                )}
                {book.due_date && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Due: {new Date(book.due_date).toLocaleDateString()}</span>
                  </div>
                )}
                {book.status === "late" && book.due_date && (() => {
                  const now = new Date();
                  const due = new Date(book.due_date);
                  const daysLate = Math.max(0, differenceInDays(now, due));
                  const fineAmount = calculateFine(book.due_date);
                  const settings = getFineSettings();
                  return (
                    <div className="mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm font-semibold">Overdue by {daysLate} day{daysLate !== 1 ? "s" : ""}</span>
                      </div>
                      <p className="text-lg font-bold text-destructive mt-1">Fine: ₹{fineAmount.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Rate: ₹{settings.firstDayFine} (1st day) + ₹{settings.additionalDayFine}/day after
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Per-copy statuses */}
          {copies.length > 1 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                All Copies ({copies.length})
              </h4>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {copies.map((c) => {
                  const s = statusConfig[c.status];
                  return (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">
                          Copy #{c.copy_number}
                        </Badge>
                        {c.borrower_name && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {c.borrower_name}
                          </span>
                        )}
                        {c.due_date && (c.status === "borrowed" || c.status === "late") && (
                          <span className="text-xs text-muted-foreground">
                            Due {new Date(c.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <Badge className={`text-xs ${s.className}`}>{s.label}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Queue Requests */}

          {queueRequests.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Request Queue ({queueRequests.length})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {queueRequests.map((request) => (
                  <div key={request.id} className="p-3 bg-muted/30 rounded-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {request.queue_position && (
                          <Badge variant="outline" className="text-xs">#{request.queue_position}</Badge>
                        )}
                        <span className="font-medium text-sm">{request.profiles?.full_name}</span>
                      </div>
                      <Badge variant={request.status === "approved" ? "default" : "secondary"} className="text-xs">
                        {request.status}
                      </Badge>
                    </div>
                    {request.profiles?.email && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {request.profiles.email}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading && <p className="text-sm text-muted-foreground text-center">Loading...</p>}

          {/* View History Button */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="h-4 w-4 mr-2" />
            View Borrowing History
          </Button>
        </div>

        <BookHistoryDialog
          bookId={book.id}
          bookTitle={book.title}
          open={historyOpen}
          onOpenChange={setHistoryOpen}
        />
      </DialogContent>
    </Dialog>
  );
}