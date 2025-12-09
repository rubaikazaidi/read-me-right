import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface FineSettings {
  firstDayFine: number;
  additionalDayFine: number;
}

const FINE_SETTINGS_KEY = "library_fine_settings";

export const getFineSettings = (): FineSettings => {
  const stored = localStorage.getItem(FINE_SETTINGS_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  return { firstDayFine: 0, additionalDayFine: 0 };
};

export const calculateFine = (dueDate: string): number => {
  const settings = getFineSettings();
  const now = new Date();
  const due = new Date(dueDate);
  
  if (now <= due) return 0;
  
  const diffTime = now.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) return 0;
  if (diffDays === 1) return settings.firstDayFine;
  
  return settings.firstDayFine + (diffDays - 1) * settings.additionalDayFine;
};

export function FineSettingsDialog() {
  const [open, setOpen] = useState(false);
  const [firstDayFine, setFirstDayFine] = useState("");
  const [additionalDayFine, setAdditionalDayFine] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const settings = getFineSettings();
    setFirstDayFine(settings.firstDayFine.toString());
    setAdditionalDayFine(settings.additionalDayFine.toString());
  }, [open]);

  const handleSave = () => {
    const settings: FineSettings = {
      firstDayFine: parseFloat(firstDayFine) || 0,
      additionalDayFine: parseFloat(additionalDayFine) || 0,
    };
    
    localStorage.setItem(FINE_SETTINGS_KEY, JSON.stringify(settings));
    
    toast({
      title: "Settings Saved",
      description: "Fine calculation settings have been updated.",
    });
    
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Settings className="h-4 w-4 mr-2" />
          Fine Settings
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure Late Fine Calculations</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="firstDayFine">First Day Fine Amount</Label>
            <Input
              id="firstDayFine"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g., 5.00"
              value={firstDayFine}
              onChange={(e) => setFirstDayFine(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Fine charged for the first day a book is late
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="additionalDayFine">Additional Day Fine Amount</Label>
            <Input
              id="additionalDayFine"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g., 2.00"
              value={additionalDayFine}
              onChange={(e) => setAdditionalDayFine(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Fine charged for each additional day after the first
            </p>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-1">Example Calculation:</p>
            <p className="text-xs text-muted-foreground">
              If a book is 3 days late with first day fine of ${parseFloat(firstDayFine) || 0} and additional day fine of ${parseFloat(additionalDayFine) || 0}:
            </p>
            <p className="text-sm font-semibold mt-1">
              Total Fine: ${((parseFloat(firstDayFine) || 0) + 2 * (parseFloat(additionalDayFine) || 0)).toFixed(2)}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
