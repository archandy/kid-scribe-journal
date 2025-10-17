import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, Database, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface ReviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stepAnswers: string[];
  prompts: string[];
  duration: number;
  onSaved: () => void;
}

const CHILDREN = ["Hana", "Sena"];

const ReviewSheet = ({
  open,
  onOpenChange,
  stepAnswers,
  prompts,
  duration,
  onSaved,
}: ReviewSheetProps) => {
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [summary, setSummary] = useState("");
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // Generate summary when sheet opens
  useEffect(() => {
    if (open && stepAnswers.every(a => a)) {
      generateSummary();
    }
  }, [open, stepAnswers]);

  const generateSummary = async () => {
    setIsGeneratingSummary(true);
    try {
      const combinedText = stepAnswers.map((answer, i) => 
        `${prompts[i]}: ${answer}`
      ).join('\n\n');

      const { data, error } = await supabase.functions.invoke('generate-summary', {
        body: { transcript: combinedText },
      });

      if (error) throw error;
      
      if (data?.summary) {
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      toast.error("Failed to generate summary");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const toggleChild = (child: string) => {
    setSelectedChildren(prev =>
      prev.includes(child) ? prev.filter(c => c !== child) : [...prev, child]
    );
  };

  const saveToNotion = async () => {
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Please sign in to save to Notion");
        return;
      }

      const structuredContent = {
        whatHappened: stepAnswers[0],
        howTheyBehaved: stepAnswers[1],
        whatThatShows: stepAnswers[2]
      };

      const { data, error } = await supabase.functions.invoke('save-to-notion', {
        body: {
          structuredContent,
          summary,
          children: selectedChildren.length > 0 ? selectedChildren : undefined,
          duration,
        },
      });

      if (error) {
        throw error;
      }

      toast.success("Saved to Notion successfully!", {
        description: data?.url ? "Click to open in Notion" : undefined,
        action: data?.url ? {
          label: "Open",
          onClick: () => window.open(data.url, '_blank'),
        } : undefined,
      });
      
      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving to Notion:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save to Notion';
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Review & Save</SheetTitle>
          <SheetDescription>
            Review your reflection and save to Notion
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Structured Content Preview */}
          <div className="space-y-4">
            <div>
              <Label className="text-primary font-semibold">📝 What happened:</Label>
              <p className="mt-2 text-sm text-foreground bg-card/50 p-3 rounded-lg border">
                {stepAnswers[0]}
              </p>
            </div>
            
            <div>
              <Label className="text-primary font-semibold">👶 How they behaved:</Label>
              <p className="mt-2 text-sm text-foreground bg-card/50 p-3 rounded-lg border">
                {stepAnswers[1]}
              </p>
            </div>
            
            <div>
              <Label className="text-primary font-semibold">💡 What that shows:</Label>
              <p className="mt-2 text-sm text-foreground bg-card/50 p-3 rounded-lg border">
                {stepAnswers[2]}
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-2">
            <Label className="text-primary font-semibold">✨ Summary</Label>
            {isGeneratingSummary ? (
              <div className="flex items-center gap-2 p-4 border rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Generating summary...</span>
              </div>
            ) : summary ? (
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm">{summary}</p>
              </div>
            ) : null}
          </div>

          {/* Children Selection (Optional) */}
          <div className="space-y-3">
            <Label>Children (Optional)</Label>
            <div className="flex flex-wrap gap-2">
              {CHILDREN.map((child) => (
                <Badge
                  key={child}
                  variant={selectedChildren.includes(child) ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-all",
                    selectedChildren.includes(child) && "bg-primary"
                  )}
                  onClick={() => toggleChild(child)}
                >
                  {child}
                </Badge>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-4 border-t">
            <Button
              size="lg"
              onClick={saveToNotion}
              disabled={isSaving}
              className="w-full bg-primary"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving to Notion...
                </>
              ) : (
                <>
                  <Database className="mr-2 h-4 w-4" />
                  Save to Notion
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="w-full"
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ReviewSheet;
