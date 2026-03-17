import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Book } from "@/types/book";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Newspaper, GraduationCap, Atom, Landmark, Cpu, User, Layers } from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  BookOpen,
  Newspaper,
  GraduationCap,
  Atom,
  Landmark,
  Cpu,
  User,
  Layers,
};

interface CategoryTilesProps {
  books: Book[];
}

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export function CategoryTiles({ books }: CategoryTilesProps) {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from("book_categories")
      .select("id, name, icon, color")
      .order("name");
    if (data) setCategories(data);
  };

  const getBookCount = (categoryName: string) => {
    return books.filter(
      (b) => b.category?.toLowerCase() === categoryName.toLowerCase()
    ).length;
  };

  const getAvailableCount = (categoryName: string) => {
    return books.filter(
      (b) =>
        b.category?.toLowerCase() === categoryName.toLowerCase() &&
        b.status === "available"
    ).length;
  };

  // Filter categories that have books or are default
  const displayCategories = categories.filter(
    (cat) => getBookCount(cat.name) > 0 || !cat.color.includes("0%")
  );

  // Also check for books with categories not in our list
  const knownNames = new Set(categories.map((c) => c.name.toLowerCase()));
  const unknownCategories = [
    ...new Set(
      books
        .map((b) => b.category)
        .filter((c) => c && !knownNames.has(c.toLowerCase()))
    ),
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {displayCategories.map((cat) => {
        const IconComp = iconMap[cat.icon] || BookOpen;
        const count = getBookCount(cat.name);
        const available = getAvailableCount(cat.name);

        return (
          <Card
            key={cat.id}
            className="cursor-pointer group hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/30 overflow-hidden"
            onClick={() => navigate(`/category/${encodeURIComponent(cat.name)}`)}
          >
            <CardContent className="p-6 flex flex-col items-center text-center gap-3">
              <div
                className="p-4 rounded-xl transition-transform group-hover:scale-110"
                style={{
                  backgroundColor: `hsl(${cat.color} / 0.15)`,
                  color: `hsl(${cat.color})`,
                }}
              >
                <IconComp className="h-8 w-8" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{cat.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {count} {count === 1 ? "book" : "books"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {available} available
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {unknownCategories.map((catName) => {
        const count = getBookCount(catName!);
        const available = getAvailableCount(catName!);

        return (
          <Card
            key={catName}
            className="cursor-pointer group hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/30 overflow-hidden"
            onClick={() =>
              navigate(`/category/${encodeURIComponent(catName!)}`)
            }
          >
            <CardContent className="p-6 flex flex-col items-center text-center gap-3">
              <div className="p-4 rounded-xl bg-muted transition-transform group-hover:scale-110">
                <Layers className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{catName}</h3>
                <p className="text-sm text-muted-foreground">
                  {count} {count === 1 ? "book" : "books"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {available} available
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
