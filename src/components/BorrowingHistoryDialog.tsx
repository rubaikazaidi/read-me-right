import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { History, BookOpen, Calendar, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface BorrowingRecord {
  id: string;
  book_id: string;
  book_title: string;
  book_author: string;
  borrowed_at: string;
  returned_at: string;
  was_late: boolean;
  days_late: number;
  fine_amount: number;
}

interface BorrowingHistoryDialogProps {
  trigger: React.ReactNode;
}

export function BorrowingHistoryDialog({ trigger }: BorrowingHistoryDialogProps) {
  const { user } = useAuth();
  const [history, setHistory] = useState<BorrowingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && user) {
      fetchHistory();
    }
  }, [open, user]);

  const fetchHistory = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("borrowing_history")
        .select("*")
        .eq("user_id", user.id)
        .order("returned_at", { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error("Failed to fetch borrowing history:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Borrowing History
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No borrowing history yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Books you return will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((record) => (
                <div
                  key={record.id}
                  className={`border rounded-lg p-4 ${
                    record.was_late
                      ? "border-destructive/50 bg-destructive/5"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold truncate">{record.book_title}</h4>
                      <p className="text-sm text-muted-foreground">{record.book_author}</p>
                    </div>
                    {record.was_late && (
                      <Badge variant="destructive" className="shrink-0">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Late
                      </Badge>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Borrowed: {format(new Date(record.borrowed_at), "MMM d, yyyy")}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Returned: {format(new Date(record.returned_at), "MMM d, yyyy")}</span>
                    </div>
                  </div>

                  {record.was_late && (
                    <div className="mt-3 p-2 bg-destructive/10 rounded text-sm">
                      <p className="text-destructive font-medium">
                        Late by {record.days_late} day{record.days_late !== 1 ? "s" : ""}
                      </p>
                      <p className="text-destructive">
                        Fine paid: ₹{Number(record.fine_amount).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
