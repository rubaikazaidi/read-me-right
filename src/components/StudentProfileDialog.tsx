import { useState, useEffect, useRef, useCallback } from "react";
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
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Function to get signed URL for private profile pictures
  const getSignedProfilePictureUrl = useCallback(async (storedPath: string | null) => {
    if (!storedPath) {
      setProfilePictureUrl(null);
      return;
    }

    try {
      // Check if it's already a full URL (old public bucket format)
      if (storedPath.startsWith('http')) {
        // For backwards compatibility with old public URLs
        setProfilePictureUrl(storedPath);
        return;
      }

      // Get signed URL for private bucket (1 hour expiry)
      const { data, error } = await supabase.storage
        .from("profile-pictures")
        .createSignedUrl(storedPath, 3600);

      if (error) {
        console.error("Error getting signed URL:", error);
        setProfilePictureUrl(null);
        return;
      }

      setProfilePictureUrl(data.signedUrl);
    } catch (error) {
      console.error("Error fetching profile picture:", error);
      setProfilePictureUrl(null);
    }
  }, []);

  useEffect(() => {
    if (open && userId) {
      fetchProfile();
    }
  }, [open, userId]);

  // Update signed URL when profile changes
  useEffect(() => {
    if (profile?.profile_picture_url) {
      getSignedProfilePictureUrl(profile.profile_picture_url);
    } else {
      setProfilePictureUrl(null);
    }
  }, [profile?.profile_picture_url, getSignedProfilePictureUrl]);

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
      // SECURITY: Use randomized file names to prevent enumeration
      const fileExt = file.name.split(".").pop()?.toLowerCase() || 'jpg';
      const randomFileName = crypto.randomUUID();
      // Store in user-specific folder for RLS policy compliance
      const filePath = `${userId}/${randomFileName}.${fileExt}`;

      // Upload to PRIVATE profile-pictures bucket (not public book-covers)
      const { error: uploadError } = await supabase.storage
        .from("profile-pictures")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Store the path (not the URL) in the database
      // We'll generate signed URLs on-demand for viewing
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ profile_picture_url: filePath })
        .eq("id", userId);

      if (updateError) throw updateError;

      // Get signed URL for immediate display
      const { data: signedData } = await supabase.storage
        .from("profile-pictures")
        .createSignedUrl(filePath, 3600);

      if (signedData?.signedUrl) {
        setProfilePictureUrl(signedData.signedUrl);
      }

      setProfile((prev) => prev ? { ...prev, profile_picture_url: filePath } : null);

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
                  <AvatarImage src={profilePictureUrl || undefined} alt={profile.full_name} />
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
