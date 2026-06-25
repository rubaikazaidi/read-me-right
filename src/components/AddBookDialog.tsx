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
import { Textarea } from "@/components/ui/textarea";
import { getDeweyForCategory } from "@/lib/dewey";
import { CameraCapture } from "@/components/CameraCapture";

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
  const DEFAULT_CATEGORIES = ["Fiction", "Non-Fiction", "Science", "History", "Biography", "Technology", "Textbooks", "Other"];
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [coverUrl, setCoverUrl] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [ageRating, setAgeRating] = useState("");
  const [deweyDecimal, setDeweyDecimal] = useState("");
  const [summary, setSummary] = useState("");
  const [backCoverFile, setBackCoverFile] = useState<File | null>(null);
  const [classificationNumber, setClassificationNumber] = useState("");
  const [vendorBill, setVendorBill] = useState("");
  const [price, setPrice] = useState("");
  const [pageCount, setPageCount] = useState("");
  const [publisher, setPublisher] = useState("");
  const [loading, setLoading] = useState(false);
  const [coverCameraOpen, setCoverCameraOpen] = useState(false);
  const [backCoverCameraOpen, setBackCoverCameraOpen] = useState(false);

  const [fetchingBookInfo, setFetchingBookInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const backCoverFileInputRef = useRef<HTMLInputElement>(null);
  const backCoverCameraInputRef = useRef<HTMLInputElement>(null);
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

          // Pull summary if available
          const olSummary = bookInfo.excerpts?.[0]?.text || bookInfo.notes || "";
          if (olSummary && typeof olSummary === "string") {
            setSummary(olSummary);
          }

          if (bookInfo.publishers?.length > 0 && bookInfo.publishers[0]?.name) {
            setPublisher(bookInfo.publishers[0].name);
          }
          if (bookInfo.number_of_pages) {
            setPageCount(String(bookInfo.number_of_pages));
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

          if (bookInfo.description) {
            setSummary(bookInfo.description);
          }
          if (bookInfo.publisher) {
            setPublisher(bookInfo.publisher);
          }
          if (bookInfo.pageCount) {
            setPageCount(String(bookInfo.pageCount));
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

  // Load custom categories from DB
  const loadCategories = async () => {
    const { data } = await supabase
      .from("book_categories")
      .select("name")
      .order("name");
    if (data) {
      const names = data.map((c: any) => c.name).filter((n: string) => !DEFAULT_CATEGORIES.includes(n));
      setCustomCategories(names);
    }
  };

  // Set initial ISBN and fetch book info when dialog opens with it
  useEffect(() => {
    if (open) {
      loadCategories();
      if (initialIsbn) {
        setIsbn(initialIsbn);
        fetchBookInfoFromIsbn(initialIsbn);
      }
    }
  }, [open, initialIsbn]);

  const handleCategoryChange = async (value: string) => {
    if (value === "__add_new__") {
      const name = window.prompt("Enter new category name:")?.trim();
      if (!name) return;
      const all = [...DEFAULT_CATEGORIES, ...customCategories];
      if (all.some((c) => c.toLowerCase() === name.toLowerCase())) {
        toast({ variant: "destructive", title: "Category exists", description: `"${name}" already exists.` });
        return;
      }
      const { error } = await supabase
        .from("book_categories")
        .insert({ name, organization_id: organizationId });
      if (error) {
        toast({ variant: "destructive", title: "Error", description: error.message });
        return;
      }
      setCustomCategories((prev) => [...prev, name]);
      setCategory(name);
      toast({ title: "Category added", description: `"${name}" is now available.` });
      return;
    }
    setCategory(value);
    setDeweyDecimal((prev) => prev.trim() ? prev : getDeweyForCategory(value));
  };


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

      // Upload back cover image if provided
      let finalBackCoverUrl: string | null = null;
      if (backCoverFile) {
        if (!backCoverFile.type.startsWith('image/')) {
          toast({ variant: "destructive", title: "Invalid file type", description: "Back cover must be an image." });
          setLoading(false);
          return;
        }
        if (backCoverFile.size > 5 * 1024 * 1024) {
          toast({ variant: "destructive", title: "File too large", description: "Back cover image must be smaller than 5MB." });
          setLoading(false);
          return;
        }
        const ext = backCoverFile.name.split('.').pop()?.toLowerCase() || 'jpg';
        const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        const safeExt = allowed.includes(ext) ? ext : 'jpg';
        const filePath = `${organizationId}/${crypto.randomUUID()}-back.${safeExt}`;
        const { error: upErr } = await supabase.storage.from('book-covers').upload(filePath, backCoverFile);
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from('book-covers').getPublicUrl(filePath);
        finalBackCoverUrl = publicUrl;
      }

      const finalDewey = deweyDecimal.trim() || getDeweyForCategory(category);

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
        dewey_decimal: finalDewey,
        summary: summary.trim() || null,
        back_cover_image_url: finalBackCoverUrl,
        classification_number: classificationNumber.trim() || null,
        vendor_bill: vendorBill.trim() || null,
        price: price.trim() ? Number(price) : null,
        page_count: pageCount.trim() ? parseInt(pageCount, 10) : null,
        publisher: publisher.trim() || null,
      } as any);

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
      setDeweyDecimal("");
      setSummary("");
      setBackCoverFile(null);
      setClassificationNumber("");
      setVendorBill("");
      setPrice("");
      setPageCount("");
      setPublisher("");

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
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
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
            <Select value={category} onValueChange={handleCategoryChange} required>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {DEFAULT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
                {customCategories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
                <SelectItem value="__add_new__" className="text-primary font-medium">
                  + Add new category…
                </SelectItem>
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
            <Label htmlFor="dewey">Dewey Decimal Classification</Label>
            <Input
              id="dewey"
              value={deweyDecimal}
              onChange={(e) => setDeweyDecimal(e.target.value)}
              placeholder="e.g. 813.54 (auto-filled from category if blank)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="classification">Classification Number</Label>
            <Input
              id="classification"
              value={classificationNumber}
              onChange={(e) => setClassificationNumber(e.target.value)}
              placeholder="Library classification / accession number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="publisher">Publication Company</Label>
            <Input
              id="publisher"
              value={publisher}
              onChange={(e) => setPublisher(e.target.value)}
              placeholder="Publisher name"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="pages">Page Numbers</Label>
              <Input
                id="pages"
                type="number"
                min="0"
                value={pageCount}
                onChange={(e) => setPageCount(e.target.value)}
                placeholder="e.g. 320"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price (₹)</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 450"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="vendorBill">Vendor's Bill</Label>
            <Input
              id="vendorBill"
              value={vendorBill}
              onChange={(e) => setVendorBill(e.target.value)}
              placeholder="Bill / invoice number or vendor reference"
            />
          </div>



          <div className="space-y-2">
            <Label>Book Cover</Label>
            <Tabs defaultValue="url" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="url">
                  <LinkIcon className="w-4 h-4 mr-2" />
                  URL
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
              <TabsContent value="camera" className="space-y-2">
                {coverFile && (
                  <img
                    src={URL.createObjectURL(coverFile)}
                    alt="Cover preview"
                    className="w-24 h-32 object-cover rounded-md border border-border"
                  />
                )}
                <Button type="button" variant="outline" className="w-full" onClick={() => setCoverCameraOpen(true)}>
                  <Camera className="w-4 h-4 mr-2" />
                  {coverFile ? "Retake Photo" : "Take Photo"}
                </Button>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-2">
            <Label htmlFor="summary">Book Summary</Label>
            <Textarea
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Short summary or description (auto-filled when found)"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Back Cover Photo</Label>
            <p className="text-xs text-muted-foreground">
              Take a photo of the back of the book so students can read the printed summary.
            </p>
            {backCoverFile && (
              <img
                src={URL.createObjectURL(backCoverFile)}
                alt="Back cover preview"
                className="w-24 h-32 object-cover rounded-md border border-border"
              />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setBackCoverCameraOpen(true)}>
                <Camera className="w-4 h-4 mr-2" />
                {backCoverFile ? "Retake Photo" : "Take Photo"}
              </Button>
              {backCoverFile && (
                <Button type="button" variant="ghost" size="icon" onClick={() => setBackCoverFile(null)}>
                  ✕
                </Button>
              )}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Adding..." : "Add Book"}
          </Button>
        </form>
      </DialogContent>
      <CameraCapture
        open={coverCameraOpen}
        onOpenChange={setCoverCameraOpen}
        onCapture={(f) => setCoverFile(f)}
        title="Take Book Cover Photo"
      />
      <CameraCapture
        open={backCoverCameraOpen}
        onOpenChange={setBackCoverCameraOpen}
        onCapture={(f) => setBackCoverFile(f)}
        title="Take Back Cover Photo"
      />
    </Dialog>
  );
}
