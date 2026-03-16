import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Camera, Link as LinkIcon, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/hooks/useOrganization";
import { Book } from "@/types/book";

interface EditBookDialogProps {
  book: Book;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookUpdated: () => void;
}

export function EditBookDialog({ book, open, onOpenChange, onBookUpdated }: EditBookDialogProps) {
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [isbn, setIsbn] = useState(book.isbn);
  const [category, setCategory] = useState(book.category);
  const [coverUrl, setCoverUrl] = useState(book.cover_image_url || "");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { organizationId } = useOrganization();

  useEffect(() => {
    setTitle(book.title);
    setAuthor(book.author);
    setIsbn(book.isbn);
    setCategory(book.category);
    setCoverUrl(book.cover_image_url || "");
    setCoverFile(null);
    setCoverPreview(null);
  }, [book]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({ variant: "destructive", title: "Invalid file type", description: "Please select an image file." });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ variant: "destructive", title: "File too large", description: "Please select an image smaller than 5MB." });
        return;
      }
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
      setCoverUrl("");
    }
  };

  const clearCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
    setCoverUrl("");
  };

  const currentCoverDisplay = coverPreview || coverUrl || book.cover_image_url;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let finalCoverUrl = coverUrl || book.cover_image_url || null;

      // Upload new file if provided
      if (coverFile && organizationId) {
        const fileExt = coverFile.name.split('.').pop()?.toLowerCase() || 'jpg';
        const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        const safeExt = allowedExtensions.includes(fileExt) ? fileExt : 'jpg';
        const randomFileName = crypto.randomUUID();
        const filePath = `${organizationId}/${randomFileName}.${safeExt}`;

        const { error: uploadError } = await supabase.storage
          .from('book-covers')
          .upload(filePath, coverFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('book-covers')
          .getPublicUrl(filePath);

        finalCoverUrl = publicUrl;
      }

      // If cover was explicitly cleared
      if (!coverFile && !coverUrl && !coverPreview) {
        finalCoverUrl = null;
      }

      const { error } = await supabase
        .from("books")
        .update({
          title,
          author,
          isbn,
          category,
          cover_image_url: finalCoverUrl,
        })
        .eq("id", book.id);

      if (error) throw error;

      toast({
        title: "Book updated!",
        description: "The book details have been successfully updated.",
      });

      onOpenChange(false);
      onBookUpdated();
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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Book Details</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Book title" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-author">Author</Label>
            <Input id="edit-author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-isbn">ISBN</Label>
            <Input id="edit-isbn" value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="ISBN number" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-category">Category</Label>
            <Select value={category} onValueChange={setCategory} required>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Fiction">Fiction</SelectItem>
                <SelectItem value="Non-Fiction">Non-Fiction</SelectItem>
                <SelectItem value="Science">Science</SelectItem>
                <SelectItem value="History">History</SelectItem>
                <SelectItem value="Biography">Biography</SelectItem>
                <SelectItem value="Technology">Technology</SelectItem>
                <SelectItem value="Textbooks">Textbooks</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Book Cover Section */}
          <div className="space-y-2">
            <Label>Book Cover</Label>
            {currentCoverDisplay && (
              <div className="relative w-24 h-32 mb-2">
                <img
                  src={currentCoverDisplay}
                  alt="Book cover preview"
                  className="w-full h-full object-cover rounded-md border border-border"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  onClick={clearCover}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            <Tabs defaultValue="url" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="url" className="text-xs"><LinkIcon className="h-3 w-3 mr-1" />URL</TabsTrigger>
                <TabsTrigger value="upload" className="text-xs"><Upload className="h-3 w-3 mr-1" />Upload</TabsTrigger>
                <TabsTrigger value="camera" className="text-xs"><Camera className="h-3 w-3 mr-1" />Camera</TabsTrigger>
              </TabsList>
              <TabsContent value="url">
                <Input
                  placeholder="https://example.com/cover.jpg"
                  value={coverUrl}
                  onChange={(e) => {
                    setCoverUrl(e.target.value);
                    setCoverFile(null);
                    setCoverPreview(null);
                  }}
                />
              </TabsContent>
              <TabsContent value="upload">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <Button type="button" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />Choose File
                </Button>
              </TabsContent>
              <TabsContent value="camera">
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
                <Button type="button" variant="outline" className="w-full" onClick={() => cameraInputRef.current?.click()}>
                  <Camera className="h-4 w-4 mr-2" />Take Photo
                </Button>
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
