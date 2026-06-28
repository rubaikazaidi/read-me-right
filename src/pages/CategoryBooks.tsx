import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Book, GroupedBook, groupBooksByIsbn } from "@/types/book";
import { BookCard } from "@/components/BookCard";
import { BookListItem } from "@/components/BookListItem";
import { EditBookDialog } from "@/components/EditBookDialog";
import { BookDetailsDialog } from "@/components/BookDetailsDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, BookOpen, ArrowLeft, ArrowUpDown, LayoutGrid, List } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isAgeAppropriate } from "@/lib/ageRating";

const CategoryBooks = () => {
  const { categoryName } = useParams<{ categoryName: string }>();
  const decodedCategory = decodeURIComponent(categoryName || "");
  const navigate = useNavigate();
  const { user, loading: authLoading, userRole } = useAuth();
  const { organizationId } = useOrganization();
  const { toast } = useToast();

  const [books, setBooks] = useState<Book[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<GroupedBook[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [loading, setLoading] = useState(true);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [viewingBook, setViewingBook] = useState<Book | null>(null);
  const [userRequests, setUserRequests] = useState<Record<string, { status: string; queue_position: number | null }>>({});
  const [studentAge, setStudentAge] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchBooks();
      if (userRole === "student") {
        fetchUserRequests();
        fetchStudentAge();
      }
    }
  }, [user, userRole]);

  const fetchStudentAge = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("age")
      .eq("id", user.id)
      .single();
    setStudentAge(data?.age ?? null);
  };

  const fetchBooks = async () => {
    try {
      const { data, error } = await supabase
        .from("books")
        .select("id, title, author, isbn, status, borrowed_by, borrowed_at, due_date, cover_image_url, category, copy_number, organization_id, created_at, age_rating, dewey_decimal, summary, back_cover_image_url, classification_number, vendor_bill, price, page_count, publisher, is_damaged, damage_notes")
        .ilike("category", decodedCategory)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBooks((data as Book[]) || []);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch books" });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserRequests = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("book_requests")
      .select("book_id, status, queue_position")
      .eq("user_id", user.id);

    const map = (data || []).reduce((acc, req) => {
      acc[req.book_id] = { status: req.status, queue_position: req.queue_position };
      return acc;
    }, {} as Record<string, { status: string; queue_position: number | null }>);
    setUserRequests(map);
  };

  useEffect(() => {
    let filtered = books;
    if (searchTerm) {
      filtered = filtered.filter(
        (b) =>
          b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.isbn.includes(searchTerm)
      );
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter((b) => b.status === statusFilter);
    }
    if (userRole === "student") {
      filtered = filtered.filter(
        (b) =>
          isAgeAppropriate(studentAge, b.age_rating) ||
          (user && b.borrowed_by === user.id)
      );
    }
    let grouped = groupBooksByIsbn(filtered);
    grouped = [...grouped].sort((a, b) => {
      switch (sortBy) {
        case "title-asc": return a.title.localeCompare(b.title);
        case "title-desc": return b.title.localeCompare(a.title);
        case "author": return a.author.localeCompare(b.author);
        case "newest": return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        case "oldest": return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        default: return 0;
      }
    });
    setFilteredBooks(grouped);
  }, [searchTerm, statusFilter, books, sortBy, userRole, studentAge, user]);

  const handleRequestBook = async (bookId: string) => {
    if (!user) return;
    try {
      const groupedBook = filteredBooks.find((b) => b.id === bookId) as GroupedBook | undefined;
      let targetBookId = bookId;
      if (groupedBook?.allCopyIds && groupedBook.allCopyIds.length > 1) {
        const availableCopy = books.find(
          (b) => groupedBook.allCopyIds.includes(b.id) && b.status === "available" && !userRequests[b.id]
        );
        if (availableCopy) targetBookId = availableCopy.id;
        else {
          const any = books.find((b) => groupedBook.allCopyIds.includes(b.id) && !userRequests[b.id]);
          if (any) targetBookId = any.id;
        }
      }
      const { data: queuePos } = await supabase.rpc("get_next_queue_position", { book_id_param: targetBookId });
      const { error } = await supabase.from("book_requests").insert({
        book_id: targetBookId,
        user_id: user.id,
        status: "pending",
        queue_position: queuePos || 1,
        organization_id: organizationId,
      });
      if (error) throw error;
      toast({ title: "Request Submitted", description: `Queue position ${queuePos || 1}.` });
      fetchBooks();
      fetchUserRequests();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const handleLeaveQueue = async (bookId: string) => {
    if (!user) return;
    try {
      const groupedBook = filteredBooks.find((b) => b.id === bookId) as GroupedBook | undefined;
      const copyIds = groupedBook?.allCopyIds || [bookId];
      const targetCopyId = copyIds.find((id) => userRequests[id]?.status === "pending") || bookId;
      const { error } = await supabase
        .from("book_requests")
        .delete()
        .eq("book_id", targetCopyId)
        .eq("user_id", user.id)
        .eq("status", "pending");
      if (error) throw error;
      toast({ title: "Left Queue", description: "You have been removed from the queue." });
      fetchUserRequests();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const handleBookUpdated = () => {
    fetchBooks();
    setEditingBook(null);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="p-2 bg-primary/10 rounded-lg">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{decodedCategory}</h1>
              <p className="text-sm text-muted-foreground">
                {books.length} {books.length === 1 ? "book" : "books"} in this category
              </p>
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
          </div>

          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
            <div className="flex items-center gap-2 mb-6 flex-wrap">
              <TabsList className="grid grid-cols-4 max-w-md">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="available">Available</TabsTrigger>
                <TabsTrigger value="borrowed">Borrowed</TabsTrigger>
                <TabsTrigger value="late">Late</TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2 ml-auto">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[180px]">
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

                <div className="flex border rounded-md">
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
            </div>

            <TabsContent value={statusFilter}>
              {filteredBooks.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No books found in this category</p>
                </div>
              ) : viewMode === "grid" ? (
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
              ) : (
                <div className="flex flex-col gap-2">
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
                      <BookListItem
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
            </TabsContent>
          </Tabs>
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

export default CategoryBooks;
