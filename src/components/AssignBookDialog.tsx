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
import { Search } from "lucide-react";

interface Profile {
  id: string;
  full_name: string;
  email: string | null;
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
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setStudents([]);
      setSelectedStudent(null);
    }
  }, [open]);

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
      // Escape special ILIKE characters to prevent pattern injection
      const safeSearchQuery = escapeILikePattern(searchQuery);
      
      // Search for students by name or email
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .or(`full_name.ilike.%${safeSearchQuery}%,email.ilike.%${safeSearchQuery}%`);

      if (error) throw error;

      // Filter to only show students (not librarians)
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

  const handleAssign = async () => {
    if (!selectedStudent) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a student",
      });
      return;
    }

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

      toast({
        title: "Success",
        description: `Book assigned to ${selectedStudent.full_name}`,
      });

      onAssigned();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Book to Student</DialogTitle>
          <DialogDescription>
            Search for a student to assign "{bookTitle}" to.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
  );
}
