import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Book } from "@/types/book";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface BookRecommendationsProps {
  userId: string;
  allBooks: Book[];
  onRequestBook?: (bookId: string) => void;
  userRequests: Record<string, { status: string; queue_position: number | null }>;
}

interface CategoryCount {
  category: string;
  count: number;
}

export const BookRecommendations = ({ 
  userId, 
  allBooks, 
  onRequestBook,
  userRequests
}: BookRecommendationsProps) => {
  const [recommendations, setRecommendations] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId && allBooks.length > 0) {
      generateRecommendations();
    }
  }, [userId, allBooks]);

  const generateRecommendations = async () => {
    setLoading(true);
    try {
      // Get user's currently borrowed books
      const currentlyBorrowed = allBooks.filter(
        book => book.borrowed_by === userId && (book.status === "borrowed" || book.status === "late")
      );

      // Get user's borrowing history
      const { data: history, error } = await supabase
        .from("borrowing_history")
        .select("book_id")
        .eq("user_id", userId);

      if (error) throw error;

      const borrowedBookIds = new Set([
        ...currentlyBorrowed.map(b => b.id),
        ...(history || []).map(h => h.book_id)
      ]);

      // Count categories from current and historical borrows
      const categoryCount: Record<string, number> = {};

      // Add current books' categories
      currentlyBorrowed.forEach(book => {
        categoryCount[book.category] = (categoryCount[book.category] || 0) + 2; // Weight current books more
      });

      // Add historical books' categories
      if (history && history.length > 0) {
        const historyBookIds = history.map(h => h.book_id);
        const historyBooks = allBooks.filter(b => historyBookIds.includes(b.id));
        historyBooks.forEach(book => {
          categoryCount[book.category] = (categoryCount[book.category] || 0) + 1;
        });
      }

      // Sort categories by frequency
      const sortedCategories: CategoryCount[] = Object.entries(categoryCount)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);

      // Get available books the user hasn't borrowed, prioritized by preferred categories
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
        // Shuffle and take remaining
        const shuffled = remainingBooks.sort(() => Math.random() - 0.5);
        recommendedBooks.push(...shuffled.slice(0, 4 - recommendedBooks.length));
      }

      setRecommendations(recommendedBooks.slice(0, 6));
    } catch (error) {
      console.error("Failed to generate recommendations:", error);
      // Fallback: show random available books
      const available = allBooks.filter(b => b.status === "available").slice(0, 4);
      setRecommendations(available);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
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

  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        Recommended For You
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {recommendations.map((book) => {
          const userRequest = userRequests[book.id];
          const hasRequest = !!userRequest;

          return (
            <Card 
              key={book.id} 
              className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => !hasRequest && onRequestBook?.(book.id)}
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
                  <p className="text-xs text-primary mt-1">In Queue</p>
                ) : (
                  <p className="text-xs text-green-600 mt-1">Click to borrow</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
