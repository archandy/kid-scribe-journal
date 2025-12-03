import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Heart, Brain, Palette, Star, Loader2, X } from "lucide-react";
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

interface DrawingAnalysisProps {
  imageUrl: string;
  childName: string;
  onClose: () => void;
}

export function DrawingAnalysis({ imageUrl, childName, onClose }: DrawingAnalysisProps) {
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeDrawing = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('analyze-drawing', {
        body: { imageUrl, childName, language }
      });

      if (fnError) throw fnError;
      
      if (data.error) {
        throw new Error(data.error);
      }

      setAnalysis(data.analysis);
    } catch (err) {
      console.error('Analysis error:', err);
      const message = err instanceof Error ? err.message : t('analysis.error');
      setError(message);
      toast({
        title: t('analysis.error'),
        description: message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!analysis && !loading) {
    return (
      <div className="w-full max-w-md bg-white/95 backdrop-blur-sm rounded-3xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 text-center border-b border-border/50">
          <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'serif' }}>
            {childName}
          </h2>
        </div>
        <div className="p-6 flex flex-col items-center gap-4">
          <Sparkles className="h-12 w-12 text-primary/60" />
          <p className="text-center text-muted-foreground">
            {t('analysis.description')}
          </p>
          <Button 
            onClick={analyzeDrawing} 
            className="w-full gap-2"
            disabled={loading}
          >
            <Sparkles className="h-5 w-5" />
            {t('analysis.analyze')}
          </Button>
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full max-w-md bg-white/95 backdrop-blur-sm rounded-3xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 text-center border-b border-border/50">
          <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'serif' }}>
            {childName}
          </h2>
        </div>
        <div className="p-8 flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
          <p className="text-center text-muted-foreground">{t('analysis.analyzing')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg bg-white/95 backdrop-blur-sm rounded-3xl shadow-xl overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between border-b border-border/50">
        <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: 'serif' }}>
          {t('analysis.reportFor')} {childName}
        </h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      
      <ScrollArea className="h-[50vh]">
        <div className="p-4 space-y-4">
          {/* Summary */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Star className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm leading-relaxed">{analysis?.summary}</p>
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
                {analysis?.emotional_indicators.analysis}
              </p>
              <div className="flex flex-wrap gap-2">
                {analysis?.emotional_indicators.tones.map((tone, i) => (
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
                {analysis?.personality_traits.analysis}
              </p>
              <div className="flex flex-wrap gap-2">
                {analysis?.personality_traits.traits.map((trait, i) => (
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
                {analysis?.developmental_indicators.analysis}
              </p>
              <Badge variant="outline" className="border-amber-300 text-amber-700">
                {analysis?.developmental_indicators.level}
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
                {analysis?.creativity_imagination.analysis}
              </p>
              <div className="flex flex-wrap gap-2">
                {analysis?.creativity_imagination.highlights.map((highlight, i) => (
                  <Badge key={i} variant="secondary" className="bg-emerald-100 text-emerald-700">
                    {highlight}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
      
      <div className="p-4 border-t border-border/50">
        <Button variant="outline" onClick={onClose} className="w-full">
          {t('common.back')}
        </Button>
      </div>
    </div>
  );
}
