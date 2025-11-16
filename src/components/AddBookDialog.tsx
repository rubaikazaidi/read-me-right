import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Book, BookStatus } from "@/types/book";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface AddBookDialogProps {
  onAddBook: (book: Book) => void;
}

export function AddBookDialog({ onAddBook }: AddBookDialogProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    author: "",
    isbn: "",
    coverUrl: "",
    status: "available" as BookStatus,
    borrowedBy: "",
    dueDate: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.author) {
      toast.error("Please fill in required fields");
      return;
    }

    const newBook: Book = {
      id: Date.now().toString(),
      title: formData.title,
      author: formData.author,
      isbn: formData.isbn || undefined,
      coverUrl: formData.coverUrl || undefined,
      status: formData.status,
      borrowedBy: formData.borrowedBy || undefined,
      dueDate: formData.dueDate || undefined,
      addedDate: new Date().toISOString(),
    };

    onAddBook(newBook);
    toast.success("Book added successfully!");
    setOpen(false);
    setFormData({
      title: "",
      author: "",
      isbn: "",
      coverUrl: "",
      status: "available",
      borrowedBy: "",
      dueDate: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2">
          <Plus className="w-5 h-5" />
          Add New Book
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Book</DialogTitle>
          <DialogDescription>
            Add a new book to your library collection. Fill in the details below.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Enter book title"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="author">
                Author <span className="text-destructive">*</span>
              </Label>
              <Input
                id="author"
                value={formData.author}
                onChange={(e) =>
                  setFormData({ ...formData, author: e.target.value })
                }
                placeholder="Enter author name"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="isbn">ISBN</Label>
              <Input
                id="isbn"
                value={formData.isbn}
                onChange={(e) =>
                  setFormData({ ...formData, isbn: e.target.value })
                }
                placeholder="Enter ISBN number"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="coverUrl">Cover Image URL</Label>
              <Input
                id="coverUrl"
                value={formData.coverUrl}
                onChange={(e) =>
                  setFormData({ ...formData, coverUrl: e.target.value })
                }
                placeholder="https://example.com/cover.jpg"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: BookStatus) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="borrowed">Borrowed</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.status !== "available" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="borrowedBy">Borrowed By</Label>
                  <Input
                    id="borrowedBy"
                    value={formData.borrowedBy}
                    onChange={(e) =>
                      setFormData({ ...formData, borrowedBy: e.target.value })
                    }
                    placeholder="Enter borrower name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) =>
                      setFormData({ ...formData, dueDate: e.target.value })
                    }
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="submit">Add Book</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
