import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Camera, X, QrCode, Barcode } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type ScanType = "qr" | "isbn";

export interface ScanResult {
  type: ScanType;
  value: string;
}

interface QRCodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (result: ScanResult) => void;
  title?: string;
  description?: string;
}

export function QRCodeScanner({ 
  open, 
  onOpenChange, 
  onScan,
  title = "Scan Book Code",
  description = "Point your camera at a QR code or ISBN barcode on the book."
}: QRCodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const [lastScanType, setLastScanType] = useState<ScanType | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);
  const isMountedRef = useRef(false);
  const isProcessingRef = useRef(false);
  const lastErrorAtRef = useRef(0);
  const { toast } = useToast();

  const startScanner = async () => {
    // Prevent multiple simultaneous starts and ensure component is mounted
    if (isStartingRef.current || !isMountedRef.current) {
      return;
    }
    
    // Check if element exists before attempting to start
    const element = document.getElementById("qr-reader");
    if (!element) {
      console.log("QR reader element not found, waiting...");
      return;
    }

    isStartingRef.current = true;
    
    try {
      // Configure to scan both QR codes and barcodes (ISBN-13, ISBN-10, EAN-13, CODE_128)
      const html5QrCode = new Html5Qrcode("qr-reader", {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
        verbose: false,
      });
      scannerRef.current = html5QrCode;

      const cameras = await Html5Qrcode.getCameras();
      if (cameras && cameras.length === 0) {
        setHasCamera(false);
        toast({
          variant: "destructive",
          title: "No camera found",
          description: "Please ensure your device has a camera and permissions are granted.",
        });
        isStartingRef.current = false;
        return;
      }

      // Prefer back camera on mobile devices
      const cameraId = cameras.find(c => c.label.toLowerCase().includes("back"))?.id || cameras[0].id;

      // Dynamically size scan box to viewport for higher-res capture
      const viewportW = Math.min(window.innerWidth, 640);
      const boxW = Math.max(240, Math.floor(viewportW * 0.8));
      const boxH = Math.floor(boxW * 0.55);

      await html5QrCode.start(
        { facingMode: { ideal: "environment" } } as any,
        {
          fps: 30,
          qrbox: { width: boxW, height: boxH },
          aspectRatio: 1.7777,
          disableFlip: true,
          videoConstraints: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
            advanced: [
              { focusMode: "continuous" },
              { exposureMode: "continuous" },
              { whiteBalanceMode: "continuous" },
            ],
          } as any,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        } as any,
        (decodedText, decodedResult) => {
          const format = decodedResult.result.format?.formatName;
          handleCodeScanned(decodedText, format);
        },
        () => {
          // Code scanning in progress (no match yet)
        }
      );

      if (isMountedRef.current) {
        setIsScanning(true);
      }
    } catch (err: any) {
      console.error("Error starting scanner:", err);
      // Only show toast if component is still mounted and not a "not found" error
      if (isMountedRef.current && !err.message?.includes("not found")) {
        toast({
          variant: "destructive",
          title: "Camera Error",
          description: err.message || "Failed to start camera. Please check permissions.",
        });
      }
    } finally {
      isStartingRef.current = false;
    }
  };

  const stopScanner = async () => {
    const instance = scannerRef.current;
    if (!instance) {
      setIsScanning(false);
      return;
    }
    scannerRef.current = null;
    try {
      // Only stop if it's actually scanning to avoid throwing
      const state = instance.getState?.();
      // 2 === SCANNING in Html5QrcodeScannerState
      if (state === 2) {
        await instance.stop();
      }
      try { instance.clear(); } catch {}
    } catch (err) {
      console.warn("Scanner stop warning:", err);
    } finally {
      if (isMountedRef.current) setIsScanning(false);
    }
  };

  const handleCodeScanned = async (decodedText: string, format?: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    await stopScanner();

    const isBarcode = ["EAN_13", "EAN_8", "CODE_128", "CODE_39", "UPC_A", "UPC_E"].includes(format || "");
    const isQRCode = format === "QR_CODE";

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const trimmed = decodedText.trim();
    const cleanedCode = trimmed.replace(/[-\s]/g, "");

    // Try to extract a UUID from QR codes or URL-like content
    if (isQRCode || trimmed.includes("/book/")) {
      let bookId = trimmed;
      if (trimmed.includes("/book/")) {
        const parts = trimmed.split("/book/");
        bookId = parts[parts.length - 1].split(/[?#]/)[0];
      }
      if (uuidRegex.test(bookId)) {
        setLastScanType("qr");
        onScan({ type: "qr", value: bookId });
        onOpenChange(false);
        return;
      }
    }

    // Accept any numeric barcode with 8+ digits (ISBN, EAN, UPC, or other book identifiers)
    if (isBarcode || /^\d{8,}$/.test(cleanedCode)) {
      setLastScanType("isbn");
      onScan({ type: "isbn", value: cleanedCode });
      onOpenChange(false);
      return;
    }

    // Last-ditch: UUID anywhere in the text
    if (uuidRegex.test(trimmed)) {
      setLastScanType("qr");
      onScan({ type: "qr", value: trimmed });
      onOpenChange(false);
      return;
    }

    // Unrecognized — show toast at most once every 3s and resume scanning
    const now = Date.now();
    if (now - lastErrorAtRef.current > 3000) {
      lastErrorAtRef.current = now;
      toast({
        variant: "destructive",
        title: "Unrecognized Code",
        description: "Could not identify this as a book QR code or barcode.",
      });
    }
    isProcessingRef.current = false;
    if (isMountedRef.current) {
      setTimeout(() => {
        if (isMountedRef.current && !scannerRef.current) startScanner();
      }, 800);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    
    if (open) {
      setLastScanType(null);
      isProcessingRef.current = false;
      lastErrorAtRef.current = 0;
      // Small delay to ensure the DOM element is rendered
      setTimeout(() => {
        if (isMountedRef.current) {
          startScanner();
        }
      }, 200);
    } else {
      stopScanner();
    }

    return () => {
      isMountedRef.current = false;
      isStartingRef.current = false;
      stopScanner();
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Supported formats indicator */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <QrCode className="h-4 w-4" />
              <span>QR Code</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1">
              <Barcode className="h-4 w-4" />
              <span>ISBN Barcode</span>
            </div>
          </div>

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
                style={{ minHeight: "280px" }}
              />
              {!isScanning && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
                  <p className="text-muted-foreground">Starting camera...</p>
                </div>
              )}
              
              {/* Scan target overlay */}
              {isScanning && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="border-2 border-primary/50 rounded-lg w-[280px] h-[180px] animate-pulse" />
                </div>
              )}
            </div>
          )}

          {lastScanType && (
            <div className="flex items-center justify-center">
              <Badge variant="outline" className="gap-1">
                {lastScanType === "qr" ? (
                  <>
                    <QrCode className="h-3 w-3" />
                    QR Code Detected
                  </>
                ) : (
                  <>
                    <Barcode className="h-3 w-3" />
                    ISBN Barcode Detected
                  </>
                )}
              </Badge>
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
