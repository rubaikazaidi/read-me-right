import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Book } from "@/types/book";
import { Badge } from "@/components/ui/badge";

interface BookRequest {
  id: string;
  book_id: string;
  user_id: string;
  status: string;
  queue_position: number | null;
  requested_at: string;
  profiles: {
    full_name: string;
  };
  books: {
    title: string;
    author: string;
  };
}

export function LibrarianDashboard() {
  const [requests, setRequests] = useState<BookRequest[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchRequests();
    fetchBooks();

    // Set up realtime subscription for book requests
    const channel = supabase
      .channel('book-requests-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'book_requests'
        },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("book_requests")
        .select(`
          *,
          profiles:user_id (full_name),
          books:book_id (title, author)
        `)
        .order("book_id")
        .order("queue_position", { ascending: true, nullsFirst: false });

      if (error) throw error;
      setRequests(data as any[] || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch requests",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchBooks = async () => {
    try {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .order("title");

      if (error) throw error;
      setBooks(data as Book[] || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch books",
      });
    }
  };

  const handleAssignBook = async (bookId: string, userId: string, requestId: string) => {
    try {
      // Update book status
      const { error: bookError } = await supabase
        .from("books")
        .update({
          status: "borrowed",
          borrowed_by: userId,
          due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", bookId);

      if (bookError) throw bookError;

      // Update request status
      const { error: requestError } = await supabase
        .from("book_requests")
        .update({ status: "approved", queue_position: null })
        .eq("id", requestId);

      if (requestError) throw requestError;

      toast({
        title: "Success",
        description: "Book assigned successfully",
      });

      fetchRequests();
      fetchBooks();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleUpdateBookStatus = async (bookId: string, newStatus: string) => {
    try {
      const updates: any = { status: newStatus };
      
      if (newStatus === "available") {
        updates.borrowed_by = null;
        updates.due_date = null;
      }

      const { error } = await supabase
        .from("books")
        .update(updates)
        .eq("id", bookId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Book status updated",
      });

      fetchBooks();
      fetchRequests();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  // Group requests by book
  const requestsByBook = requests.reduce((acc, request) => {
    if (!acc[request.book_id]) {
      acc[request.book_id] = [];
    }
    acc[request.book_id].push(request);
    return acc;
  }, {} as Record<string, BookRequest[]>);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Book Status Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {books.map((book) => (
              <div key={book.id} className="flex items-center justify-between p-4 border rounded-lg gap-4">
                <div className="flex-1">
                  <p className="font-semibold">{book.title}</p>
                  <p className="text-sm text-muted-foreground">by {book.author}</p>
                  <Badge className="mt-1">
                    {book.status === "available" ? "Available" : book.status === "borrowed" ? "Borrowed" : "Late"}
                  </Badge>
                </div>
                <Select value={book.status} onValueChange={(value) => handleUpdateBookStatus(book.id, value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="borrowed">Borrowed</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Request Queues</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(requestsByBook).length === 0 ? (
            <p className="text-muted-foreground">No pending requests</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(requestsByBook).map(([bookId, bookRequests]) => {
                const book = books.find((b) => b.id === bookId);
                return (
                  <div key={bookId} className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">
                      {bookRequests[0]?.books?.title} by {bookRequests[0]?.books?.author}
                    </h3>
                    <div className="space-y-2">
                      {bookRequests.map((request, index) => (
                        <div key={request.id} className="flex items-center justify-between p-3 bg-muted rounded">
                          <div className="flex items-center gap-3">
                            {request.queue_position && (
                              <Badge variant="outline">Queue #{request.queue_position}</Badge>
                            )}
                            <div>
                              <p className="font-medium">{request.profiles?.full_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {request.status === "pending" ? "Waiting in queue" : "Approved"}
                              </p>
                            </div>
                          </div>
                          {request.status === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => handleAssignBook(bookId, request.user_id, request.id)}
                            >
                              Assign Book
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
