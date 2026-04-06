import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Book } from "@/types/book";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookOpen, Sparkles, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface BookRecommendationsProps {
  userId: string;
  allBooks: Book[];
  onRequestBook?: (bookId: string) => void;
  userRequests: Record<string, { status: string; queue_position: number | null }>;
  compact?: boolean;
}

interface CategoryCount {
  category: string;
  count: number;
}

export const BookRecommendations = ({ 
  userId, 
  allBooks, 
  onRequestBook,
  userRequests,
  compact = false
}: BookRecommendationsProps) => {
  const [recommendations, setRecommendations] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [shownBookIds, setShownBookIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (userId && allBooks.length > 0) {
      generateRecommendations();
    }
  }, [userId, allBooks]);

  const getPreferredPatterns = async () => {
    // Get user's currently borrowed books
    const currentlyBorrowed = allBooks.filter(
      book => book.borrowed_by === userId && (book.status === "borrowed" || book.status === "late")
    );

    // Get user's borrowing history with book details
    const { data: history, error } = await supabase
      .from("borrowing_history")
      .select("book_id, book_author")
      .eq("user_id", userId);

    if (error) throw error;

    const borrowedBookIds = new Set([
      ...currentlyBorrowed.map(b => b.id),
      ...(history || []).map(h => h.book_id)
    ]);

    // Count categories and authors from current and historical borrows
    const categoryCount: Record<string, number> = {};
    const authorCount: Record<string, number> = {};

    // Add current books' categories and authors (weighted higher)
    currentlyBorrowed.forEach(book => {
      categoryCount[book.category] = (categoryCount[book.category] || 0) + 3;
      authorCount[book.author] = (authorCount[book.author] || 0) + 3;
    });

    // Add historical books' categories and authors
    if (history && history.length > 0) {
      const historyBookIds = history.map(h => h.book_id);
      const historyBooks = allBooks.filter(b => historyBookIds.includes(b.id));
      historyBooks.forEach(book => {
        categoryCount[book.category] = (categoryCount[book.category] || 0) + 1;
        authorCount[book.author] = (authorCount[book.author] || 0) + 1;
      });
      // Also count authors from history records
      history.forEach(h => {
        if (h.book_author) {
          authorCount[h.book_author] = (authorCount[h.book_author] || 0) + 1;
        }
      });
    }

    // Sort categories and authors by frequency
    const sortedCategories: CategoryCount[] = Object.entries(categoryCount)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    const sortedAuthors = Object.entries(authorCount)
      .map(([author, count]) => ({ author, count }))
      .sort((a, b) => b.count - a.count);

    return { borrowedBookIds, sortedCategories, sortedAuthors };
  };

  const generateRecommendations = async () => {
    setLoading(true);
    try {
      const { borrowedBookIds, sortedCategories, sortedAuthors } = await getPreferredPatterns();

      // Get available books the user hasn't borrowed
      const availableBooks = allBooks.filter(
        book => book.status === "available" && !borrowedBookIds.has(book.id)
      );

      let recommendedBooks: Book[] = [];

      // First, add books from preferred categories
      if (sortedCategories.length > 0) {
        for (const { category } of sortedCategories) {
          const booksInCategory = availableBooks.filter(
            b => b.category === category && !recommendedBooks.some(rb => rb.id === b.id)
          );
          recommendedBooks.push(...booksInCategory.slice(0, 2));
          if (recommendedBooks.length >= 6) break;
        }
      }

      // If we don't have enough recommendations, add random available books
      if (recommendedBooks.length < 4) {
        const remainingBooks = availableBooks.filter(
          b => !recommendedBooks.some(rb => rb.id === b.id)
        );
        const shuffled = remainingBooks.sort(() => Math.random() - 0.5);
        recommendedBooks.push(...shuffled.slice(0, 4 - recommendedBooks.length));
      }

      const finalBooks = recommendedBooks.slice(0, 6);
      setRecommendations(finalBooks);
      setShownBookIds(new Set(finalBooks.map(b => b.id)));
    } catch (error) {
      console.error("Failed to generate recommendations:", error);
      const available = allBooks.filter(b => b.status === "available").slice(0, 4);
      setRecommendations(available);
      setShownBookIds(new Set(available.map(b => b.id)));
    } finally {
      setLoading(false);
    }
  };

  const loadMoreRecommendations = async () => {
    setLoadingMore(true);
    try {
      const { borrowedBookIds, sortedCategories, sortedAuthors } = await getPreferredPatterns();

      // Get available books not already shown and not borrowed
      const availableBooks = allBooks.filter(
        book => book.status === "available" && 
                !borrowedBookIds.has(book.id) && 
                !shownBookIds.has(book.id)
      );

      let newRecommendations: Book[] = [];

      // Prioritize by preferred authors first
      if (sortedAuthors.length > 0) {
        for (const { author } of sortedAuthors.slice(0, 5)) {
          const booksByAuthor = availableBooks.filter(
            b => b.author === author && !newRecommendations.some(rb => rb.id === b.id)
          );
          newRecommendations.push(...booksByAuthor.slice(0, 2));
          if (newRecommendations.length >= 3) break;
        }
      }

      // Then by preferred categories
      if (newRecommendations.length < 6 && sortedCategories.length > 0) {
        for (const { category } of sortedCategories) {
          const booksInCategory = availableBooks.filter(
            b => b.category === category && !newRecommendations.some(rb => rb.id === b.id)
          );
          newRecommendations.push(...booksInCategory.slice(0, 2));
          if (newRecommendations.length >= 6) break;
        }
      }

      // Fill remaining with random available books
      if (newRecommendations.length < 4) {
        const remainingBooks = availableBooks.filter(
          b => !newRecommendations.some(rb => rb.id === b.id)
        );
        const shuffled = remainingBooks.sort(() => Math.random() - 0.5);
        newRecommendations.push(...shuffled.slice(0, 4 - newRecommendations.length));
      }

      const moreBooks = newRecommendations.slice(0, 6);
      if (moreBooks.length > 0) {
        setRecommendations(prev => [...prev, ...moreBooks]);
        setShownBookIds(prev => {
          const newSet = new Set(prev);
          moreBooks.forEach(b => newSet.add(b.id));
          return newSet;
        });
      }
    } catch (error) {
      console.error("Failed to load more recommendations:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Check if there are more books to load
  const hasMoreBooks = allBooks.filter(
    book => book.status === "available" && !shownBookIds.has(book.id)
  ).length > 0;

  if (loading) {
    if (compact) {
      return (
        <div className="space-y-2 py-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      );
    }
    return (
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Recommended For You
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-32 w-full" />
              <CardContent className="p-3">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="space-y-1.5 py-1">
        {recommendations.slice(0, 5).map((book) => {
          const userRequest = userRequests[book.id];
          const hasRequest = !!userRequest;
          return (
            <div
              key={book.id}
              className="flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
              onClick={() => setSelectedBook(book)}
            >
              <div className="w-8 h-11 rounded overflow-hidden bg-muted flex-shrink-0">
                {book.cover_image_url ? (
                  <img src={book.cover_image_url} alt={book.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookOpen className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{book.title}</p>
                <p className="text-[10px] text-muted-foreground truncate">{book.author}</p>
              </div>
              {hasRequest ? (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Queued</Badge>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestBook?.(book.id);
                  }}
                >
                  Borrow
                </Button>
              )}
            </div>
          );
        })}
        {hasMoreBooks && (
          <Button
            variant="ghost"
            size="sm"
            onClick={loadMoreRecommendations}
            disabled={loadingMore}
            className="w-full text-xs h-7 mt-1"
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${loadingMore ? 'animate-spin' : ''}`} />
            {loadingMore ? 'Loading...' : 'More'}
          </Button>
        )}

        <Dialog open={!!selectedBook} onOpenChange={(open) => !open && setSelectedBook(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedBook?.title}</DialogTitle>
            </DialogHeader>
            {selectedBook && (
              <div className="space-y-4">
                <div className="flex gap-4">
                  {selectedBook.cover_image_url ? (
                    <img src={selectedBook.cover_image_url} alt={selectedBook.title} className="w-24 h-36 object-cover rounded-lg shadow-md" />
                  ) : (
                    <div className="w-24 h-36 bg-muted rounded-lg flex items-center justify-center">
                      <BookOpen className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <p className="text-sm"><span className="font-medium text-muted-foreground">Author:</span> {selectedBook.author}</p>
                    <p className="text-sm"><span className="font-medium text-muted-foreground">Genre:</span> <Badge variant="outline">{selectedBook.category}</Badge></p>
                    <p className="text-sm"><span className="font-medium text-muted-foreground">ISBN:</span> {selectedBook.isbn}</p>
                    <p className="text-sm"><span className="font-medium text-muted-foreground">Status:</span> <Badge variant={selectedBook.status === "available" ? "default" : "secondary"}>{selectedBook.status === "available" ? "Available" : "Borrowed"}</Badge></p>
                  </div>
                </div>
                {!userRequests[selectedBook.id] && selectedBook.status === "available" && (
                  <Button className="w-full" onClick={() => { onRequestBook?.(selectedBook.id); setSelectedBook(null); }}>
                    Borrow This Book
                  </Button>
                )}
                {userRequests[selectedBook.id] && (
                  <p className="text-center text-sm text-muted-foreground">You have already requested this book</p>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Recommended For You
        </h2>
        {hasMoreBooks && (
          <Button
            variant="outline"
            size="sm"
            onClick={loadMoreRecommendations}
            disabled={loadingMore}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loadingMore ? 'animate-spin' : ''}`} />
            {loadingMore ? 'Loading...' : 'Load More'}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {recommendations.map((book) => {
          const userRequest = userRequests[book.id];
          const hasRequest = !!userRequest;

          return (
            <Card 
              key={book.id} 
              className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => setSelectedBook(book)}
            >
              <div className="relative aspect-[2/3] overflow-hidden bg-muted">
                {book.cover_image_url ? (
                  <img
                    src={book.cover_image_url}
                    alt={book.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookOpen className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <span className="text-xs bg-secondary/90 text-secondary-foreground px-2 py-1 rounded-full">
                    {book.category}
                  </span>
                </div>
              </div>
              <CardContent className="p-3">
                <h3 className="font-medium text-sm truncate">{book.title}</h3>
                <p className="text-xs text-muted-foreground truncate">{book.author}</p>
                {hasRequest ? (
                  <Badge variant="secondary" className="mt-2 text-xs">In Queue</Badge>
                ) : (
                  <Button 
                    size="sm" 
                    className="mt-2 w-full text-xs h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRequestBook?.(book.id);
                    }}
                  >
                    Borrow
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Book Details Dialog */}
      <Dialog open={!!selectedBook} onOpenChange={(open) => !open && setSelectedBook(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedBook?.title}</DialogTitle>
          </DialogHeader>
          {selectedBook && (
            <div className="space-y-4">
              <div className="flex gap-4">
                {selectedBook.cover_image_url ? (
                  <img
                    src={selectedBook.cover_image_url}
                    alt={selectedBook.title}
                    className="w-24 h-36 object-cover rounded-lg shadow-md"
                  />
                ) : (
                  <div className="w-24 h-36 bg-muted rounded-lg flex items-center justify-center">
                    <BookOpen className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <p className="text-sm">
                    <span className="font-medium text-muted-foreground">Author:</span>{" "}
                    {selectedBook.author}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium text-muted-foreground">Genre:</span>{" "}
                    <Badge variant="outline">{selectedBook.category}</Badge>
                  </p>
                  <p className="text-sm">
                    <span className="font-medium text-muted-foreground">ISBN:</span>{" "}
                    {selectedBook.isbn}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium text-muted-foreground">Status:</span>{" "}
                    <Badge variant={selectedBook.status === "available" ? "default" : "secondary"}>
                      {selectedBook.status === "available" ? "Available" : "Borrowed"}
                    </Badge>
                  </p>
                </div>
              </div>
              
              {!userRequests[selectedBook.id] && selectedBook.status === "available" && (
                <Button 
                  className="w-full"
                  onClick={() => {
                    onRequestBook?.(selectedBook.id);
                    setSelectedBook(null);
                  }}
                >
                  Borrow This Book
                </Button>
              )}
              {userRequests[selectedBook.id] && (
                <p className="text-center text-sm text-muted-foreground">
                  You have already requested this book
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
