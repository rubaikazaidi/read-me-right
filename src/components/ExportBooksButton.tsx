import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getFineSettings, calculateFine } from "@/components/FineSettingsDialog";
import * as XLSX from "xlsx";

interface BookWithBorrower {
  id: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  status: string;
  borrowed_by: string | null;
  borrowed_at: string | null;
  due_date: string | null;
  borrower_name?: string;
  borrower_email?: string;
}

export const ExportBooksButton = () => {
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setExporting(true);
    try {
      // Fetch all books
      const { data: books, error: booksError } = await supabase
        .from("books")
        .select("*")
        .order("title");

      if (booksError) throw booksError;

      // Get unique borrower IDs
      const borrowerIds = [...new Set(books?.filter(b => b.borrowed_by).map(b => b.borrowed_by))] as string[];

      // Fetch borrower profiles
      let borrowerMap: Record<string, { full_name: string; email: string }> = {};
      if (borrowerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", borrowerIds);

        if (profiles) {
          borrowerMap = profiles.reduce((acc, profile) => {
            acc[profile.id] = { full_name: profile.full_name, email: profile.email || "" };
            return acc;
          }, {} as Record<string, { full_name: string; email: string }>);
        }
      }

      // Prepare export data
      const exportData = books?.map((book) => {
        const borrower = book.borrowed_by ? borrowerMap[book.borrowed_by] : null;
        const isLate = book.status === "late" || (book.due_date && new Date(book.due_date) < new Date() && book.status === "borrowed");
        
        let daysLate = 0;
        let fineAmount = 0;
        
        if (isLate && book.due_date) {
          const dueDate = new Date(book.due_date);
          const today = new Date();
          daysLate = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          fineAmount = calculateFine(book.due_date);
        }

        return {
          "Title": book.title,
          "Author": book.author,
          "ISBN": book.isbn,
          "Category": book.category,
          "Status": book.status.charAt(0).toUpperCase() + book.status.slice(1),
          "Borrowed By": borrower ? borrower.full_name : "-",
          "Borrower Email": borrower ? borrower.email : "-",
          "Borrowed At": book.borrowed_at ? new Date(book.borrowed_at).toLocaleDateString() : "-",
          "Due Date": book.due_date ? new Date(book.due_date).toLocaleDateString() : "-",
          "Days Late": isLate ? daysLate : "-",
          "Fine Due (₹)": isLate ? fineAmount : "-",
        };
      }) || [];

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Library Books");

      // Auto-size columns
      const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
        wch: Math.max(key.length, 15),
      }));
      worksheet["!cols"] = colWidths;

      // Generate filename with date
      const date = new Date().toISOString().split("T")[0];
      const filename = `library_books_${date}.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);

      toast({
        title: "Export Successful",
        description: `Exported ${exportData.length} books to ${filename}`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: error.message,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleExport} disabled={exporting}>
      <FileSpreadsheet className="h-4 w-4 mr-2" />
      {exporting ? "Exporting..." : "Export"}
    </Button>
  );
};
