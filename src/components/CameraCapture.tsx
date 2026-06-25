import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, RotateCcw, Check, X } from "lucide-react";
import { toast } from "sonner";

interface CameraCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
  title?: string;
}

export function CameraCapture({ open, onOpenChange, onCapture, title = "Take Photo" }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [starting, setStarting] = useState(false);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startCamera = async () => {
    setStarting(true);
    try {
      stopStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      toast.error("Camera unavailable", { description: err?.message || "Please grant camera permission." });
      onOpenChange(false);
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    if (open) {
      setPreviewUrl(null);
      setCapturedBlob(null);
      startCamera();
    } else {
      stopStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    }
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const takeShot = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      toast.error("Camera not ready yet");
      return;
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setCapturedBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        stopStream();
      },
      "image/jpeg",
      0.9
    );
  };

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setCapturedBlob(null);
    startCamera();
  };

  const confirm = () => {
    if (!capturedBlob) return;
    const file = new File([capturedBlob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
    onCapture(file);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Position the book within the frame and capture.</DialogDescription>
        </DialogHeader>
        <div className="relative w-full aspect-[3/4] bg-black rounded-md overflow-hidden">
          {!previewUrl ? (
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />
          ) : (
            <img src={previewUrl} alt="Captured" className="w-full h-full object-cover" />
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>
        <div className="flex gap-2 justify-center">
          {!previewUrl ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                <X className="w-4 h-4 mr-2" />Cancel
              </Button>
              <Button type="button" onClick={takeShot} disabled={starting}>
                <Camera className="w-4 h-4 mr-2" />Capture
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={retake}>
                <RotateCcw className="w-4 h-4 mr-2" />Retake
              </Button>
              <Button type="button" onClick={confirm}>
                <Check className="w-4 h-4 mr-2" />Use Photo
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
