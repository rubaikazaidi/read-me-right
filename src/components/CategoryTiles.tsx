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

// Subtle SVG patterns per category — inline data URIs for lightweight textures
const patternMap: Record<string, (color: string) => string> = {
  Fiction: (c) =>
    `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 20 Q10 10 20 20 Q30 30 40 20' fill='none' stroke='hsl(${encodeURIComponent(c)}/.22)' stroke-width='2'/%3E%3Cpath d='M0 30 Q10 20 20 30 Q30 40 40 30' fill='none' stroke='hsl(${encodeURIComponent(c)}/.16)' stroke-width='1.5'/%3E%3Cpath d='M0 10 Q10 0 20 10 Q30 20 40 10' fill='none' stroke='hsl(${encodeURIComponent(c)}/.12)' stroke-width='1'/%3E%3C/svg%3E")`,
  "Non-Fiction": (c) =>
    `url("data:image/svg+xml,%3Csvg width='32' height='32' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='2' y='2' width='12' height='12' rx='2' fill='hsl(${encodeURIComponent(c)}/.06)' stroke='hsl(${encodeURIComponent(c)}/.18)' stroke-width='1.5'/%3E%3Crect x='18' y='18' width='12' height='12' rx='2' fill='hsl(${encodeURIComponent(c)}/.04)' stroke='hsl(${encodeURIComponent(c)}/.14)' stroke-width='1.5'/%3E%3C/svg%3E")`,
  Textbooks: (c) =>
    `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cline x1='0' y1='10' x2='40' y2='10' stroke='hsl(${encodeURIComponent(c)}/.16)' stroke-width='1.5'/%3E%3Cline x1='0' y1='20' x2='40' y2='20' stroke='hsl(${encodeURIComponent(c)}/.16)' stroke-width='1.5'/%3E%3Cline x1='0' y1='30' x2='40' y2='30' stroke='hsl(${encodeURIComponent(c)}/.16)' stroke-width='1.5'/%3E%3Cline x1='8' y1='0' x2='8' y2='40' stroke='hsl(${encodeURIComponent(c)}/.10)' stroke-width='1'/%3E%3C/svg%3E")`,
  Science: (c) =>
    `url("data:image/svg+xml,%3Csvg width='48' height='48' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='24' cy='24' r='8' fill='none' stroke='hsl(${encodeURIComponent(c)}/.18)' stroke-width='1.5'/%3E%3Ccircle cx='24' cy='24' r='16' fill='none' stroke='hsl(${encodeURIComponent(c)}/.12)' stroke-width='1'/%3E%3Ccircle cx='24' cy='24' r='3' fill='hsl(${encodeURIComponent(c)}/.15)'/%3E%3Cline x1='24' y1='8' x2='24' y2='16' stroke='hsl(${encodeURIComponent(c)}/.10)' stroke-width='1'/%3E%3C/svg%3E")`,
  History: (c) =>
    `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0 L20 20 L40 0' fill='none' stroke='hsl(${encodeURIComponent(c)}/.18)' stroke-width='1.5'/%3E%3Cpath d='M0 20 L20 40 L40 20' fill='none' stroke='hsl(${encodeURIComponent(c)}/.12)' stroke-width='1.5'/%3E%3C/svg%3E")`,
  Technology: (c) =>
    `url("data:image/svg+xml,%3Csvg width='36' height='36' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='4' y='4' width='10' height='10' fill='hsl(${encodeURIComponent(c)}/.10)'/%3E%3Crect x='22' y='4' width='10' height='10' fill='hsl(${encodeURIComponent(c)}/.07)'/%3E%3Crect x='4' y='22' width='10' height='10' fill='hsl(${encodeURIComponent(c)}/.07)'/%3E%3Crect x='22' y='22' width='10' height='10' fill='hsl(${encodeURIComponent(c)}/.10)'/%3E%3Cline x1='14' y1='9' x2='22' y2='9' stroke='hsl(${encodeURIComponent(c)}/.12)' stroke-width='1'/%3E%3Cline x1='18' y1='14' x2='18' y2='22' stroke='hsl(${encodeURIComponent(c)}/.12)' stroke-width='1'/%3E%3C/svg%3E")`,
  Biography: (c) =>
    `url("data:image/svg+xml,%3Csvg width='44' height='44' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M22 4 C28 10 36 14 36 22 C36 30 28 36 22 40 C16 36 8 30 8 22 C8 14 16 10 22 4Z' fill='hsl(${encodeURIComponent(c)}/.06)' stroke='hsl(${encodeURIComponent(c)}/.18)' stroke-width='1.5'/%3E%3C/svg%3E")`,
  Other: (c) =>
    `url("data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='10' cy='10' r='2' fill='hsl(${encodeURIComponent(c)}/.18)'/%3E%3C/svg%3E")`,
};

const getPattern = (name: string, color: string) => {
  const patternFn = patternMap[name] || patternMap["Other"];
  return patternFn(color);
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

  const displayCategories = categories.filter(
    (cat) => getBookCount(cat.name) > 0 || !cat.color.includes("0%")
  );

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
            className="cursor-pointer group hover:shadow-lg transition-all duration-300 border hover:border-primary/20 overflow-hidden relative"
            onClick={() => navigate(`/category/${encodeURIComponent(cat.name)}`)}
            style={{
              background: `${getPattern(cat.name, cat.color)}, linear-gradient(145deg, hsl(${cat.color} / 0.12) 0%, hsl(${cat.color} / 0.04) 100%)`,
            }}
          >
            {/* Subtle corner accent */}
            <div
              className="absolute top-0 right-0 w-16 h-16 opacity-30 rounded-bl-[3rem] transition-opacity group-hover:opacity-50"
              style={{ backgroundColor: `hsl(${cat.color} / 0.1)` }}
            />
            <CardContent className="p-6 flex flex-col items-center text-center gap-3 relative z-[1]">
              <div
                className="p-4 rounded-xl transition-all duration-300 group-hover:scale-105 group-hover:shadow-md"
                style={{
                  backgroundColor: `hsl(${cat.color} / 0.12)`,
                  color: `hsl(${cat.color})`,
                  boxShadow: `0 2px 8px hsl(${cat.color} / 0.08)`,
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
        const fallbackColor = "0 0% 50%";

        return (
          <Card
            key={catName}
            className="cursor-pointer group hover:shadow-lg transition-all duration-300 border hover:border-primary/20 overflow-hidden relative"
            onClick={() =>
              navigate(`/category/${encodeURIComponent(catName!)}`)
            }
            style={{
              background: `${getPattern("Other", fallbackColor)}, linear-gradient(145deg, hsl(${fallbackColor} / 0.06) 0%, hsl(${fallbackColor} / 0.02) 100%)`,
            }}
          >
            <div
              className="absolute top-0 right-0 w-16 h-16 opacity-30 rounded-bl-[3rem]"
              style={{ backgroundColor: `hsl(${fallbackColor} / 0.1)` }}
            />
            <CardContent className="p-6 flex flex-col items-center text-center gap-3 relative z-[1]">
              <div className="p-4 rounded-xl bg-muted transition-all duration-300 group-hover:scale-105 group-hover:shadow-md">
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
