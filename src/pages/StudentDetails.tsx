import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, BookOpen, Mail, User, Calendar, AlertCircle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface StudentProfile {
  id: string;
  full_name: string;
  email: string | null;
}

interface BorrowingHistoryEntry {
  id: string;
  book_title: string;
  book_author: string;
  borrowed_at: string;
  returned_at: string;
  was_late: boolean;
  days_late: number | null;
  fine_amount: number | null;
}

interface CurrentBook {
  id: string;
  title: string;
  author: string;
  borrowed_at: string | null;
  due_date: string | null;
  status: string;
}

const StudentDetails = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [borrowingHistory, setBorrowingHistory] = useState<BorrowingHistoryEntry[]>([]);
  const [currentBooks, setCurrentBooks] = useState<CurrentBook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudentDetails = async () => {
      if (!studentId) return;

      try {
        // Fetch student profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("id", studentId)
          .single();

        if (profileError) throw profileError;
        setStudent(profileData);

        // Fetch borrowing history
        const { data: history, error: historyError } = await supabase
          .from("borrowing_history")
          .select("*")
          .eq("user_id", studentId)
          .order("returned_at", { ascending: false });

        if (historyError) throw historyError;
        setBorrowingHistory(history || []);

        // Fetch current borrowed books
        const { data: currentBooksData, error: booksError } = await supabase
          .from("books")
          .select("id, title, author, borrowed_at, due_date, status")
          .eq("borrowed_by", studentId);

        if (booksError) throw booksError;
        setCurrentBooks(currentBooksData || []);
      } catch (error) {
        console.error("Error fetching student details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentDetails();
  }, [studentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading student details...</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Student not found.</p>
        <Button onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header with Back Button */}
        <div className="mb-8">
          <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>

          {/* Student Info Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-primary/10 rounded-full">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{student.full_name}</h1>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{student.email}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Current Borrowed Books */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Currently Borrowed ({currentBooks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentBooks.length === 0 ? (
              <p className="text-muted-foreground">No books currently borrowed.</p>
            ) : (
              <div className="space-y-3">
                {currentBooks.map((book) => {
                  const isLate = book.status === "late";
                  return (
                    <div
                      key={book.id}
                      className={`p-4 border rounded-lg ${isLate ? "border-destructive bg-destructive/5" : ""}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{book.title}</p>
                          <p className="text-sm text-muted-foreground">{book.author}</p>
                        </div>
                        {isLate && <Badge variant="destructive">Late</Badge>}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                        {book.borrowed_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Borrowed: {format(new Date(book.borrowed_at), "MMM d, yyyy")}
                          </span>
                        )}
                        {book.due_date && (
                          <span className={`flex items-center gap-1 ${isLate ? "text-destructive font-medium" : ""}`}>
                            <AlertCircle className="h-3 w-3" />
                            Due: {format(new Date(book.due_date), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Borrowing History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Borrowing History ({borrowingHistory.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {borrowingHistory.length === 0 ? (
              <p className="text-muted-foreground">No borrowing history available.</p>
            ) : (
              <div className="space-y-3">
                {borrowingHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className={`p-4 border rounded-lg ${entry.was_late ? "border-orange-300 bg-orange-50 dark:bg-orange-950/20" : ""}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{entry.book_title}</p>
                        <p className="text-sm text-muted-foreground">{entry.book_author}</p>
                      </div>
                      {entry.was_late && (
                        <Badge variant="outline" className="text-orange-600 border-orange-300">
                          Late ({entry.days_late} days)
                        </Badge>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Borrowed: {format(new Date(entry.borrowed_at), "MMM d, yyyy")}
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Returned: {format(new Date(entry.returned_at), "MMM d, yyyy")}
                      </span>
                      {entry.was_late && entry.fine_amount && (
                        <span className="text-orange-600 font-medium">Fine: ₹{entry.fine_amount}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentDetails;
