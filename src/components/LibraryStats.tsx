import { Book } from "@/types/book";
import { BookOpen, CheckCircle2, Clock, AlertCircle, History } from "lucide-react";
import { BorrowingHistoryDialog } from "./BorrowingHistoryDialog";

interface LibraryStatsProps {
  books: Book[];
  onFilterChange?: (filter: string) => void;
  activeFilter?: string;
  userRole?: string;
  userId?: string;
}

export function LibraryStats({ books, onFilterChange, activeFilter, userRole, userId }: LibraryStatsProps) {
  const totalBooks = books.length;
  const availableBooks = books.filter((b) => b.status === "available").length;
  const borrowedOnlyBooks = books.filter((b) => b.status === "borrowed").length;
  const lateBooks = books.filter((b) => b.status === "late").length;
  
  // For students, borrowed count includes late books since they don't see the late category
  const borrowedBooks = userRole === "student" 
    ? borrowedOnlyBooks + lateBooks 
    : borrowedOnlyBooks;

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

  const visibleStats = userRole === "student" 
    ? stats.filter((stat) => stat.filter !== "late") 
    : stats;

  return (
    <div className={`grid grid-cols-2 ${userRole === "student" ? "lg:grid-cols-4" : "lg:grid-cols-4"} gap-4`}>
      {visibleStats.map((stat) => {
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

      {/* Previously Borrowed tile for students */}
      {userRole === "student" && (
        <BorrowingHistoryDialog
          trigger={
            <div className="bg-card rounded-lg p-6 shadow-sm border transition-all hover:shadow-md cursor-pointer border-border">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-secondary/50">
                  <History className="w-6 h-6 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">View</p>
                  <p className="text-sm text-muted-foreground">Previously Borrowed</p>
                </div>
              </div>
            </div>
          }
        />
      )}
    </div>
  );
}
