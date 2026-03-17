import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Tags } from "lucide-react";

interface Category {
  id: string;
  name: string;
}

export function ManageCategoriesDialog() {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) fetchCategories();
  }, [open]);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from("book_categories")
      .select("id, name")
      .order("name");
    if (data) setCategories(data);
  };

  const handleAdd = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("book_categories")
        .insert({ name: trimmed });

      if (error) throw error;
      toast({ title: "Category Added", description: `"${trimmed}" has been added.` });
      setNewCategoryName("");
      fetchCategories();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from("book_categories")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Category Removed", description: `"${name}" has been removed.` });
      fetchCategories();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 w-full px-2 py-1.5 text-sm cursor-pointer">
          <Tags className="h-4 w-4" />
          Manage Categories
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Book Categories</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mt-4">
          <Input
            placeholder="New category name..."
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button onClick={handleAdd} disabled={loading || !newCategoryName.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>

        <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center justify-between p-3 border rounded-lg bg-card"
            >
              <span className="text-sm font-medium text-foreground">{cat.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(cat.id, cat.name)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No categories yet</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
