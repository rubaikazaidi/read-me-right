import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Book } from "@/types/book";
import { BookCard } from "@/components/BookCard";
import { AddBookDialog } from "@/components/AddBookDialog";
import { EditBookDialog } from "@/components/EditBookDialog";
import { BookDetailsDialog } from "@/components/BookDetailsDialog";
import { LibraryStats } from "@/components/LibraryStats";
import { LibrarianDashboard } from "@/components/LibrarianDashboard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, BookOpen, LogOut } from "lucide-react";

import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const { user, loading: authLoading, userRole, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [books, setBooks] = useState<Book[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [userRequests, setUserRequests] = useState<Record<string, { status: string; queue_position: number | null }>>({});
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [viewingBook, setViewingBook] = useState<Book | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchBooks();
      if (userRole === "student") {
        fetchUserRequests();
      }
    }
  }, [user, userRole]);

  const fetchBooks = async () => {
    try {
      const { data, error } = await supabase
        .from("books")
        .select("*")
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

    setFilteredBooks(filtered);
  }, [searchTerm, statusFilter, books]);

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

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Library Management</h1>
                <p className="text-sm text-muted-foreground capitalize">{userRole}</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <LibraryStats books={books} onFilterChange={setStatusFilter} activeFilter={statusFilter} userRole={userRole || undefined} />

        <div className="mt-8 space-y-6">
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
            {userRole === "librarian" && <AddBookDialog onBookAdded={handleBookAdded} />}
          </div>

          {userRole === "librarian" ? (
            <Tabs defaultValue="books" className="w-full">
              <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="books">Books</TabsTrigger>
                <TabsTrigger value="manage">Manage & Queues</TabsTrigger>
              </TabsList>

              <TabsContent value="books" className="mt-6">
                <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
                  <TabsList className="grid w-full grid-cols-4 max-w-md mb-6">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="available">Available</TabsTrigger>
                    <TabsTrigger value="borrowed">Borrowed</TabsTrigger>
                    <TabsTrigger value="late">Late</TabsTrigger>
                  </TabsList>

                  <TabsContent value={statusFilter}>
                    {filteredBooks.length === 0 ? (
                      <div className="text-center py-12">
                        <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No books found</p>
                      </div>
                    ) : (
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
                    )}
                  </TabsContent>
                </Tabs>
              </TabsContent>

              <TabsContent value="manage" className="mt-6">
                <LibrarianDashboard />
              </TabsContent>
            </Tabs>
          ) : (
            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
              <TabsList className="grid w-full grid-cols-4 max-w-md">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="available">Available</TabsTrigger>
                <TabsTrigger value="borrowed">Borrowed</TabsTrigger>
                <TabsTrigger value="late">Late</TabsTrigger>
              </TabsList>

              <TabsContent value={statusFilter} className="mt-6">
                {filteredBooks.length === 0 ? (
                  <div className="text-center py-12">
                    <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No books found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {filteredBooks.map((book) => (
                      <BookCard
                        key={book.id}
                        book={book}
                        onRequestBook={handleRequestBook}
                        isLibrarian={false}
                        userRequest={userRequests[book.id] || null}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
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
    </div>
  );
};

export default Index;
