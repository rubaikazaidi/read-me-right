import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please select an image file.",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `profile-pictures/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("book-covers")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("book-covers")
        .getPublicUrl(filePath);

      // Update profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ profile_picture_url: publicUrl })
        .eq("id", userId);

      if (updateError) throw updateError;

      setProfile((prev) => prev ? { ...prev, profile_picture_url: publicUrl } : null);

      toast({
        title: "Profile picture updated",
        description: "Your profile picture has been updated successfully.",
      });
    } catch (error: any) {
      console.error("Error uploading profile picture:", error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message,
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
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
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profile.profile_picture_url || undefined} alt={profile.full_name} />
                  <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                    {getInitials(profile.full_name)}
                  </AvatarFallback>
                </Avatar>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </div>
              {uploading && (
                <span className="text-sm text-muted-foreground">Uploading...</span>
              )}
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
