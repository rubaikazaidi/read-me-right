import { Book } from "@/types/book";
import { BookOpen, CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface LibraryStatsProps {
  books: Book[];
  onFilterChange?: (filter: string) => void;
  activeFilter?: string;
}

export function LibraryStats({ books, onFilterChange, activeFilter }: LibraryStatsProps) {
  const totalBooks = books.length;
  const availableBooks = books.filter((b) => b.status === "available").length;
  const borrowedBooks = books.filter((b) => b.status === "borrowed").length;
  const lateBooks = books.filter((b) => b.status === "late").length;

  const stats = [
    {
      label: "Total Books",
      value: totalBooks,
      icon: BookOpen,
      color: "text-primary",
      bgColor: "bg-primary/10",
      filter: "all",
    },
    {
      label: "Available",
      value: availableBooks,
      icon: CheckCircle2,
      color: "text-status-available",
      bgColor: "bg-status-available/10",
      filter: "available",
    },
    {
      label: "Borrowed",
      value: borrowedBooks,
      icon: Clock,
      color: "text-status-borrowed",
      bgColor: "bg-status-borrowed/10",
      filter: "borrowed",
    },
    {
      label: "Late",
      value: lateBooks,
      icon: AlertCircle,
      color: "text-status-late",
      bgColor: "bg-status-late/10",
      filter: "late",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const isActive = activeFilter === stat.filter;
        return (
          <div
            key={stat.label}
            onClick={() => onFilterChange?.(stat.filter)}
            className={`bg-card rounded-lg p-6 shadow-sm border transition-all hover:shadow-md cursor-pointer ${
              isActive ? "ring-2 ring-primary border-primary" : "border-border"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                <Icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
