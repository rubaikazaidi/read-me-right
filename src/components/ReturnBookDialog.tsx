import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";

interface ReturnBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookTitle?: string;
  submitting?: boolean;
  onConfirm: (opts: { isDamaged: boolean; damageNotes: string }) => void | Promise<void>;
}

export function ReturnBookDialog({
  open,
  onOpenChange,
  bookTitle,
  submitting,
  onConfirm,
}: ReturnBookDialogProps) {
  const [isDamaged, setIsDamaged] = useState(false);
  const [damageNotes, setDamageNotes] = useState("");

  useEffect(() => {
    if (open) {
      setIsDamaged(false);
      setDamageNotes("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Return Book</DialogTitle>
          <DialogDescription>
            {bookTitle ? `Confirm return of "${bookTitle}".` : "Confirm the book return."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5 pr-3">
              <Label htmlFor="damaged-toggle" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-status-late" />
                Returned damaged?
              </Label>
              <p className="text-xs text-muted-foreground">
                Mark this copy as damaged so it is flagged in the catalog.
              </p>
            </div>
            <Switch
              id="damaged-toggle"
              checked={isDamaged}
              onCheckedChange={setIsDamaged}
            />
          </div>

          {isDamaged && (
            <div className="space-y-2">
              <Label htmlFor="damage-notes">Damage details</Label>
              <Textarea
                id="damage-notes"
                placeholder="Describe the damage (e.g. torn pages, water damage, missing cover...)"
                value={damageNotes}
                onChange={(e) => setDamageNotes(e.target.value)}
                rows={4}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm({ isDamaged, damageNotes: damageNotes.trim() })}
            disabled={submitting || (isDamaged && damageNotes.trim().length === 0)}
          >
            {submitting ? "Returning..." : "Confirm Return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
