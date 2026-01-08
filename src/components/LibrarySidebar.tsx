import { Book } from "@/types/book";
import { BookOpen, CheckCircle2, Clock, AlertCircle, History, Menu } from "lucide-react";
import { BorrowingHistoryDialog } from "./BorrowingHistoryDialog";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

interface LibrarySidebarProps {
  books: Book[];
  onFilterChange?: (filter: string) => void;
  activeFilter?: string;
  userRole?: string;
  userId?: string;
  children: React.ReactNode;
}

function SidebarStats({ books, onFilterChange, activeFilter, userRole }: Omit<LibrarySidebarProps, "children" | "userId">) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  
  const totalBooks = books.length;
  const availableBooks = books.filter((b) => b.status === "available").length;
  const borrowedOnlyBooks = books.filter((b) => b.status === "borrowed").length;
  const lateBooks = books.filter((b) => b.status === "late").length;
  
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
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {!isCollapsed && "Library Stats"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleStats.map((stat) => {
                const Icon = stat.icon;
                const isActive = activeFilter === stat.filter;
                return (
                  <SidebarMenuItem key={stat.label}>
                    <SidebarMenuButton
                      onClick={() => onFilterChange?.(stat.filter)}
                      isActive={isActive}
                      tooltip={`${stat.label}: ${stat.value}`}
                      className={`w-full ${isCollapsed ? 'justify-center px-0' : 'justify-start px-4'} gap-3 py-3 ${
                        isActive ? "bg-primary/10 text-primary" : ""
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${stat.bgColor} ${isCollapsed ? 'mx-auto' : ''}`}>
                        <Icon className={`w-4 h-4 ${stat.color}`} />
                      </div>
                      {!isCollapsed && (
                        <div className="flex flex-1 items-center justify-between">
                          <span className="text-sm font-medium">{stat.label}</span>
                          <span className={`text-sm font-bold ${stat.color}`}>{stat.value}</span>
                        </div>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {/* Previously Borrowed for students */}
              {userRole === "student" && (
                <SidebarMenuItem>
                  <BorrowingHistoryDialog
                    trigger={
                      <SidebarMenuButton
                        tooltip="Previously Borrowed"
                        className={`w-full ${isCollapsed ? 'justify-center px-0' : 'justify-start px-4'} gap-3 py-3`}
                      >
                        <div className={`p-2 rounded-lg bg-secondary/50 ${isCollapsed ? 'mx-auto' : ''}`}>
                          <History className="w-4 h-4 text-secondary-foreground" />
                        </div>
                        {!isCollapsed && (
                          <div className="flex flex-1 items-center justify-between">
                            <span className="text-sm font-medium">Previously Borrowed</span>
                            <span className="text-sm font-bold text-muted-foreground">View</span>
                          </div>
                        )}
                      </SidebarMenuButton>
                    }
                  />
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export function LibrarySidebar({ books, onFilterChange, activeFilter, userRole, userId, children }: LibrarySidebarProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full">
        <SidebarStats 
          books={books} 
          onFilterChange={onFilterChange} 
          activeFilter={activeFilter} 
          userRole={userRole} 
        />
        <div className="flex-1 flex flex-col">
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
}

export function SidebarToggle() {
  return (
    <SidebarTrigger className="h-9 w-9">
      <Menu className="h-5 w-5" />
    </SidebarTrigger>
  );
}
