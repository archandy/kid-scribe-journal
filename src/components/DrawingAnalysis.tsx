import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Sparkles, Heart, Brain, Palette, Star, Loader2, X, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AnalysisResult {
  emotional_indicators: {
    analysis: string;
    tones: string[];
  };
  personality_traits: {
    analysis: string;
    traits: string[];
  };
  developmental_indicators: {
    analysis: string;
    level: string;
  };
  creativity_imagination: {
    analysis: string;
    highlights: string[];
  };
  summary: string;
}

interface Child {
  id: string;
  name: string;
  photo_url?: string;
  photo_emoji?: string;
}

interface ChildAnalysis {
  child: Child;
  imageUrls: string[];
  analysis: AnalysisResult | null;
  loading: boolean;
  error: string | null;
  saved: boolean;
}

interface BulkDrawingAnalysisProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  childrenWithDrawings: { child: Child; imageUrls: string[] }[];
  familyId: string | null;
}

export function BulkDrawingAnalysis({ open, onOpenChange, childrenWithDrawings, familyId }: BulkDrawingAnalysisProps) {
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const [analyses, setAnalyses] = useState<ChildAnalysis[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (open && childrenWithDrawings.length > 0) {
      setAnalyses(childrenWithDrawings.map(({ child, imageUrls }) => ({
        child,
        imageUrls,
        analysis: null,
        loading: false,
        error: null,
        saved: false
      })));
      setCurrentIndex(0);
    }
  }, [open, childrenWithDrawings]);

  const saveAnalysis = async (childId: string, analysis: AnalysisResult, drawingCount: number) => {
    if (!familyId) return false;
    
    try {
      const { error } = await supabase
        .from("drawing_analyses")
        .insert({
          family_id: familyId,
          child_id: childId,
          analysis: analysis as unknown as Record<string, unknown>,
          drawing_count: drawingCount
        } as any);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error saving analysis:", error);
      return false;
    }
  };

  const analyzeChild = async (index: number) => {
    const childData = analyses[index];
    if (!childData || childData.analysis) return;

    setAnalyses(prev => prev.map((a, i) => 
      i === index ? { ...a, loading: true, error: null } : a
    ));

    try {
      const { data, error: fnError } = await supabase.functions.invoke('analyze-drawing', {
        body: { 
          imageUrls: childData.imageUrls, 
          childName: childData.child.name, 
          language 
        }
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      // Save to database
      const saved = await saveAnalysis(
        childData.child.id,
        data.analysis,
        Math.min(childData.imageUrls.length, 10)
      );

      setAnalyses(prev => prev.map((a, i) => 
        i === index ? { ...a, analysis: data.analysis, loading: false, saved } : a
      ));

      if (saved) {
        toast({ title: t('analysis.saved') });
      }
    } catch (err) {
      console.error('Analysis error:', err);
      const message = err instanceof Error ? err.message : t('analysis.error');
      setAnalyses(prev => prev.map((a, i) => 
        i === index ? { ...a, error: message, loading: false } : a
      ));
      toast({
        title: t('analysis.error'),
        description: message,
        variant: "destructive"
      });
    }
  };

  const analyzeAll = async () => {
    setAnalyzing(true);
    for (let i = 0; i < analyses.length; i++) {
      if (!analyses[i].analysis) {
        await analyzeChild(i);
      }
    }
    setAnalyzing(false);
  };

  const currentAnalysis = analyses[currentIndex];

  const renderAnalysisContent = (analysis: AnalysisResult) => (
    <div className="space-y-4">
      {/* Summary */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Star className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <p className="text-sm leading-relaxed">{analysis.summary}</p>
          </div>
        </CardContent>
      </Card>

      {/* Emotional Indicators */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="h-5 w-5 text-rose-500" />
            <h3 className="font-semibold">{t('analysis.emotional')}</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            {analysis.emotional_indicators.analysis}
          </p>
          <div className="flex flex-wrap gap-2">
            {analysis.emotional_indicators.tones.map((tone, i) => (
              <Badge key={i} variant="secondary" className="bg-rose-100 text-rose-700">
                {tone}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Personality Traits */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="h-5 w-5 text-violet-500" />
            <h3 className="font-semibold">{t('analysis.personality')}</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            {analysis.personality_traits.analysis}
          </p>
          <div className="flex flex-wrap gap-2">
            {analysis.personality_traits.traits.map((trait, i) => (
              <Badge key={i} variant="secondary" className="bg-violet-100 text-violet-700">
                {trait}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Developmental Indicators */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <h3 className="font-semibold">{t('analysis.developmental')}</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            {analysis.developmental_indicators.analysis}
          </p>
          <Badge variant="outline" className="border-amber-300 text-amber-700">
            {analysis.developmental_indicators.level}
          </Badge>
        </CardContent>
      </Card>

      {/* Creativity */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Palette className="h-5 w-5 text-emerald-500" />
            <h3 className="font-semibold">{t('analysis.creativity')}</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            {analysis.creativity_imagination.analysis}
          </p>
          <div className="flex flex-wrap gap-2">
            {analysis.creativity_imagination.highlights.map((highlight, i) => (
              <Badge key={i} variant="secondary" className="bg-emerald-100 text-emerald-700">
                {highlight}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0 overflow-hidden">
        {/* Header with child tabs */}
        <div className="border-b border-border">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('analysis.title')}</h2>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Child selector */}
          <div className="px-4 pb-3 flex gap-2 overflow-x-auto">
            {analyses.map((a, i) => (
              <button
                key={a.child.id}
                onClick={() => setCurrentIndex(i)}
                className={`flex items-center gap-2 px-3 py-2 rounded-full border-2 transition-all shrink-0 ${
                  currentIndex === i
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <Avatar className="h-6 w-6">
                  {a.child.photo_url && (
                    <AvatarImage src={a.child.photo_url} alt={a.child.name} />
                  )}
                  <AvatarFallback className="text-xs">
                    {a.child.photo_emoji || a.child.name[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{a.child.name}</span>
                {a.saved && <Check className="h-3 w-3 text-emerald-500" />}
                {a.analysis && !a.saved && <Star className="h-3 w-3 text-primary" />}
                {a.loading && <Loader2 className="h-3 w-3 animate-spin" />}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 h-[60vh]">
          <div className="p-4">
            {currentAnalysis && (
              <>
                {/* Image count info */}
                <p className="text-sm text-muted-foreground mb-4">
                  {t('analysis.photosAnalyzed')}: {Math.min(currentAnalysis.imageUrls.length, 10)}
                  {currentAnalysis.imageUrls.length > 10 && ` (${t('analysis.maxPhotos')})`}
                </p>

                {currentAnalysis.loading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                    <p className="text-muted-foreground">{t('analysis.analyzing')}</p>
                  </div>
                ) : currentAnalysis.analysis ? (
                  renderAnalysisContent(currentAnalysis.analysis)
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Sparkles className="h-12 w-12 text-primary/60 mb-4" />
                    <p className="text-center text-muted-foreground mb-4">
                      {t('analysis.description')}
                    </p>
                    <Button 
                      onClick={() => analyzeChild(currentIndex)} 
                      className="gap-2"
                      disabled={currentAnalysis.loading}
                    >
                      <Sparkles className="h-5 w-5" />
                      {t('analysis.analyzeThis')}
                    </Button>
                    {currentAnalysis.error && (
                      <p className="text-sm text-destructive text-center mt-4">{currentAnalysis.error}</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer with navigation and analyze all */}
        <div className="border-t border-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {currentIndex + 1} / {analyses.length}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentIndex(i => Math.min(analyses.length - 1, i + 1))}
              disabled={currentIndex === analyses.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <Button 
            onClick={analyzeAll} 
            disabled={analyzing || analyses.every(a => a.analysis)}
            className="gap-2"
          >
            {analyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {t('analysis.analyzeAll')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
