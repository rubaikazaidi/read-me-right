import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Search, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface StudentProfile {
  id: string;
  full_name: string;
  email: string | null;
}

const StudentSearchDialog = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const searchStudents = useCallback(async (term: string) => {
    if (!term.trim()) {
      setStudents([]);
      return;
    }
    
    setSearchLoading(true);
    
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

  const handleSelectStudent = (student: StudentProfile) => {
    setOpen(false);
    navigate(`/student/${student.id}`);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setSearchTerm("");
      setStudents([]);
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
      <DialogContent className="max-w-md">
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

          {/* Student List */}
          <ScrollArea className="h-[300px] pr-4">
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
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export { StudentSearchDialog };
