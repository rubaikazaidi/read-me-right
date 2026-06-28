import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/hooks/useOrganization";
import { Book, BookStatus } from "@/types/book";
import { Badge } from "@/components/ui/badge";
import { AssignBookDialog } from "./AssignBookDialog";
import { calculateFine } from "./FineSettingsDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronRight, ScanLine, QrCode, Barcode } from "lucide-react";
import { QRCodeScanner, ScanResult, ScanType } from "./QRCodeScanner";
import { BookQRCode } from "./BookQRCode";
import { ScanIssueBookDialog } from "./ScanIssueBookDialog";
import { AddBookDialog } from "./AddBookDialog";
import { ReturnBookDialog } from "./ReturnBookDialog";

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

interface BookWithBorrower extends Book {
  borrower_name?: string;
}

export function LibrarianDashboard() {
  const [requests, setRequests] = useState<BookRequest[]>([]);
  const [books, setBooks] = useState<BookWithBorrower[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [bookToAssign, setBookToAssign] = useState<BookWithBorrower | null>(null);
  const [bookSortBy, setBookSortBy] = useState<string>("title-asc");
  const [statusManagementOpen, setStatusManagementOpen] = useState(true);
  const [requestQueuesOpen, setRequestQueuesOpen] = useState(true);
  // QR Code states
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [scanIssueDialogOpen, setScanIssueDialogOpen] = useState(false);
  const [scannedValue, setScannedValue] = useState<string>("");
  const [scannedType, setScannedType] = useState<ScanType>("qr");
  const [qrCodeDialogOpen, setQrCodeDialogOpen] = useState(false);
  const [selectedBookForQR, setSelectedBookForQR] = useState<BookWithBorrower | null>(null);
  // Add book dialog states
  const [addBookDialogOpen, setAddBookDialogOpen] = useState(false);
  const [scannedIsbnForAdd, setScannedIsbnForAdd] = useState<string>("");
  const { toast } = useToast();
  const { organizationId } = useOrganization();

  // Handle adding a book with scanned ISBN
  const handleAddBookFromScan = (isbn: string) => {
    setScannedIsbnForAdd(isbn);
    setAddBookDialogOpen(true);
  };

  // Handle QR code or barcode scan result
  const handleScanResult = (result: ScanResult) => {
    setScannedType(result.type);
    setScannedValue(result.value);
    setScanIssueDialogOpen(true);
  };

  // Open QR code dialog for a specific book
  const handleShowQRCode = (book: BookWithBorrower) => {
    setSelectedBookForQR(book);
    setQrCodeDialogOpen(true);
  };

  // Sort books based on selected criteria
  const sortedBooks = [...books].sort((a, b) => {
    switch (bookSortBy) {
      case "title-asc":
        return a.title.localeCompare(b.title);
      case "title-desc":
        return b.title.localeCompare(a.title);
      case "author":
        return a.author.localeCompare(b.author);
      case "date-new":
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      case "date-old":
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      case "status-late":
        const statusOrderLate: Record<string, number> = { late: 0, borrowed: 1, available: 2 };
        return (statusOrderLate[a.status] ?? 2) - (statusOrderLate[b.status] ?? 2);
      case "status-available":
        const statusOrderAvail: Record<string, number> = { available: 0, borrowed: 1, late: 2 };
        return (statusOrderAvail[a.status] ?? 2) - (statusOrderAvail[b.status] ?? 2);
      default:
        return 0;
    }
  });

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
      // Fetch books without the join that was causing the error
      const { data: booksData, error: booksError } = await supabase
        .from("books")
        .select("*")
        .order("title");

      if (booksError) throw booksError;

      const now = new Date();
      
      // Check for overdue books and update their status to "late"
      const overdueBooks = (booksData || []).filter(book => 
        book.status === "borrowed" && 
        book.due_date && 
        new Date(book.due_date) < now
      );

      // Update overdue books to "late" status
      for (const book of overdueBooks) {
        await supabase
          .from("books")
          .update({ status: "late" })
          .eq("id", book.id);
      }

      // Get borrower names for borrowed books
      const borrowedByIds = (booksData || [])
        .filter(book => book.borrowed_by)
        .map(book => book.borrowed_by);

      let borrowerMap: Record<string, string> = {};
      
      if (borrowedByIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", borrowedByIds);

        if (profilesData) {
          borrowerMap = profilesData.reduce((acc, profile) => {
            acc[profile.id] = profile.full_name;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Combine books with borrower names, updating status for overdue books
      const booksWithBorrowers: BookWithBorrower[] = (booksData || []).map(book => {
        const isOverdue = book.status === "borrowed" && book.due_date && new Date(book.due_date) < now;
        return {
          ...book,
          status: isOverdue ? "late" as BookStatus : book.status as BookStatus,
          borrower_name: book.borrowed_by ? borrowerMap[book.borrowed_by] : undefined
        };
      });

      setBooks(booksWithBorrowers);
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
      // Get the request details first
      const request = requests.find(r => r.id === requestId);
      if (!request) throw new Error("Request not found");

      // Check if there's already an approved request for this book
      const existingApproved = requests.find(
        r => r.book_id === request.book_id && r.status === "approved" && r.id !== requestId
      );
      if (existingApproved) {
        toast({
          variant: "destructive",
          title: "Cannot approve",
          description: `This book already has an approved pickup pending for ${existingApproved.profiles?.full_name}. Only one approved request per book is allowed.`,
        });
        return;
      }

      // Check if the book is currently available
      const book = books.find(b => b.id === request.book_id);

      // Just approve (reserve) the request — don't auto-assign the book
      const { error } = await supabase
        .from("book_requests")
        .update({ status: "approved" })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Request approved for ${request.profiles?.full_name} — book is reserved until scanned or manually marked as taken`,
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
      // First, get the book details to record in history
      const bookToReturn = books.find(b => b.id === bookId);
      if (!bookToReturn || !bookToReturn.borrowed_by) {
        throw new Error("Book not found or not borrowed");
      }

      const now = new Date();
      const wasLate = bookToReturn.status === "late";
      let daysLate = 0;
      let fineAmount = 0;

      if (wasLate && bookToReturn.due_date) {
        const dueDate = new Date(bookToReturn.due_date);
        daysLate = Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        fineAmount = calculateFine(bookToReturn.due_date);
      }

      // Record the borrowing history
      const { error: historyError } = await supabase
        .from("borrowing_history")
        .insert({
          book_id: bookId,
          user_id: bookToReturn.borrowed_by,
          book_title: bookToReturn.title,
          book_author: bookToReturn.author,
          borrowed_at: bookToReturn.borrowed_at,
          returned_at: now.toISOString(),
          was_late: wasLate,
          days_late: daysLate,
          fine_amount: fineAmount,
          organization_id: organizationId,
        });

      if (historyError) {
        console.error("Failed to record history:", historyError);
        // Continue with the return even if history fails
      }

      // Update the book status
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

  const handleUpdateBookStatus = async (bookId: string, newStatus: string, book?: BookWithBorrower) => {
    // If changing to borrowed, open the assign dialog
    if (newStatus === "borrowed" && book && book.status !== "borrowed") {
      setBookToAssign(book);
      setAssignDialogOpen(true);
      return;
    }

    try {
      const updates: any = { status: newStatus };
      
      if (newStatus === "available") {
        updates.borrowed_by = null;
        updates.borrowed_at = null;
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

  const handleAssignComplete = () => {
    fetchBooks();
    fetchRequests();
    setBookToAssign(null);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "available":
        return "default";
      case "borrowed":
        return "secondary";
      case "late":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusBackgroundClass = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800";
      case "borrowed":
        return "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800";
      case "late":
        return "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800";
      default:
        return "";
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

  // Get books with approved requests (pending pickup) - only show if the book is actually available
  const booksWithApprovedRequests = sortedBooks.filter(book => approvedByBook[book.id]?.length > 0 && book.status === "available");

  if (loading) {
    return <div>Loading...</div>;
  }

  const renderBookItem = (book: BookWithBorrower, showApprovedRequests: boolean = true) => {
    const bookApprovedRequests = approvedByBook[book.id] || [];
    return (
      <div key={book.id} className={`border rounded-lg p-4 ${getStatusBackgroundClass(book.status)}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <p className="font-semibold">{book.title}</p>
              <Badge variant={getStatusBadgeVariant(book.status)}>
                {book.status === "available" ? "Available" : book.status === "borrowed" ? "Borrowed" : "Late"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">by {book.author}</p>
            <p className="text-xs text-muted-foreground">ISBN: {book.isbn} • Category: {book.category}</p>
            
            {/* Show borrower details for borrowed books */}
            {(book.status === "borrowed" || book.status === "late") && book.borrowed_by && (
              <div className="mt-3 p-3 bg-muted/50 rounded-md space-y-1">
                <p className="text-sm">
                  <span className="font-medium">Borrowed by:</span> {book.borrower_name || "Unknown"}
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
                {book.status === "late" && book.due_date && (
                  <p className="text-sm text-destructive font-semibold">
                    <span className="font-medium">Late Fine:</span> ₹{calculateFine(book.due_date).toFixed(2)}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleShowQRCode(book)}
              title="Show QR Code"
            >
              <QrCode className="h-4 w-4" />
            </Button>
            {(book.status === "borrowed" || book.status === "late") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMarkAsReturned(book.id)}
              >
                Mark as Returned
              </Button>
            )}
            <Select value={book.status} onValueChange={(value) => handleUpdateBookStatus(book.id, value, book)}>
              <SelectTrigger className="w-[140px]">
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
      {showApprovedRequests && bookApprovedRequests.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Approved Requests:</p>
            {bookApprovedRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-2 bg-muted rounded">
                <p className="text-sm">{request.profiles?.full_name}</p>
                {book.status === "available" ? (
                  <Button
                    size="sm"
                    onClick={() => handleMarkAsTaken(book.id, request.user_id, request.id)}
                  >
                    Mark as Taken
                  </Button>
                ) : (
                  <Badge variant="secondary">Waiting for return</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* QR Scanner Button */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ScanLine className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Quick Issue Book</h3>
                <p className="text-sm text-muted-foreground">Scan a book's QR code to quickly issue it to a student</p>
              </div>
            </div>
            <Button onClick={() => setQrScannerOpen(true)} size="lg">
              <ScanLine className="h-4 w-4 mr-2" />
              Scan QR Code
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Book Status Management - Collapsible */}
      <Collapsible open={statusManagementOpen} onOpenChange={setStatusManagementOpen}>
        <Card>
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  {statusManagementOpen ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                  <CardTitle>Book Status Management</CardTitle>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <Select value={bookSortBy} onValueChange={setBookSortBy}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Sort by..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="title-asc">Title: A-Z</SelectItem>
                      <SelectItem value="title-desc">Title: Z-A</SelectItem>
                      <SelectItem value="author">By Author</SelectItem>
                      <SelectItem value="date-new">Recently Added</SelectItem>
                      <SelectItem value="date-old">Oldest First</SelectItem>
                      <SelectItem value="status-late">Status: Late First</SelectItem>
                      <SelectItem value="status-available">Status: Available First</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="all">All Books ({books.length})</TabsTrigger>
                  <TabsTrigger value="pending-pickup">
                    Pending Pickup ({booksWithApprovedRequests.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="all">
                  {books.length === 0 ? (
                    <p className="text-muted-foreground">No books in the library</p>
                  ) : (
                    <div className="space-y-4">
                      {sortedBooks.map((book) => renderBookItem(book, true))}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="pending-pickup">
                  {booksWithApprovedRequests.length === 0 ? (
                    <p className="text-muted-foreground">No books pending pickup</p>
                  ) : (
                    <div className="space-y-4">
                      {booksWithApprovedRequests.map((book) => {
                        const bookApprovedRequests = approvedByBook[book.id] || [];
                        return (
                          <div key={book.id} className="border rounded-lg p-4 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <p className="font-semibold">{book.title}</p>
                                  <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                                    Pending Pickup
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">by {book.author}</p>
                                <p className="text-xs text-muted-foreground">ISBN: {book.isbn} • Category: {book.category}</p>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Students to Pick Up:</p>
                              {bookApprovedRequests.map((request) => (
                                <div key={request.id} className="flex items-center justify-between p-3 bg-background rounded border">
                                  <div>
                                    <p className="font-medium">{request.profiles?.full_name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      Approved on {new Date(request.requested_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => handleMarkAsTaken(book.id, request.user_id, request.id)}
                                  >
                                    Mark as Taken
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Request Queues - Collapsible */}
      <Collapsible open={requestQueuesOpen} onOpenChange={setRequestQueuesOpen}>
        <Card>
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <div className="flex items-center gap-2 cursor-pointer">
                {requestQueuesOpen ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
                <CardTitle>Request Queues ({Object.keys(pendingByBook).length} pending)</CardTitle>
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
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
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {bookToAssign && (
        <AssignBookDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          bookId={bookToAssign.id}
          bookTitle={bookToAssign.title}
          onAssigned={handleAssignComplete}
        />
      )}

      {/* QR Code / Barcode Scanner Dialog */}
      <QRCodeScanner
        open={qrScannerOpen}
        onOpenChange={setQrScannerOpen}
        onScan={handleScanResult}
        title="Scan Book Code"
        description="Point your camera at a QR code or ISBN barcode on the book."
      />

      {/* Scan Issue Book Dialog */}
      <ScanIssueBookDialog
        open={scanIssueDialogOpen}
        onOpenChange={setScanIssueDialogOpen}
        scanType={scannedType}
        scanValue={scannedValue}
        onIssued={() => {
          fetchBooks();
          fetchRequests();
        }}
        onAddBook={handleAddBookFromScan}
      />

      {/* Add Book Dialog (from scan) */}
      <AddBookDialog
        onBookAdded={() => {
          fetchBooks();
          setAddBookDialogOpen(false);
          setScannedIsbnForAdd("");
        }}
        initialIsbn={scannedIsbnForAdd}
        externalOpen={addBookDialogOpen}
        onExternalOpenChange={(open) => {
          setAddBookDialogOpen(open);
          if (!open) setScannedIsbnForAdd("");
        }}
      />

      {/* Book QR Code Dialog */}
      {selectedBookForQR && (
        <BookQRCode
          open={qrCodeDialogOpen}
          onOpenChange={setQrCodeDialogOpen}
          bookId={selectedBookForQR.id}
          bookTitle={selectedBookForQR.title}
          bookAuthor={selectedBookForQR.author}
        />
      )}
    </div>
  );
}
