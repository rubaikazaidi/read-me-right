import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Book, GroupedBook, groupBooksByIsbn } from "@/types/book";
import { BookCard } from "@/components/BookCard";
import { AddBookDialog } from "@/components/AddBookDialog";
import { EditBookDialog } from "@/components/EditBookDialog";
import { BookDetailsDialog } from "@/components/BookDetailsDialog";
import { LibrarySidebar, SidebarToggle } from "@/components/LibrarySidebar";
import { LibrarianDashboard } from "@/components/LibrarianDashboard";
import { FineSettingsDialog, calculateFine } from "@/components/FineSettingsDialog";
import { ManageCategoriesDialog } from "@/components/ManageCategoriesDialog";
import { ExportBooksButton } from "@/components/ExportBooksButton";
import { StudentSearchDialog } from "@/components/StudentSearchDialog";
import { StudentProfileDialog } from "@/components/StudentProfileDialog";
import { BookRecommendations } from "@/components/BookRecommendations";
import { CategoryTiles } from "@/components/CategoryTiles";
import { QRCodeScanner, ScanResult, ScanType } from "@/components/QRCodeScanner";
import { ScanIssueBookDialog } from "@/components/ScanIssueBookDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, BookOpen, LogOut, ArrowUpDown, Clock, Calendar, IndianRupee, LayoutGrid, List, ScanLine, Plus, ChevronDown, Settings2 } from "lucide-react";
import { BookListItem } from "@/components/BookListItem";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { isAgeAppropriate } from "@/lib/ageRating";

import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const { user, loading: authLoading, userRole, signOut } = useAuth();
  const { organization, organizationId } = useOrganization();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rawBooks, setRawBooks] = useState<Book[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<GroupedBook[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [loading, setLoading] = useState(true);
  const [userRequests, setUserRequests] = useState<Record<string, { status: string; queue_position: number | null }>>({});
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [viewingBook, setViewingBook] = useState<Book | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [studentAge, setStudentAge] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  // QR Scanner states
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [scanIssueDialogOpen, setScanIssueDialogOpen] = useState(false);
  const [scannedValue, setScannedValue] = useState<string>("");
  const [scannedType, setScannedType] = useState<ScanType>("qr");
  const [addBookDialogOpen, setAddBookDialogOpen] = useState(false);
  const [scannedIsbnForAdd, setScannedIsbnForAdd] = useState<string>("");
  

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchBooks();
      fetchUserProfile();
      if (userRole === "student") {
        fetchUserRequests();
      }
    }
  }, [user, userRole]);

  const fetchUserProfile = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, age")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      if (data) {
        setUserName(data.full_name);
        setStudentAge(data.age ?? null);
      }
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
    }
  };

  const fetchBooks = async () => {
    try {
      // Fetch only essential columns for the list view - improves performance
      const { data, error } = await supabase
        .from("books")
        .select("id, title, author, isbn, status, borrowed_by, borrowed_at, due_date, cover_image_url, category, copy_number, organization_id, created_at, age_rating, dewey_decimal, summary, back_cover_image_url, classification_number, vendor_bill, price, page_count, publisher, is_damaged, damage_notes")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRawBooks((data as Book[]) || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch books",
      });
    } finally {
      setLoading(false);
    }
  };

  // Apply age-rating restriction for students: hide books above their age.
  // Books the student has already borrowed remain visible.
  useEffect(() => {
    if (userRole === "student") {
      const visible = rawBooks.filter(
        (b) =>
          isAgeAppropriate(studentAge, b.age_rating) ||
          (user && b.borrowed_by === user.id)
      );
      setBooks(visible);
    } else {
      setBooks(rawBooks);
    }
  }, [rawBooks, studentAge, userRole, user]);

  const fetchUserRequests = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("book_requests")
        .select("book_id, status, queue_position")
        .eq("user_id", user.id);

      if (error) throw error;

      const requestsMap = (data || []).reduce((acc, req) => {
        acc[req.book_id] = { status: req.status, queue_position: req.queue_position };
        return acc;
      }, {} as Record<string, { status: string; queue_position: number | null }>);

      setUserRequests(requestsMap);
    } catch (error: any) {
      console.error("Failed to fetch user requests:", error);
    }
  };

  useEffect(() => {
    let filtered = books;

    if (searchTerm) {
      filtered = filtered.filter(
        (book) =>
          book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
          book.isbn.includes(searchTerm)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((book) => book.status === statusFilter);
    }

    // Group by ISBN first, then sort
    let grouped = groupBooksByIsbn(filtered);

    // Apply sorting
    grouped = [...grouped].sort((a, b) => {
      switch (sortBy) {
        case "title-asc":
          return a.title.localeCompare(b.title);
        case "title-desc":
          return b.title.localeCompare(a.title);
        case "author":
          return a.author.localeCompare(b.author);
        case "newest":
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        case "oldest":
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        default:
          return 0;
      }
    });

    setFilteredBooks(grouped);
  }, [searchTerm, statusFilter, books, sortBy]);

  const handleBookAdded = () => {
    fetchBooks();
  };

  const handleBookUpdated = () => {
    fetchBooks();
    setEditingBook(null);
  };

  const handleRequestBook = async (bookId: string) => {
    if (!user) return;

    try {
      // If this is a grouped book, find an available copy to request
      const groupedBook = filteredBooks.find(b => b.id === bookId) as GroupedBook | undefined;
      let targetBookId = bookId;
      
      if (groupedBook?.allCopyIds && groupedBook.allCopyIds.length > 1) {
        // Find an available copy that the user hasn't already requested
        const availableCopy = books.find(
          b => groupedBook.allCopyIds.includes(b.id) && b.status === "available" && !userRequests[b.id]
        );
        if (availableCopy) {
          targetBookId = availableCopy.id;
        } else {
          // No available copy, find any copy the user hasn't requested yet
          const anyUnrequested = books.find(
            b => groupedBook.allCopyIds.includes(b.id) && !userRequests[b.id]
          );
          if (anyUnrequested) {
            targetBookId = anyUnrequested.id;
          }
        }
      }

      // Get next queue position
      const { data: queuePos } = await supabase.rpc("get_next_queue_position", {
        book_id_param: targetBookId,
      });

      // Create request with pending status
      const { error } = await supabase.from("book_requests").insert({
        book_id: targetBookId,
        user_id: user.id,
        status: "pending",
        queue_position: queuePos || 1,
        organization_id: organizationId,
      });

      if (error) throw error;

      toast({
        title: "Request Submitted",
        description: `You are in queue position ${queuePos || 1}. Waiting for librarian approval.`,
      });

      fetchBooks();
      fetchUserRequests();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleLeaveQueue = async (bookId: string) => {
    if (!user) return;

    try {
      // For grouped books, find the actual copy the user has a request for
      const groupedBook = filteredBooks.find(b => b.id === bookId) as GroupedBook | undefined;
      const copyIds = groupedBook?.allCopyIds || [bookId];
      
      // Find which copy has the user's pending request
      const targetCopyId = copyIds.find(id => userRequests[id]?.status === "pending") || bookId;

      const { error } = await supabase
        .from("book_requests")
        .delete()
        .eq("book_id", targetCopyId)
        .eq("user_id", user.id)
        .eq("status", "pending");

      if (error) throw error;

      toast({
        title: "Left Queue",
        description: "You have been removed from the queue.",
      });

      fetchUserRequests();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  // Handle QR code or barcode scan result
  const handleScanResult = (result: ScanResult) => {
    setScannedType(result.type);
    setScannedValue(result.value);
    setScanIssueDialogOpen(true);
  };

  // Handle adding a book with scanned ISBN
  const handleAddBookFromScan = (isbn: string) => {
    setScannedIsbnForAdd(isbn);
    setAddBookDialogOpen(true);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Student signed up but is not yet a member of any organization
  if (userRole === "student" && !organizationId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background/95 to-primary/5 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Clock className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Awaiting Librarian Approval</h2>
            <p className="text-sm text-muted-foreground">
              Your request to join the organization has been sent. You'll be able to access the library once a librarian approves your request.
            </p>
            <Button variant="outline" onClick={handleSignOut} className="mt-2">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <LibrarySidebar 
      books={books} 
      onFilterChange={setStatusFilter} 
      activeFilter={statusFilter} 
      userRole={userRole || undefined} 
      userId={user?.id}
      onRequestBook={handleRequestBook}
      userRequests={userRequests}
    >
      <div className="flex-1 bg-gradient-to-br from-background via-background/95 to-primary/5">
        <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SidebarToggle />
                <div className="p-2 bg-primary/10 rounded-lg">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    {organization?.name ? `${organization.name} Library` : "Library Management"}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {userRole === "student" ? `Student: ${userName}` : `Librarian: ${userName}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {userRole === "student" && user && (
                  <StudentProfileDialog userId={user.id} />
                )}
                <Button variant="outline" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="Search by title, author, or ISBN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {userRole === "librarian" && (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button onClick={() => setAddBookDialogOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md">
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Book
                  </Button>
                  <Button 
                    onClick={() => setQrScannerOpen(true)} 
                    size="default"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                  >
                    <ScanLine className="h-4 w-4 mr-2" />
                    Scan Book
                  </Button>
                </div>
              </div>
            )}
          </div>

          {searchTerm.trim() || statusFilter !== "all" ? (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">
                  Search results for "{searchTerm}"
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({filteredBooks.length} {filteredBooks.length === 1 ? "result" : "results"})
                  </span>
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setSearchTerm("")}>
                  Clear
                </Button>
              </div>
              {filteredBooks.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No books found matching "{searchTerm}"</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {filteredBooks.map((book) => {
                    const grouped = book as GroupedBook;
                    const isLibrarian = userRole === "librarian";
                    const isBorrowedByMe = !isLibrarian && grouped.allCopyIds?.some(
                      (copyId) => books.find((b) => b.id === copyId)?.borrowed_by === user?.id
                    );
                    const userRequest = !isLibrarian
                      ? grouped.allCopyIds?.reduce<{ status: string; queue_position: number | null } | null>(
                          (found, copyId) => found || userRequests[copyId] || null,
                          null
                        )
                      : null;
                    return (
                      <BookCard
                        key={book.id}
                        book={book}
                        isLibrarian={isLibrarian}
                        onRequestBook={isLibrarian || isBorrowedByMe ? undefined : handleRequestBook}
                        onLeaveQueue={isLibrarian ? undefined : handleLeaveQueue}
                        onEdit={isLibrarian ? () => setEditingBook(book) : undefined}
                        onViewDetails={isLibrarian ? () => setViewingBook(book) : undefined}
                        userRequest={isBorrowedByMe ? { status: "approved", queue_position: null } : userRequest}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ) : userRole === "librarian" ? (
            <Tabs defaultValue="books" className="w-full">

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <TabsList className="grid w-full sm:w-auto grid-cols-2 max-w-md">
                  <TabsTrigger value="books">Books</TabsTrigger>
                  <TabsTrigger value="manage">Manage & Queues</TabsTrigger>
                </TabsList>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="default">
                      <Settings2 className="h-4 w-4 mr-1" />
                      Tools
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover z-50">
                    <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
                      <div>
                        <StudentSearchDialog />
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
                      <div>
                        <ExportBooksButton />
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
                      <div>
                        <FineSettingsDialog />
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
                      <div>
                        <ManageCategoriesDialog />
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <TabsContent value="books" className="mt-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">Browse by Category</h2>
                <CategoryTiles books={books} />
              </TabsContent>

              <TabsContent value="manage" className="mt-6">
                <LibrarianDashboard />
              </TabsContent>
            </Tabs>
          ) : (
            <>
              {/* My Borrowed Books Section for Students */}
              {(() => {
                const myBorrowedBooks = books.filter(
                  (book) => book.borrowed_by === user?.id && (book.status === "borrowed" || book.status === "late")
                );
                if (myBorrowedBooks.length === 0) return null;
                return (
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      My Borrowed Books
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {myBorrowedBooks.map((book) => (
                        <Card key={book.id} className={`overflow-hidden ${book.status === "late" ? "border-destructive" : ""}`}>
                          <CardContent className="p-4 flex gap-4">
                            {book.cover_image_url ? (
                              <img
                                src={book.cover_image_url}
                                alt={book.title}
                                className="w-16 h-24 object-cover rounded"
                              />
                            ) : (
                              <div className="w-16 h-24 bg-muted rounded flex items-center justify-center">
                                <BookOpen className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold truncate">{book.title}</h3>
                              <p className="text-sm text-muted-foreground truncate">{book.author}</p>
                              {book.due_date && (
                                <div className={`mt-2 flex items-center gap-1 text-sm ${book.status === "late" ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                                  <Calendar className="h-4 w-4" />
                                  <span>
                                    {book.status === "late" ? "Overdue: " : "Due: "}
                                    {format(new Date(book.due_date), "MMM d, yyyy")}
                                  </span>
                                </div>
                              )}
                              {book.status === "late" && book.due_date && (
                                <div className="mt-1 flex items-center gap-1 text-sm text-destructive font-semibold">
                                  <IndianRupee className="h-4 w-4" />
                                  <span>Fine: ₹{calculateFine(book.due_date).toFixed(2)}</span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <h2 className="text-lg font-semibold text-foreground mb-4">Browse by Category</h2>
              <CategoryTiles books={books} />
            </>
          )}


          </div>
        </main>

        {editingBook && (
          <EditBookDialog
            book={editingBook}
            open={!!editingBook}
            onOpenChange={(open) => !open && setEditingBook(null)}
            onBookUpdated={handleBookUpdated}
          />
        )}

        <BookDetailsDialog
          book={viewingBook}
          open={!!viewingBook}
          onOpenChange={(open) => !open && setViewingBook(null)}
        />

        {/* QR Scanner and Issue Book dialogs */}
        <QRCodeScanner
          open={qrScannerOpen}
          onOpenChange={setQrScannerOpen}
          onScan={handleScanResult}
        />

        <ScanIssueBookDialog
          open={scanIssueDialogOpen}
          onOpenChange={setScanIssueDialogOpen}
          scanValue={scannedValue}
          scanType={scannedType}
          onIssued={() => {
            fetchBooks();
            setScanIssueDialogOpen(false);
          }}
          onAddBook={handleAddBookFromScan}
        />

        <AddBookDialog
          onBookAdded={() => {
            handleBookAdded();
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
      </div>
    </LibrarySidebar>
  );
};

export default Index;
