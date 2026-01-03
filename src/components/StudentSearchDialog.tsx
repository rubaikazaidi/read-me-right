import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Users, Search, BookOpen, Mail, User, Calendar, AlertCircle, CheckCircle } from "lucide-react";
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

const StudentSearchDialog = () => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [borrowingHistory, setBorrowingHistory] = useState<BorrowingHistoryEntry[]>([]);
  const [currentBooks, setCurrentBooks] = useState<CurrentBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const searchStudents = useCallback(async (term: string) => {
    if (!term.trim()) {
      setStudents([]);
      return;
    }
    
    setSearchLoading(true);
    setSelectedStudent(null);
    
    try {
      // Get all student user IDs
      const { data: studentRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");

      const studentIds = studentRoles?.map(r => r.user_id) || [];

      // Search profiles that are students
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", studentIds)
        .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error("Error searching students:", error);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchStudents(searchTerm);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, searchStudents]);

  const handleSelectStudent = async (student: StudentProfile) => {
    setSelectedStudent(student);
    setLoading(true);

    try {
      // Fetch borrowing history
      const { data: history, error: historyError } = await supabase
        .from("borrowing_history")
        .select("*")
        .eq("user_id", student.id)
        .order("returned_at", { ascending: false });

      if (historyError) throw historyError;
      setBorrowingHistory(history || []);

      // Fetch current borrowed books
      const { data: currentBooksData, error: booksError } = await supabase
        .from("books")
        .select("id, title, author, borrowed_at, due_date, status")
        .eq("borrowed_by", student.id);

      if (booksError) throw booksError;
      setCurrentBooks(currentBooksData || []);
    } catch (error) {
      console.error("Error fetching student details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setSearchTerm("");
      setStudents([]);
      setSelectedStudent(null);
      setBorrowingHistory([]);
      setCurrentBooks([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Users className="h-4 w-4 mr-2" />
          Students
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Student Search
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
            {searchLoading && (
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">
                Searching...
              </span>
            )}
          </div>

          {/* Student List or Selected Student Details */}
          <ScrollArea className="h-[500px] pr-4">
            {!selectedStudent ? (
              // Student Search Results
              <div className="space-y-2">
                {students.length === 0 && searchTerm && !searchLoading && (
                  <p className="text-center text-muted-foreground py-8">
                    No students found matching "{searchTerm}"
                  </p>
                )}
                {students.map((student) => (
                  <div
                    key={student.id}
                    onClick={() => handleSelectStudent(student)}
                    className="p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{student.full_name}</p>
                        <p className="text-sm text-muted-foreground">{student.email}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Selected Student Details
              <div className="space-y-6">
                {/* Back Button and Student Info */}
                <div className="space-y-4">
                  <Button variant="ghost" onClick={() => setSelectedStudent(null)} className="mb-2">
                    ← Back to search results
                  </Button>
                  
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-primary/10 rounded-full">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">{selectedStudent.full_name}</h3>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          <span>{selectedStudent.email}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {loading ? (
                  <p className="text-center text-muted-foreground py-4">Loading details...</p>
                ) : (
                  <>
                    {/* Current Borrowed Books */}
                    <div className="space-y-3">
                      <h4 className="font-semibold flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        Currently Borrowed ({currentBooks.length})
                      </h4>
                      {currentBooks.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No books currently borrowed.</p>
                      ) : (
                        <div className="space-y-2">
                          {currentBooks.map((book) => {
                            const isLate = book.status === "late";
                            return (
                              <div
                                key={book.id}
                                className={`p-3 border rounded-lg ${isLate ? "border-destructive bg-destructive/5" : ""}`}
                              >
                                <div className="flex items-start justify-between">
                                  <div>
                                    <p className="font-medium">{book.title}</p>
                                    <p className="text-sm text-muted-foreground">{book.author}</p>
                                  </div>
                                  {isLate && (
                                    <Badge variant="destructive">Late</Badge>
                                  )}
                                </div>
                                <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
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
                    </div>

                    {/* Borrowing History */}
                    <div className="space-y-3">
                      <h4 className="font-semibold flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Borrowing History ({borrowingHistory.length})
                      </h4>
                      {borrowingHistory.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No borrowing history available.</p>
                      ) : (
                        <div className="space-y-2">
                          {borrowingHistory.map((entry) => (
                            <div
                              key={entry.id}
                              className={`p-3 border rounded-lg ${entry.was_late ? "border-orange-300 bg-orange-50 dark:bg-orange-950/20" : ""}`}
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
                              <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Borrowed: {format(new Date(entry.borrowed_at), "MMM d, yyyy")}
                                </span>
                                <span className="flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  Returned: {format(new Date(entry.returned_at), "MMM d, yyyy")}
                                </span>
                                {entry.was_late && entry.fine_amount && (
                                  <span className="text-orange-600 font-medium">
                                    Fine: ₹{entry.fine_amount}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export { StudentSearchDialog };
