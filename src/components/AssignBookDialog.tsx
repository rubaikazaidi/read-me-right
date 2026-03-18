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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, AlertTriangle } from "lucide-react";

interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  age: number | null;
}

interface ApprovedRequest {
  id: string;
  user_id: string;
  student_name: string;
}

interface AssignBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
  bookTitle: string;
  onAssigned: () => void;
}

export function AssignBookDialog({
  open,
  onOpenChange,
  bookId,
  bookTitle,
  onAssigned,
}: AssignBookDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [students, setStudents] = useState<Profile[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [approvedRequest, setApprovedRequest] = useState<ApprovedRequest | null>(null);
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setStudents([]);
      setSelectedStudent(null);
      setApprovedRequest(null);
      fetchApprovedRequest();
    }
  }, [open, bookId]);

  const fetchApprovedRequest = async () => {
    try {
      const { data } = await supabase
        .from("book_requests")
        .select("id, user_id, profiles:user_id (full_name)")
        .eq("book_id", bookId)
        .eq("status", "approved")
        .limit(1);

      if (data && data.length > 0) {
        const req = data[0] as any;
        setApprovedRequest({
          id: req.id,
          user_id: req.user_id,
          student_name: req.profiles?.full_name || "Unknown",
        });
      } else {
        setApprovedRequest(null);
      }
    } catch (err) {
      console.error("Error fetching approved requests:", err);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a search term" });
      return;
    }

    if (!isValidSearchTerm(searchQuery)) {
      toast({ variant: "destructive", title: "Invalid search term", description: "Please use only letters, numbers, and basic punctuation" });
      return;
    }

    setLoading(true);
    try {
      const safeSearchQuery = escapeILikePattern(searchQuery);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .or(`full_name.ilike.%${safeSearchQuery}%,email.ilike.%${safeSearchQuery}%`);

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
        toast({ title: "No students found", description: "Try a different search term" });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: "Failed to search students" });
    } finally {
      setLoading(false);
    }
  };

  const performAssign = async () => {
    if (!selectedStudent) return;

    setAssigning(true);
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

      // Remove ALL requests for this book (assigned student + any approved request being overridden)
      await supabase
        .from("book_requests")
        .delete()
        .eq("book_id", bookId)
        .in("status", ["approved", "pending"])
        .or(`user_id.eq.${selectedStudent.id}`);

      // Also specifically delete the assigned student's requests
      await supabase
        .from("book_requests")
        .delete()
        .eq("book_id", bookId)
        .eq("user_id", selectedStudent.id);

      // If overriding, also delete the approved request
      if (approvedRequest && approvedRequest.user_id !== selectedStudent.id) {
        await supabase
          .from("book_requests")
          .delete()
          .eq("id", approvedRequest.id);
      }

      // Update queue positions
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await supabase.functions.invoke("update-queue-positions", {
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: { book_id: bookId },
          });
        }
      } catch (queueError) {
        console.error("Error updating queue positions:", queueError);
      }

      toast({
        title: "Success",
        description: `Book assigned to ${selectedStudent.full_name}`,
      });

      onAssigned();
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setAssigning(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedStudent) {
      toast({ variant: "destructive", title: "Error", description: "Please select a student" });
      return;
    }

    // Check if there's an approved request for a DIFFERENT student
    if (approvedRequest && approvedRequest.user_id !== selectedStudent.id) {
      setShowOverrideConfirm(true);
      return;
    }

    await performAssign();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Book to Student</DialogTitle>
            <DialogDescription>
              Search for a student to assign "{bookTitle}" to.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Warning if there's an approved request */}
            {approvedRequest && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Approved Request Exists</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    <span className="font-semibold">{approvedRequest.student_name}</span> has an approved request for this book. Assigning to a different student will override their approval.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Search Student (by name or email)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter student name or email..."
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
                      <p className={`text-sm ${selectedStudent?.id === student.id ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                        {student.email || "No email"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedStudent && (
              <div className="p-3 bg-muted/50 rounded-md">
                <p className="text-sm font-medium">Selected Student:</p>
                <p className="text-sm">{selectedStudent.full_name}</p>
                <p className="text-xs text-muted-foreground">{selectedStudent.email || "No email"}</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssign} disabled={!selectedStudent || assigning}>
                {assigning ? "Assigning..." : "Assign Book"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Override confirmation dialog */}
      <AlertDialog open={showOverrideConfirm} onOpenChange={setShowOverrideConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Override Approved Request?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold">{approvedRequest?.student_name}</span> has an approved request to pick up this book. Assigning it to{" "}
              <span className="font-semibold">{selectedStudent?.full_name}</span> will cancel their approved request and remove them from the queue.
              <br /><br />
              Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={performAssign}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Override & Assign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
