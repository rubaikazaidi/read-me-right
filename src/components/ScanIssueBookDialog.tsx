import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { escapeILikePattern, isValidSearchTerm } from "@/lib/security";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, BookOpen, AlertCircle, QrCode, Barcode, RotateCcw, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScanType } from "./QRCodeScanner";
import { differenceInDays } from "date-fns";

interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  gr_number: string | null;
  grade: string | null;
}

interface BookInfo {
  id: string;
  title: string;
  author: string;
  isbn: string;
  status: string;
  borrowed_by: string | null;
  borrowed_at: string | null;
  due_date: string | null;
  organization_id: string | null;
}

interface ScanIssueBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scanType: ScanType;
  scanValue: string;
  onIssued: () => void;
}

export function ScanIssueBookDialog({
  open,
  onOpenChange,
  scanType,
  scanValue,
  onIssued,
}: ScanIssueBookDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [students, setStudents] = useState<Profile[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [returning, setReturning] = useState(false);
  const [bookInfo, setBookInfo] = useState<BookInfo | null>(null);
  const [borrowerInfo, setBorrowerInfo] = useState<Profile | null>(null);
  const [bookLoading, setBookLoading] = useState(true);
  const [bookError, setBookError] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch book info when dialog opens
  useEffect(() => {
    if (open && scanValue) {
      fetchBookInfo();
      setSearchQuery("");
      setStudents([]);
      setSelectedStudent(null);
      setBookError(null);
      setBorrowerInfo(null);
    }
  }, [open, scanValue, scanType]);

  const fetchBookInfo = async () => {
    setBookLoading(true);
    setBookError(null);
    setBorrowerInfo(null);
    
    try {
      let query = supabase
        .from("books")
        .select("id, title, author, isbn, status, borrowed_by, borrowed_at, due_date, organization_id");
      
      if (scanType === "qr") {
        query = query.eq("id", scanValue);
      } else {
        query = query.eq("isbn", scanValue);
      }
      
      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      
      if (!data) {
        if (scanType === "isbn") {
          setBookError(`No book found with ISBN: ${scanValue}`);
          toast({
            variant: "destructive",
            title: "Book Not Found",
            description: `No book in your library matches ISBN: ${scanValue}. Please add this book first.`,
          });
        } else {
          setBookError("Book not found or invalid QR code.");
          toast({
            variant: "destructive",
            title: "Error",
            description: "Book not found or invalid QR code.",
          });
        }
        setBookInfo(null);
        return;
      }
      
      setBookInfo(data);

      // If book is borrowed/late, fetch borrower info
      if ((data.status === "borrowed" || data.status === "late") && data.borrowed_by) {
        const { data: borrower } = await supabase
          .from("profiles")
          .select("id, full_name, email, gr_number, grade")
          .eq("id", data.borrowed_by)
          .maybeSingle();
        
        if (borrower) {
          setBorrowerInfo(borrower);
        }
      }
    } catch (error: any) {
      console.error("Error fetching book:", error);
      setBookError("Failed to fetch book information.");
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch book information.",
      });
      setBookInfo(null);
    } finally {
      setBookLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a search term",
      });
      return;
    }

    if (!isValidSearchTerm(searchQuery)) {
      toast({
        variant: "destructive",
        title: "Invalid search term",
        description: "Please use only letters, numbers, and basic punctuation",
      });
      return;
    }

    setLoading(true);
    try {
      const safeSearchQuery = escapeILikePattern(searchQuery);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, gr_number, grade")
        .or(`full_name.ilike.%${safeSearchQuery}%,email.ilike.%${safeSearchQuery}%,gr_number.ilike.%${safeSearchQuery}%`);

      if (error) throw error;

      const studentIds: string[] = [];
      if (data && data.length > 0) {
        const { data: rolesData } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", data.map(p => p.id))
          .eq("role", "student");

        if (rolesData) {
          rolesData.forEach(r => studentIds.push(r.user_id));
        }
      }

      const filteredStudents = (data || []).filter(p => studentIds.includes(p.id));
      setStudents(filteredStudents);

      if (filteredStudents.length === 0) {
        toast({
          title: "No students found",
          description: "Try a different search term",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to search students",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleIssue = async () => {
    if (!selectedStudent || !bookInfo) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a student",
      });
      return;
    }

    if (bookInfo.status !== "available") {
      toast({
        variant: "destructive",
        title: "Cannot Issue",
        description: "This book is not available for issuing.",
      });
      return;
    }

    setIssuing(true);
    try {
      const now = new Date();
      const { error } = await supabase
        .from("books")
        .update({
          status: "borrowed",
          borrowed_by: selectedStudent.id,
          borrowed_at: now.toISOString(),
          due_date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", bookInfo.id);

      if (error) throw error;

      toast({
        title: "Book Issued Successfully",
        description: `"${bookInfo.title}" has been issued to ${selectedStudent.full_name}`,
      });

      onIssued();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setIssuing(false);
    }
  };

  const handleReturn = async () => {
    if (!bookInfo || !bookInfo.borrowed_by || !bookInfo.borrowed_at) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Cannot return this book - missing borrowing information.",
      });
      return;
    }

    setReturning(true);
    try {
      const now = new Date();
      const dueDate = bookInfo.due_date ? new Date(bookInfo.due_date) : null;
      
      // Calculate if late and days late
      const wasLate = dueDate ? now > dueDate : false;
      const daysLate = wasLate && dueDate ? differenceInDays(now, dueDate) : 0;
      
      // Simple fine calculation (can be enhanced with fine settings later)
      const fineAmount = wasLate ? daysLate * 5 : 0; // ₹5 per day late

      // Create borrowing history record
      const { error: historyError } = await supabase
        .from("borrowing_history")
        .insert({
          book_id: bookInfo.id,
          user_id: bookInfo.borrowed_by,
          book_title: bookInfo.title,
          book_author: bookInfo.author,
          borrowed_at: bookInfo.borrowed_at,
          returned_at: now.toISOString(),
          was_late: wasLate,
          days_late: daysLate,
          fine_amount: fineAmount,
          organization_id: bookInfo.organization_id,
        });

      if (historyError) throw historyError;

      // Update book status to available
      const { error: updateError } = await supabase
        .from("books")
        .update({
          status: "available",
          borrowed_by: null,
          borrowed_at: null,
          due_date: null,
        })
        .eq("id", bookInfo.id);

      if (updateError) throw updateError;

      toast({
        title: "Book Returned Successfully",
        description: `"${bookInfo.title}" has been returned${wasLate ? ` (${daysLate} days late, Fine: ₹${fineAmount})` : ""}`,
      });

      onIssued(); // Refresh the book list
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error returning book:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to return book",
      });
    } finally {
      setReturning(false);
    }
  };

  const isBookBorrowed = bookInfo?.status === "borrowed" || bookInfo?.status === "late";
  const isBookAvailable = bookInfo?.status === "available";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {isBookBorrowed ? "Return or Reassign Book" : "Issue Book to Student"}
          </DialogTitle>
          <DialogDescription>
            {isBookBorrowed 
              ? "This book is currently borrowed. You can return it or view borrower details."
              : "Enter student details to issue this book."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Scan type indicator */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              {scanType === "qr" ? (
                <>
                  <QrCode className="h-3 w-3" />
                  QR Code
                </>
              ) : (
                <>
                  <Barcode className="h-3 w-3" />
                  ISBN: {scanValue}
                </>
              )}
            </Badge>
          </div>

          {/* Book Info Section */}
          {bookLoading ? (
            <div className="p-4 bg-muted rounded-md animate-pulse">
              <div className="h-4 bg-muted-foreground/20 rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted-foreground/20 rounded w-1/2" />
            </div>
          ) : bookInfo ? (
            <div className="p-4 bg-muted rounded-md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{bookInfo.title}</p>
                  <p className="text-sm text-muted-foreground">by {bookInfo.author}</p>
                  {bookInfo.isbn && (
                    <p className="text-xs text-muted-foreground mt-1">ISBN: {bookInfo.isbn}</p>
                  )}
                </div>
                <Badge variant={bookInfo.status === "available" ? "default" : bookInfo.status === "late" ? "destructive" : "secondary"}>
                  {bookInfo.status}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-destructive/10 rounded-md flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-medium">Book not found</p>
                {bookError && <p className="text-sm">{bookError}</p>}
              </div>
            </div>
          )}

          {/* Show borrower info and return option if book is borrowed/late */}
          {isBookBorrowed && borrowerInfo && (
            <div className="p-4 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-md space-y-3">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-200">Currently Borrowed By:</p>
                  <p className="font-semibold text-orange-900 dark:text-orange-100">{borrowerInfo.full_name}</p>
                  {borrowerInfo.gr_number && (
                    <p className="text-sm text-orange-700 dark:text-orange-300">GR: {borrowerInfo.gr_number}</p>
                  )}
                  {borrowerInfo.grade && (
                    <p className="text-sm text-orange-700 dark:text-orange-300">Grade: {borrowerInfo.grade}</p>
                  )}
                  {borrowerInfo.email && (
                    <p className="text-sm text-orange-600 dark:text-orange-400">{borrowerInfo.email}</p>
                  )}
                  {bookInfo?.due_date && (
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                      Due: {new Date(bookInfo.due_date).toLocaleDateString()}
                      {bookInfo.status === "late" && " (OVERDUE)"}
                    </p>
                  )}
                </div>
              </div>
              
              <Button 
                onClick={handleReturn} 
                disabled={returning}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {returning ? "Returning..." : "Return Book to Library"}
              </Button>
            </div>
          )}

          {/* Show student search only if book is available */}
          {isBookAvailable && (
            <>
              <div className="space-y-2">
                <Label>Search Student (by name, email, or GR number)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter student name, email, or GR number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <Button onClick={handleSearch} disabled={loading} size="icon">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {students.length > 0 && (
                <div className="space-y-2">
                  <Label>Select Student</Label>
                  <div className="max-h-48 overflow-y-auto space-y-2 border rounded-md p-2">
                    {students.map((student) => (
                      <div
                        key={student.id}
                        className={`p-3 rounded-md cursor-pointer transition-colors ${
                          selectedStudent?.id === student.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/80"
                        }`}
                        onClick={() => setSelectedStudent(student)}
                      >
                        <p className="font-medium">{student.full_name}</p>
                        <div className={`text-sm ${selectedStudent?.id === student.id ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                          {student.gr_number && <span>GR: {student.gr_number}</span>}
                          {student.gr_number && student.grade && <span> • </span>}
                          {student.grade && <span>Grade: {student.grade}</span>}
                        </div>
                        <p className={`text-sm ${selectedStudent?.id === student.id ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                          {student.email || "No email"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedStudent && (
                <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">Selected Student:</p>
                  <p className="text-sm text-green-700 dark:text-green-300">{selectedStudent.full_name}</p>
                  {selectedStudent.gr_number && (
                    <p className="text-xs text-green-600 dark:text-green-400">GR: {selectedStudent.gr_number}</p>
                  )}
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {isBookBorrowed ? "Close" : "Cancel"}
            </Button>
            {isBookAvailable && (
              <Button onClick={handleIssue} disabled={!selectedStudent || issuing}>
                {issuing ? "Issuing..." : "Issue Book"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
