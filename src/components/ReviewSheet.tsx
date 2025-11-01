import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, Database, X } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface ReviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stepAnswers: string[];
  prompts: string[];
  duration: number;
  onSaved: () => void;
}

interface Child {
  id: string;
  name: string;
  photo_url?: string;
  birthdate: string;
  signedPhotoUrl?: string;
}



const ReviewSheet = ({
  open,
  onOpenChange,
  stepAnswers,
  prompts,
  duration,
  onSaved,
}: ReviewSheetProps) => {
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [hasNotion, setHasNotion] = useState(false);
  const { t, language } = useLanguage();

  const calculateAge = (birthdate: string): number => {
    const today = new Date();
    const birth = new Date(birthdate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Fetch children and check Notion connection
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch children with birthdates
        const { data: childrenData, error: childrenError } = await supabase
          .from("children")
          .select("id, name, photo_url, birthdate")
          .order("name");

        if (childrenError) throw childrenError;
        
        // Generate signed URLs for child photos
        const childrenWithSignedUrls = await Promise.all(
          (childrenData || []).map(async (child) => {
            if (child.photo_url && !child.photo_url.startsWith('http')) {
              const { data: urlData } = await supabase.storage
                .from("child-photos")
                .createSignedUrl(child.photo_url, 3600); // 1 hour expiry
              return { ...child, signedPhotoUrl: urlData?.signedUrl || child.photo_url };
            }
            return { ...child, signedPhotoUrl: child.photo_url };
          })
        );
        
        setChildren(childrenWithSignedUrls);

        // Check if Notion is connected
        const { data: notionData, error: notionError } = await supabase
          .from("notion_tokens")
          .select("id")
          .maybeSingle();

        if (!notionError && notionData) {
          setHasNotion(true);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    if (open) {
      fetchData();
    }
  }, [open]);

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
        body: { 
          transcript: combinedText,
          language: language 
        }
      });

      if (error) throw error;
      
      if (data?.summary) {
        setSummary(data.summary);
      }
      if (data?.tags) {
        setTags(data.tags);
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

  const saveToDatabase = async () => {
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Please sign in to save");
        return;
      }

      const structuredContent = {
        whatHappened: stepAnswers[0],
        howTheyBehaved: stepAnswers[1]
      };

      // Get user's family_id
      const { data: familyData } = await supabase
        .from('family_members')
        .select('family_id')
        .eq('user_id', session.user.id)
        .single();

      if (!familyData) {
        throw new Error('No family found');
      }

      const { error } = await supabase
        .from('notes')
        .insert({
          user_id: session.user.id,
          family_id: familyData.family_id,
          transcript: stepAnswers.join('\n\n'),
          structured_content: structuredContent,
          summary,
          tags: tags.length > 0 ? tags : null,
          children: selectedChildren.length > 0 ? selectedChildren : null,
          duration,
        });

      if (error) throw error;

      toast.success("Note saved successfully");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('Failed to save note');
    } finally {
      setIsSaving(false);
    }
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
        howTheyBehaved: stepAnswers[1]
      };

      // Prepare children data with ages
      const childrenWithAges = selectedChildren.map(childName => {
        const child = children.find(c => c.name === childName);
        if (child) {
          const age = calculateAge(child.birthdate);
          return `${childName} (${age} ${t('common.yearsOld')})`;
        }
        return childName;
      });

      console.log('Sending to Notion - tags:', tags);
      console.log('Tags length:', tags.length);
      console.log('Children with ages:', childrenWithAges);

      const { data, error } = await supabase.functions.invoke('save-to-notion', {
        body: {
          structuredContent,
          summary,
          children: childrenWithAges.length > 0 ? childrenWithAges : undefined,
          duration,
          tags: tags.length > 0 ? tags : undefined,
        },
      });

      console.log('Notion response:', data);

      if (error) {
        throw error;
      }

      // Also save to database after successful Notion save
      await saveToDatabase();

      toast.success(t('review.savedSuccess'), {
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
          <SheetTitle>{t('review.title')}</SheetTitle>
          <SheetDescription>
            {t('review.description')}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Structured Content Preview */}
          <div className="space-y-4">
            <div>
              <Label className="text-primary font-semibold">{t('review.whatHappened')}</Label>
              <p className="mt-2 text-sm text-foreground bg-card/50 p-3 rounded-lg border">
                {stepAnswers[0]}
              </p>
            </div>
            
            <div>
              <Label className="text-primary font-semibold">{t('review.howBehaved')}</Label>
              <p className="mt-2 text-sm text-foreground bg-card/50 p-3 rounded-lg border">
                {stepAnswers[1]}
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-2">
            <Label className="text-primary font-semibold">{t('review.summary')}</Label>
            {isGeneratingSummary ? (
              <div className="flex items-center gap-2 p-4 border rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">{t('review.generatingSummary')}</span>
              </div>
            ) : summary ? (
              <div className="space-y-3">
                <div className="p-4 border rounded-lg bg-muted/50">
                  <p className="text-sm">{summary}</p>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Children Selection (Optional) */}
          {children.length > 0 && (
            <div className="space-y-3">
              <Label>{t('review.children')}</Label>
              <div className="flex flex-wrap gap-2">
                {children.map((child) => (
                  <Badge
                    key={child.id}
                    variant={selectedChildren.includes(child.name) ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-all flex items-center gap-2 py-2 px-3",
                      selectedChildren.includes(child.name) && "bg-primary"
                    )}
                    onClick={() => toggleChild(child.name)}
                  >
                    <Avatar className="h-6 w-6">
                      {child.signedPhotoUrl ? (
                        <AvatarImage src={child.signedPhotoUrl} alt={child.name} />
                      ) : (
                        <AvatarFallback className="text-xs">👶</AvatarFallback>
                      )}
                    </Avatar>
                    {child.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-4 border-t">
            <Button
              size="lg"
              onClick={saveToDatabase}
              disabled={isSaving}
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
                  Save Note
                </>
              )}
            </Button>

            {hasNotion && (
              <Button
                size="lg"
                onClick={saveToNotion}
                disabled={isSaving}
                variant="outline"
                className="w-full"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('review.savingToNotion')}
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    {t('review.saveToNotion')}
                  </>
                )}
              </Button>
            )}

            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="w-full"
            >
              <X className="mr-2 h-4 w-4" />
              {t('review.cancel')}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ReviewSheet;
