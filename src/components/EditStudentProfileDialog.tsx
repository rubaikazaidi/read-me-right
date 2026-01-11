import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface StudentProfile {
  id: string;
  full_name: string;
  email: string | null;
  grade: string | null;
  organization: string | null;
  age: number | null;
  gr_number: string | null;
}

interface EditStudentProfileDialogProps {
  student: StudentProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export const EditStudentProfileDialog = ({ 
  student, 
  open, 
  onOpenChange,
  onUpdate 
}: EditStudentProfileDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    grade: "",
    organization: "",
    age: "",
    gr_number: "",
  });

  useEffect(() => {
    if (student) {
      setFormData({
        full_name: student.full_name || "",
        grade: student.grade || "",
        organization: student.organization || "",
        age: student.age?.toString() || "",
        gr_number: student.gr_number || "",
      });
    }
  }, [student]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          grade: formData.grade || null,
          organization: formData.organization || null,
          age: formData.age ? parseInt(formData.age) : null,
          gr_number: formData.gr_number || null,
        })
        .eq("id", student.id);

      if (error) throw error;

      toast({
        title: "Profile updated",
        description: "Student profile has been updated successfully.",
      });
      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Student Profile</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="grade">Grade</Label>
            <Input
              id="grade"
              value={formData.grade}
              onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
              placeholder="e.g., 10th Grade"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="organization">Organization (School)</Label>
            <Input
              id="organization"
              value={formData.organization}
              onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
              placeholder="e.g., ABC High School"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="age">Age</Label>
            <Input
              id="age"
              type="number"
              min="5"
              max="100"
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              placeholder="e.g., 16"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gr_number">GR Number</Label>
            <Input
              id="gr_number"
              value={formData.gr_number}
              onChange={(e) => setFormData({ ...formData, gr_number: e.target.value })}
              placeholder="e.g., GR-12345"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
