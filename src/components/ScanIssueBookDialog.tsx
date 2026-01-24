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
import { Search, BookOpen, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  status: string;
  borrowed_by: string | null;
}

interface ScanIssueBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
  onIssued: () => void;
}

export function ScanIssueBookDialog({
  open,
  onOpenChange,
  bookId,
  onIssued,
}: ScanIssueBookDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [students, setStudents] = useState<Profile[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [bookInfo, setBookInfo] = useState<BookInfo | null>(null);
  const [bookLoading, setBookLoading] = useState(true);
  const { toast } = useToast();

  // Fetch book info when dialog opens
  useEffect(() => {
    if (open && bookId) {
      fetchBookInfo();
      setSearchQuery("");
      setStudents([]);
      setSelectedStudent(null);
    }
  }, [open, bookId]);

  const fetchBookInfo = async () => {
    setBookLoading(true);
    try {
      const { data, error } = await supabase
        .from("books")
        .select("id, title, author, status, borrowed_by")
        .eq("id", bookId)
        .single();

      if (error) throw error;
      setBookInfo(data);

      if (data.status !== "available") {
        toast({
          variant: "destructive",
          title: "Book Not Available",
          description: `This book is currently ${data.status}. Please mark it as returned first.`,
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Book not found or invalid QR code.",
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

      // Search for students by name, email, or GR number
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, gr_number, grade")
        .or(`full_name.ilike.%${safeSearchQuery}%,email.ilike.%${safeSearchQuery}%,gr_number.ilike.%${safeSearchQuery}%`);

      if (error) throw error;

      // Filter to only show students
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
        .eq("id", bookId);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Issue Book to Student
          </DialogTitle>
          <DialogDescription>
            Enter student details to issue this book.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
                </div>
                <Badge variant={bookInfo.status === "available" ? "default" : "destructive"}>
                  {bookInfo.status}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-destructive/10 rounded-md flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>Book not found</p>
            </div>
          )}

          {/* Only show student search if book is available */}
          {bookInfo?.status === "available" && (
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
              Cancel
            </Button>
            {bookInfo?.status === "available" && (
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
