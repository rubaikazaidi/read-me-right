import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface StudentProfile {
  full_name: string;
  email: string | null;
  grade: string | null;
  organization: string | null;
  age: number | null;
  gr_number: string | null;
  profile_picture_url: string | null;
}

interface StudentProfileDialogProps {
  userId: string;
}

export const StudentProfileDialog = ({ userId }: StudentProfileDialogProps) => {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && userId) {
      fetchProfile();
    }
  }, [open, userId]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, grade, organization, age, gr_number, profile_picture_url")
        .eq("id", userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <User className="h-4 w-4 mr-2" />
          Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>My Profile</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : profile ? (
          <div className="space-y-6">
            <div className="flex justify-center">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile.profile_picture_url || undefined} alt={profile.full_name} />
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {getInitials(profile.full_name)}
                </AvatarFallback>
              </Avatar>
            </div>
            
            <div className="space-y-4">
              <ProfileField label="Name" value={profile.full_name} />
              <ProfileField label="Email" value={profile.email} />
              <ProfileField label="Grade" value={profile.grade} />
              <ProfileField label="Organization (School)" value={profile.organization} />
              <ProfileField label="Age" value={profile.age?.toString()} />
              <ProfileField label="GR Number" value={profile.gr_number} />
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Failed to load profile</p>
        )}
      </DialogContent>
    </Dialog>
  );
};

const ProfileField = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div className="flex justify-between items-center py-2 border-b border-border">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-foreground">{value || "Not set"}</span>
  </div>
);
