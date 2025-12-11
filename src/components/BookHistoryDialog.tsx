import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, User, Calendar, ArrowRight, AlertTriangle, IndianRupee } from "lucide-react";

interface BookHistoryDialogProps {
  bookId: string;
  bookTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface HistoryEntry {
  id: string;
  user_id: string;
  borrowed_at: string;
  returned_at: string;
  was_late: boolean;
  days_late: number | null;
  fine_amount: number | null;
  profiles: {
    full_name: string;
    email: string | null;
  } | null;
}

export function BookHistoryDialog({ bookId, bookTitle, open, onOpenChange }: BookHistoryDialogProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && bookId) {
      fetchHistory();
    }
  }, [open, bookId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("borrowing_history")
        .select(`
          id,
          user_id,
          borrowed_at,
          returned_at,
          was_late,
          days_late,
          fine_amount
        `)
        .eq("book_id", bookId)
        .order("returned_at", { ascending: false });

      if (error) throw error;

      // Fetch profile details for each history entry
      const historyWithProfiles = await Promise.all(
        (data || []).map(async (entry) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", entry.user_id)
            .maybeSingle();
          
          return { ...entry, profiles: profile };
        })
      );

      setHistory(historyWithProfiles);
    } catch (error) {
      console.error("Error fetching book history:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Borrowing History - {bookTitle}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[400px]">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No borrowing history for this book.</p>
          ) : (
            <div className="space-y-3 pr-4">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className={`p-4 rounded-lg border ${
                    entry.was_late ? "bg-destructive/5 border-destructive/20" : "bg-muted/30 border-border"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{entry.profiles?.full_name || "Unknown"}</span>
                    </div>
                    {entry.was_late && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Late
                      </Badge>
                    )}
                  </div>
                  
                  {entry.profiles?.email && (
                    <p className="text-xs text-muted-foreground mb-2">{entry.profiles.email}</p>
                  )}

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(entry.borrowed_at).toLocaleDateString()}</span>
                    <ArrowRight className="h-3 w-3" />
                    <span>{new Date(entry.returned_at).toLocaleDateString()}</span>
                  </div>

                  {entry.was_late && entry.days_late && (
                    <div className="mt-2 flex items-center gap-4 text-sm">
                      <span className="text-destructive">{entry.days_late} days late</span>
                      {entry.fine_amount && entry.fine_amount > 0 && (
                        <span className="flex items-center text-destructive font-medium">
                          <IndianRupee className="h-3 w-3" />
                          {entry.fine_amount}
                        </span>
                      )}
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
