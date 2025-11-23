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
        .select(`
          *,
          borrower:borrowed_by (full_name)
        `)
        .order("title");

      if (error) throw error;
      setBooks(data as any[] || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch books",
      });
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("book_requests")
        .update({ status: "approved" })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Request approved",
      });

      fetchRequests();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("book_requests")
        .delete()
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Request rejected",
      });

      fetchRequests();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleMarkAsTaken = async (bookId: string, userId: string, requestId: string) => {
    try {
      const now = new Date();
      // Update book status with 7 days due date
      const { error: bookError } = await supabase
        .from("books")
        .update({
          status: "borrowed",
          borrowed_by: userId,
          borrowed_at: now.toISOString(),
          due_date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", bookId);

      if (bookError) throw bookError;

      // Delete the request
      const { error: requestError } = await supabase
        .from("book_requests")
        .delete()
        .eq("id", requestId);

      if (requestError) throw requestError;

      toast({
        title: "Success",
        description: "Book marked as taken",
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

  const handleMarkAsReturned = async (bookId: string) => {
    try {
      const { error } = await supabase
        .from("books")
        .update({
          status: "available",
          borrowed_by: null,
          borrowed_at: null,
          due_date: null,
        })
        .eq("id", bookId);

      if (error) throw error;

      // Clear all book requests when book is returned
      const { error: requestsError } = await supabase
        .from("book_requests")
        .delete()
        .eq("book_id", bookId);

      if (requestsError) throw requestsError;

      toast({
        title: "Success",
        description: "Book marked as returned and is now available",
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

  const handleUpdateBookStatus = async (bookId: string, newStatus: string) => {
    try {
      const updates: any = { status: newStatus };
      
      if (newStatus === "available") {
        updates.borrowed_by = null;
        updates.borrowed_at = null;
        updates.due_date = null;
        
        // Clear all book requests when book is made available
        const { error: requestsError } = await supabase
          .from("book_requests")
          .delete()
          .eq("book_id", bookId);

        if (requestsError) throw requestsError;
      }

      const { error } = await supabase
        .from("books")
        .update(updates)
        .eq("id", bookId);

      if (error) throw error;

      toast({
        title: "Success",
        description: newStatus === "available" ? "Book marked as available and queue cleared" : "Book status updated",
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

  // Separate pending and approved requests
  const pendingRequests = requests.filter(req => req.status === "pending");
  const approvedRequests = requests.filter(req => req.status === "approved");

  // Group requests by book
  const pendingByBook = pendingRequests.reduce((acc, request) => {
    if (!acc[request.book_id]) {
      acc[request.book_id] = [];
    }
    acc[request.book_id].push(request);
    return acc;
  }, {} as Record<string, BookRequest[]>);

  const approvedByBook = approvedRequests.reduce((acc, request) => {
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
            {books.map((book) => {
              const bookApprovedRequests = approvedByBook[book.id] || [];
              return (
                <div key={book.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1">
                      <p className="font-semibold">{book.title}</p>
                      <p className="text-sm text-muted-foreground">by {book.author}</p>
                      <Badge className="mt-1">
                        {book.status === "available" ? "Available" : book.status === "borrowed" ? "Borrowed" : "Late"}
                      </Badge>
                      
                      {/* Show borrower details for borrowed books */}
                      {(book.status === "borrowed" || book.status === "late") && book.borrowed_by && (
                        <div className="mt-3 p-3 bg-muted/50 rounded-md space-y-1">
                          <p className="text-sm">
                            <span className="font-medium">Borrowed by:</span> {(book as any).borrower?.full_name || "Unknown"}
                          </p>
                          {book.borrowed_at && (
                            <p className="text-sm">
                              <span className="font-medium">Borrowed on:</span> {new Date(book.borrowed_at).toLocaleDateString()}
                            </p>
                          )}
                          {book.due_date && (
                            <p className="text-sm">
                              <span className="font-medium">Due date:</span> {new Date(book.due_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {(book.status === "borrowed" || book.status === "late") && (
                        <Button
                          variant="outline"
                          onClick={() => handleMarkAsReturned(book.id)}
                        >
                          Mark as Returned
                        </Button>
                      )}
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
                  </div>
                  {bookApprovedRequests.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Approved Requests:</p>
                      {bookApprovedRequests.map((request) => (
                        <div key={request.id} className="flex items-center justify-between p-2 bg-muted rounded">
                          <p className="text-sm">{request.profiles?.full_name}</p>
                          <Button
                            size="sm"
                            onClick={() => handleMarkAsTaken(book.id, request.user_id, request.id)}
                          >
                            Mark as Taken
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Request Queues</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(pendingByBook).length === 0 ? (
            <p className="text-muted-foreground">No pending requests</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(pendingByBook).map(([bookId, bookRequests]) => {
                return (
                  <div key={bookId} className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">
                      {bookRequests[0]?.books?.title} by {bookRequests[0]?.books?.author}
                    </h3>
                    <div className="space-y-2">
                      {bookRequests.map((request) => (
                        <div key={request.id} className="flex items-center justify-between p-3 bg-muted rounded">
                          <div className="flex items-center gap-3">
                            {request.queue_position && (
                              <Badge variant="outline">Queue #{request.queue_position}</Badge>
                            )}
                            <div>
                              <p className="font-medium">{request.profiles?.full_name}</p>
                              <p className="text-xs text-muted-foreground">Pending approval</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRejectRequest(request.id)}
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleApproveRequest(request.id)}
                            >
                              Approve
                            </Button>
                          </div>
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
