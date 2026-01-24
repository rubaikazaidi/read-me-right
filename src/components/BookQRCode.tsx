import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";

interface BookQRCodeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
}

export function BookQRCode({ open, onOpenChange, bookId, bookTitle, bookAuthor }: BookQRCodeProps) {
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>QR Code - ${bookTitle}</title>
            <style>
              body {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                font-family: system-ui, sans-serif;
                padding: 20px;
              }
              .qr-container {
                text-align: center;
                padding: 24px;
                border: 2px solid #e5e7eb;
                border-radius: 12px;
              }
              h1 {
                font-size: 18px;
                margin: 0 0 4px 0;
              }
              p {
                font-size: 14px;
                color: #6b7280;
                margin: 0 0 16px 0;
              }
              svg {
                margin: 16px 0;
              }
              .book-id {
                font-size: 10px;
                color: #9ca3af;
                word-break: break-all;
              }
            </style>
          </head>
          <body>
            <div class="qr-container">
              <h1>${bookTitle}</h1>
              <p>by ${bookAuthor}</p>
              ${document.getElementById("book-qr-svg")?.outerHTML || ""}
              <p class="book-id">ID: ${bookId}</p>
            </div>
            <script>
              window.onload = function() {
                window.print();
                window.close();
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleDownload = () => {
    const svg = document.getElementById("book-qr-svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);

      const link = document.createElement("a");
      link.download = `qr-${bookTitle.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Book QR Code</DialogTitle>
          <DialogDescription>
            Scan this QR code to quickly issue or return "{bookTitle}".
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-4">
          <div className="p-6 bg-white rounded-lg border">
            <QRCodeSVG
              id="book-qr-svg"
              value={bookId}
              size={200}
              level="H"
              includeMargin
            />
          </div>

          <div className="text-center">
            <p className="font-semibold">{bookTitle}</p>
            <p className="text-sm text-muted-foreground">by {bookAuthor}</p>
            <p className="text-xs text-muted-foreground mt-1 font-mono">{bookId}</p>
          </div>

          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button variant="outline" className="flex-1" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
