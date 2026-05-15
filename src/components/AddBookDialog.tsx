import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload, Camera, Link as LinkIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/hooks/useOrganization";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AddBookDialogProps {
  onBookAdded: () => void;
  initialIsbn?: string;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export function AddBookDialog({ 
  onBookAdded, 
  initialIsbn,
  externalOpen,
  onExternalOpenChange 
}: AddBookDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isbn, setIsbn] = useState("");
  const [category, setCategory] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [ageRating, setAgeRating] = useState("");
  const [deweyDecimal, setDeweyDecimal] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingBookInfo, setFetchingBookInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { organizationId } = useOrganization();

  // Fetch book info from Open Library API (primary) with Google Books as fallback
  const fetchBookInfoFromIsbn = async (isbnToSearch: string) => {
    if (!isbnToSearch || isbnToSearch.length < 10) return;
    
    setFetchingBookInfo(true);
    try {
      // Try Open Library API first (more reliable, no quota limits)
      const openLibResponse = await fetch(
        `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbnToSearch)}&format=json&jscmd=data`
      );
      
      if (openLibResponse.ok) {
        const openLibData = await openLibResponse.json();
        const bookKey = `ISBN:${isbnToSearch}`;
        
        if (openLibData[bookKey]) {
          const bookInfo = openLibData[bookKey];
          
          if (bookInfo.title) {
            setTitle(bookInfo.title);
          }
          
          if (bookInfo.authors?.length > 0) {
            setAuthor(bookInfo.authors.map((a: { name: string }) => a.name).join(", "));
          }
          
          // Auto-set cover image if available
          if (bookInfo.cover?.large || bookInfo.cover?.medium || bookInfo.cover?.small) {
            const coverImage = bookInfo.cover.large || bookInfo.cover.medium || bookInfo.cover.small;
            setCoverUrl(coverImage.replace("http://", "https://"));
          }
          
          // Try to match category from subjects
          if (bookInfo.subjects?.length > 0) {
            const subjectName = bookInfo.subjects[0].name?.toLowerCase() || "";
            if (subjectName.includes("fiction")) setCategory("Fiction");
            else if (subjectName.includes("science")) setCategory("Science");
            else if (subjectName.includes("history")) setCategory("History");
            else if (subjectName.includes("biography")) setCategory("Biography");
            else if (subjectName.includes("technology") || subjectName.includes("computer")) setCategory("Technology");
            else if (subjectName.includes("education") || subjectName.includes("textbook")) setCategory("Textbooks");
            else setCategory("Other");
          }
          
          toast({
            title: "Book info found!",
            description: `Auto-filled details for "${bookInfo.title}"`,
          });
          setFetchingBookInfo(false);
          return;
        }
      }

      // Fallback to Google Books API
      const googleResponse = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbnToSearch)}`
      );
      
      if (googleResponse.ok) {
        const data = await googleResponse.json();
        
        if (data.totalItems > 0 && data.items?.[0]?.volumeInfo) {
          const bookInfo = data.items[0].volumeInfo;
          
          if (bookInfo.title) {
            setTitle(bookInfo.title);
          }
          
          if (bookInfo.authors?.length > 0) {
            setAuthor(bookInfo.authors.join(", "));
          }
          
          if (bookInfo.imageLinks?.thumbnail) {
            const coverImage = bookInfo.imageLinks.large || 
                              bookInfo.imageLinks.medium || 
                              bookInfo.imageLinks.small || 
                              bookInfo.imageLinks.thumbnail;
            setCoverUrl(coverImage.replace("http://", "https://"));
          }
          
          if (bookInfo.categories?.length > 0) {
            const bookCategory = bookInfo.categories[0].toLowerCase();
            if (bookCategory.includes("fiction")) setCategory("Fiction");
            else if (bookCategory.includes("science")) setCategory("Science");
            else if (bookCategory.includes("history")) setCategory("History");
            else if (bookCategory.includes("biography")) setCategory("Biography");
            else if (bookCategory.includes("technology") || bookCategory.includes("computer")) setCategory("Technology");
            else if (bookCategory.includes("education") || bookCategory.includes("textbook")) setCategory("Textbooks");
            else setCategory("Other");
          }
          
          toast({
            title: "Book info found!",
            description: `Auto-filled details for "${bookInfo.title}"`,
          });
          setFetchingBookInfo(false);
          return;
        }
      }

      // No book found in either API
      toast({
        title: "Book not found",
        description: "No book info found for this ISBN. Please enter details manually.",
      });
    } catch (error) {
      console.error("Error fetching book info:", error);
      toast({
        variant: "destructive",
        title: "Lookup failed",
        description: "Could not fetch book info. Please enter details manually.",
      });
    } finally {
      setFetchingBookInfo(false);
    }
  };

  // Use external control if provided, otherwise internal
  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = isControlled ? (onExternalOpenChange || (() => {})) : setInternalOpen;

  // Set initial ISBN and fetch book info when dialog opens with it
  useEffect(() => {
    if (open && initialIsbn) {
      setIsbn(initialIsbn);
      fetchBookInfoFromIsbn(initialIsbn);
    }
  }, [open, initialIsbn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!organizationId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Organization not found. Please try logging out and back in.",
      });
      return;
    }
    
    setLoading(true);

    try {
      let finalCoverUrl = coverUrl;
      let copyNumber = 1;

      // Check if a book with the same ISBN already exists in the organization
      const { data: existingBooks, error: checkError } = await supabase
        .from("books")
        .select("copy_number")
        .eq("isbn", isbn)
        .eq("organization_id", organizationId)
        .order("copy_number", { ascending: false })
        .limit(1);

      if (checkError) throw checkError;

      if (existingBooks && existingBooks.length > 0) {
        copyNumber = (existingBooks[0].copy_number || 1) + 1;
      }

      // Upload file if provided
      if (coverFile) {
        // Validate file type
        if (!coverFile.type.startsWith('image/')) {
          toast({
            variant: "destructive",
            title: "Invalid file type",
            description: "Please select an image file.",
          });
          setLoading(false);
          return;
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (coverFile.size > maxSize) {
          toast({
            variant: "destructive",
            title: "File too large",
            description: "Please select an image smaller than 5MB.",
          });
          setLoading(false);
          return;
        }

        // Use secure random names with validated extension
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

      const { error } = await supabase.from("books").insert({
        title,
        author,
        isbn,
        category,
        status: "available",
        cover_image_url: finalCoverUrl || null,
        organization_id: organizationId,
        copy_number: copyNumber,
        age_rating: ageRating || null,
      });

      if (error) throw error;

      toast({
        title: "Book added!",
        description: copyNumber > 1 
          ? `Added as copy #${copyNumber} of "${title}".`
          : "The book has been successfully added to the library.",
      });

      setTitle("");
      setAuthor("");
      setIsbn("");
      setCategory("");
      setCoverUrl("");
      setCoverFile(null);
      setAgeRating("");
      setOpen(false);
      onBookAdded();
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
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add New Book
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Book</DialogTitle>
        </DialogHeader>
        
        {fetchingBookInfo && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Looking up book details...</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={fetchingBookInfo ? "Loading..." : "Book title"}
              required
              disabled={fetchingBookInfo}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="author">Author</Label>
            <Input
              id="author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder={fetchingBookInfo ? "Loading..." : "Author name"}
              required
              disabled={fetchingBookInfo}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="isbn">ISBN</Label>
            <Input
              id="isbn"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              placeholder="ISBN number"
              required
              disabled={fetchingBookInfo}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
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
          <div className="space-y-2">
            <Label htmlFor="ageRating">Age Rating</Label>
            <Select value={ageRating} onValueChange={setAgeRating}>
              <SelectTrigger>
                <SelectValue placeholder="Select age rating (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ages</SelectItem>
                <SelectItem value="5+">5+</SelectItem>
                <SelectItem value="8+">8+</SelectItem>
                <SelectItem value="10+">10+</SelectItem>
                <SelectItem value="13+">13+</SelectItem>
                <SelectItem value="16+">16+</SelectItem>
                <SelectItem value="18+">18+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Book Cover</Label>
            <Tabs defaultValue="url" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="url">
                  <LinkIcon className="w-4 h-4 mr-2" />
                  URL
                </TabsTrigger>
                <TabsTrigger value="upload">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </TabsTrigger>
                <TabsTrigger value="camera">
                  <Camera className="w-4 h-4 mr-2" />
                  Camera
                </TabsTrigger>
              </TabsList>
              <TabsContent value="url" className="space-y-2">
                <Input
                  placeholder="Enter image URL"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                />
              </TabsContent>
              <TabsContent value="upload" className="space-y-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                />
              </TabsContent>
              <TabsContent value="camera" className="space-y-2">
                <Input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                />
              </TabsContent>
            </Tabs>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Adding..." : "Add Book"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
