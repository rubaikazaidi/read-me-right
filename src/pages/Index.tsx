import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Book } from "@/types/book";
import { BookCard } from "@/components/BookCard";
import { AddBookDialog } from "@/components/AddBookDialog";
import { EditBookDialog } from "@/components/EditBookDialog";
import { BookDetailsDialog } from "@/components/BookDetailsDialog";
import { LibrarySidebar, SidebarToggle } from "@/components/LibrarySidebar";
import { LibrarianDashboard } from "@/components/LibrarianDashboard";
import { FineSettingsDialog, calculateFine } from "@/components/FineSettingsDialog";
import { ExportBooksButton } from "@/components/ExportBooksButton";
import { StudentSearchDialog } from "@/components/StudentSearchDialog";
import { StudentProfileDialog } from "@/components/StudentProfileDialog";
import { BookRecommendations } from "@/components/BookRecommendations";
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

import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const { user, loading: authLoading, userRole, signOut } = useAuth();
  const { organization, organizationId } = useOrganization();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [books, setBooks] = useState<Book[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [loading, setLoading] = useState(true);
  const [userRequests, setUserRequests] = useState<Record<string, { status: string; queue_position: number | null }>>({});
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [viewingBook, setViewingBook] = useState<Book | null>(null);
  const [userName, setUserName] = useState<string>("");
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
        .select("full_name")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      if (data) {
        setUserName(data.full_name);
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
        .select("id, title, author, isbn, status, borrowed_by, borrowed_at, due_date, cover_image_url, category, copy_number, organization_id, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBooks(data as Book[] || []);
      setFilteredBooks(data as Book[] || []);
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

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
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

    setFilteredBooks(filtered);
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
      // Get next queue position
      const { data: queuePos } = await supabase.rpc("get_next_queue_position", {
        book_id_param: bookId,
      });

      // Create request with pending status
      const { error } = await supabase.from("book_requests").insert({
        book_id: bookId,
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
      const { error } = await supabase
        .from("book_requests")
        .delete()
        .eq("book_id", bookId)
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

  return (
    <LibrarySidebar 
      books={books} 
      onFilterChange={setStatusFilter} 
      activeFilter={statusFilter} 
      userRole={userRole || undefined} 
      userId={user?.id}
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
                  <AddBookDialog onBookAdded={handleBookAdded} />
                  <Button 
                    onClick={() => setQrScannerOpen(true)} 
                    size="default"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                  >
                    <ScanLine className="h-4 w-4 mr-2" />
                    Scan Book
                  </Button>
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
                        <div><StudentSearchDialog /></div>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
                        <div><ExportBooksButton /></div>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
                        <div><FineSettingsDialog /></div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )}
          </div>

          {userRole === "librarian" ? (
            <Tabs defaultValue="books" className="w-full">
              <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="books">Books</TabsTrigger>
                <TabsTrigger value="manage">Manage & Queues</TabsTrigger>
              </TabsList>

              <TabsContent value="books" className="mt-6">
                <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
                  <div className="flex items-center justify-between mb-6">
                    <TabsList className="grid w-full grid-cols-4 max-w-md">
                      <TabsTrigger value="all">All</TabsTrigger>
                      <TabsTrigger value="available">Available</TabsTrigger>
                      <TabsTrigger value="borrowed">Borrowed</TabsTrigger>
                      <TabsTrigger value="late">Late</TabsTrigger>
                    </TabsList>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-[180px] ml-4">
                        <ArrowUpDown className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="title-asc">Title: A-Z</SelectItem>
                        <SelectItem value="title-desc">Title: Z-A</SelectItem>
                        <SelectItem value="author">By Author</SelectItem>
                        <SelectItem value="newest">Recently Added</SelectItem>
                        <SelectItem value="oldest">Oldest First</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex border rounded-md ml-2">
                      <Button
                        variant={viewMode === "grid" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-9 px-3 rounded-r-none"
                        onClick={() => setViewMode("grid")}
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={viewMode === "list" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-9 px-3 rounded-l-none"
                        onClick={() => setViewMode("list")}
                      >
                        <List className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <TabsContent value={statusFilter}>
                    {filteredBooks.length === 0 ? (
                      <div className="text-center py-12">
                        <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No books found</p>
                      </div>
                    ) : viewMode === "grid" ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {filteredBooks.map((book) => (
                          <BookCard 
                            key={book.id} 
                            book={book} 
                            isLibrarian={true}
                            onEdit={() => setEditingBook(book)}
                            onViewDetails={() => setViewingBook(book)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {filteredBooks.map((book) => (
                          <BookListItem 
                            key={book.id} 
                            book={book} 
                            isLibrarian={true}
                            onEdit={() => setEditingBook(book)}
                            onViewDetails={() => setViewingBook(book)}
                          />
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </TabsContent>

              <TabsContent value="manage" className="mt-6">
                <LibrarianDashboard />
              </TabsContent>
            </Tabs>
          ) : (
            <>
              {/* Book Recommendations Section for Students */}
              <BookRecommendations
                userId={user.id}
                allBooks={books}
                onRequestBook={handleRequestBook}
                userRequests={userRequests}
              />

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

              <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
                <div className="flex items-center justify-between mb-6">
                  <TabsList className="grid w-full grid-cols-4 max-w-md">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="available">Available</TabsTrigger>
                    <TabsTrigger value="borrowed">Borrowed</TabsTrigger>
                    <TabsTrigger value="late">Late</TabsTrigger>
                  </TabsList>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[180px] ml-4">
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="title-asc">Title: A-Z</SelectItem>
                      <SelectItem value="title-desc">Title: Z-A</SelectItem>
                      <SelectItem value="author">By Author</SelectItem>
                      <SelectItem value="newest">Recently Added</SelectItem>
                      <SelectItem value="oldest">Oldest First</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex border rounded-md ml-2">
                    <Button
                      variant={viewMode === "grid" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-9 px-3 rounded-r-none"
                      onClick={() => setViewMode("grid")}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-9 px-3 rounded-l-none"
                      onClick={() => setViewMode("list")}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <TabsContent value={statusFilter} className="mt-6">
                  {filteredBooks.length === 0 ? (
                    <div className="text-center py-12">
                      <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No books found</p>
                    </div>
                  ) : viewMode === "grid" ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                      {filteredBooks.map((book) => {
                        const isBorrowedByMe = book.borrowed_by === user?.id && (book.status === "borrowed" || book.status === "late");
                        return (
                          <BookCard
                            key={book.id}
                            book={book}
                            onRequestBook={isBorrowedByMe ? undefined : handleRequestBook}
                            onLeaveQueue={handleLeaveQueue}
                            isLibrarian={false}
                            userRequest={isBorrowedByMe ? { status: "approved", queue_position: null } : (userRequests[book.id] || null)}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {filteredBooks.map((book) => {
                        const isBorrowedByMe = book.borrowed_by === user?.id && (book.status === "borrowed" || book.status === "late");
                        return (
                          <BookListItem
                            key={book.id}
                            book={book}
                            onRequestBook={isBorrowedByMe ? undefined : handleRequestBook}
                            onLeaveQueue={handleLeaveQueue}
                            isLibrarian={false}
                            userRequest={isBorrowedByMe ? { status: "approved", queue_position: null } : (userRequests[book.id] || null)}
                          />
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
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
