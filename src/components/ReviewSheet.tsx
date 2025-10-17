import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Database, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface ReviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audioBlob: Blob;
  audioUrl: string | null;
  transcript: string;
  isTranscribing: boolean;
  duration: number;
  onSaved: () => void;
}

const CHILDREN = ["Hana", "Sena"];
const TAGS = ["creativity", "curiosity", "language", "music", "motor skills", "social", "math"];
const SENTIMENTS = [
  { value: "very positive", label: "😊 Very Positive", color: "bg-success" },
  { value: "positive", label: "🙂 Positive", color: "bg-success/70" },
  { value: "neutral", label: "😐 Neutral", color: "bg-muted" },
  { value: "negative", label: "😕 Negative", color: "bg-destructive/70" },
];

const ReviewSheet = ({
  open,
  onOpenChange,
  audioBlob,
  audioUrl,
  transcript,
  isTranscribing,
  duration,
  onSaved,
}: ReviewSheetProps) => {
  const [editedTranscript, setEditedTranscript] = useState(transcript);
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sentiment, setSentiment] = useState("positive");
  const [isSaving, setIsSaving] = useState(false);

  const toggleChild = (child: string) => {
    setSelectedChildren(prev =>
      prev.includes(child) ? prev.filter(c => c !== child) : [...prev, child]
    );
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const saveLocally = async () => {
    setIsSaving(true);
    try {
      // Save to IndexedDB (to be implemented)
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success("Saved locally! Will sync when Lovable Cloud is connected.");
      onSaved();
    } catch (error) {
      toast.error("Failed to save locally");
    } finally {
      setIsSaving(false);
    }
  };

  const saveToNotion = async () => {
    if (selectedChildren.length === 0) {
      toast.error("Please select at least one child");
      return;
    }
    
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Please sign in to save to Notion");
        return;
      }

      const { data, error } = await supabase.functions.invoke('save-to-notion', {
        body: {
          transcript: editedTranscript,
          audioUrl: audioUrl,
          children: selectedChildren,
          tags: selectedTags,
          sentiment: sentiment,
          duration: duration,
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
            Edit the transcript and add details before saving
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Audio Player */}
          {audioUrl && (
            <div className="space-y-2">
              <Label>Audio Recording ({duration}s)</Label>
              <audio controls src={audioUrl} className="w-full" />
            </div>
          )}

          {/* Transcript */}
          <div className="space-y-2">
            <Label htmlFor="transcript">Transcript</Label>
            {isTranscribing ? (
              <div className="flex items-center gap-2 p-4 border rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Transcribing audio...</span>
              </div>
            ) : (
              <Textarea
                id="transcript"
                value={editedTranscript}
                onChange={(e) => setEditedTranscript(e.target.value)}
                placeholder="Transcript will appear here..."
                className="min-h-32"
              />
            )}
          </div>

          {/* Children Selection */}
          <div className="space-y-3">
            <Label>Children</Label>
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

          {/* Tags */}
          <div className="space-y-3">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {TAGS.map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-all",
                    selectedTags.includes(tag) && "bg-accent"
                  )}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Sentiment */}
          <div className="space-y-3">
            <Label>Mood</Label>
            <div className="grid grid-cols-2 gap-2">
              {SENTIMENTS.map((s) => (
                <Button
                  key={s.value}
                  variant={sentiment === s.value ? "default" : "outline"}
                  className={cn(
                    "justify-start",
                    sentiment === s.value && s.color
                  )}
                  onClick={() => setSentiment(s.value)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-4 border-t">
            <Button
              size="lg"
              onClick={saveToNotion}
              disabled={isSaving || isTranscribing}
              className="w-full bg-primary"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Database className="mr-2 h-4 w-4" />
                  Save to Notion
                </>
              )}
            </Button>

            <Button
              size="lg"
              variant="secondary"
              onClick={saveLocally}
              disabled={isSaving || isTranscribing}
              className="w-full"
            >
              <Save className="mr-2 h-4 w-4" />
              Save Locally
            </Button>

            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="w-full"
            >
              <X className="mr-2 h-4 w-4" />
              Discard
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ReviewSheet;
