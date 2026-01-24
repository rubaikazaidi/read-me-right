import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Camera, X } from "lucide-react";

interface QRCodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (bookId: string) => void;
}

export function QRCodeScanner({ open, onOpenChange, onScan }: QRCodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const { toast } = useToast();

  const startScanner = async () => {
    try {
      const html5QrCode = new Html5Qrcode("qr-reader");
      scannerRef.current = html5QrCode;

      const cameras = await Html5Qrcode.getCameras();
      if (cameras && cameras.length === 0) {
        setHasCamera(false);
        toast({
          variant: "destructive",
          title: "No camera found",
          description: "Please ensure your device has a camera and permissions are granted.",
        });
        return;
      }

      // Prefer back camera on mobile devices
      const cameraId = cameras.find(c => c.label.toLowerCase().includes("back"))?.id || cameras[0].id;

      await html5QrCode.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // QR code detected - extract book ID
          handleQRCodeScanned(decodedText);
        },
        () => {
          // QR code scanning in progress (no match yet)
        }
      );

      setIsScanning(true);
    } catch (err: any) {
      console.error("Error starting scanner:", err);
      toast({
        variant: "destructive",
        title: "Camera Error",
        description: err.message || "Failed to start camera. Please check permissions.",
      });
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
        setIsScanning(false);
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
  };

  const handleQRCodeScanned = async (decodedText: string) => {
    await stopScanner();
    
    // The QR code should contain just the book ID (UUID format)
    // Or it could be a URL like: https://example.com/book/{bookId}
    let bookId = decodedText;
    
    // If it's a URL, extract the book ID from it
    if (decodedText.includes("/book/")) {
      const parts = decodedText.split("/book/");
      bookId = parts[parts.length - 1];
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(bookId)) {
      toast({
        variant: "destructive",
        title: "Invalid QR Code",
        description: "This QR code is not a valid book identifier.",
      });
      // Restart scanner to try again
      startScanner();
      return;
    }

    onScan(bookId);
    onOpenChange(false);
  };

  useEffect(() => {
    if (open) {
      // Small delay to ensure the DOM element is rendered
      setTimeout(() => {
        startScanner();
      }, 100);
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Scan Book QR Code
          </DialogTitle>
          <DialogDescription>
            Point your camera at the QR code on the book to scan it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!hasCamera ? (
            <div className="text-center py-8 text-muted-foreground">
              <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No camera available.</p>
              <p className="text-sm">Please ensure camera permissions are granted.</p>
            </div>
          ) : (
            <div className="relative">
              <div
                id="qr-reader"
                className="w-full rounded-lg overflow-hidden bg-muted"
                style={{ minHeight: "300px" }}
              />
              {!isScanning && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
                  <p className="text-muted-foreground">Starting camera...</p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
