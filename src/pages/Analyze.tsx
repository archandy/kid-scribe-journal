import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Heart, Brain, Palette, Star, Loader2, Download, Trash2 } from "lucide-react";
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

interface SavedAnalysis {
  id: string;
  child_id: string;
  analysis: AnalysisResult;
  drawing_count: number;
  created_at: string;
  children: Child;
}

export default function Analyze() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnalysis, setSelectedAnalysis] = useState<SavedAnalysis | null>(null);

  useEffect(() => {
    fetchAnalyses();
  }, []);

  const fetchAnalyses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: familyData } = await supabase
        .from("family_members")
        .select("family_id")
        .eq("user_id", user.id)
        .single();

      if (!familyData) return;

      const { data: analysesData } = await supabase
        .from("drawing_analyses")
        .select(`
          id,
          child_id,
          analysis,
          drawing_count,
          created_at,
          children:child_id (
            id,
            name,
            photo_url,
            photo_emoji
          )
        `)
        .eq("family_id", familyData.family_id)
        .order("created_at", { ascending: false });

      if (analysesData) {
        // Get signed URLs for child photos
        const childPhotoPaths = analysesData
          .map(a => a.children?.photo_url)
          .filter(url => url && !url.startsWith('http')) as string[];

        if (childPhotoPaths.length > 0) {
          const { data: signedUrls } = await supabase.storage
            .from("child-photos")
            .createSignedUrls(childPhotoPaths, 86400);

          const analysesWithUrls = analysesData.map(analysis => {
            let childPhotoUrl = analysis.children?.photo_url;
            if (childPhotoUrl && !childPhotoUrl.startsWith('http')) {
              const photoIndex = childPhotoPaths.indexOf(childPhotoUrl);
              childPhotoUrl = signedUrls?.[photoIndex]?.signedUrl || childPhotoUrl;
            }
            return {
              ...analysis,
              analysis: analysis.analysis as unknown as AnalysisResult,
              children: {
                ...analysis.children,
                photo_url: childPhotoUrl
              }
            } as SavedAnalysis;
          });
          setAnalyses(analysesWithUrls);
        } else {
          setAnalyses(analysesData.map(a => ({
            ...a,
            analysis: a.analysis as unknown as AnalysisResult
          })) as SavedAnalysis[]);
        }
      }
    } catch (error) {
      console.error("Error fetching analyses:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (analysisId: string) => {
    if (!confirm(t('analysis.deleteConfirm'))) return;

    try {
      const { error } = await supabase
        .from("drawing_analyses")
        .delete()
        .eq("id", analysisId);

      if (error) throw error;

      toast({ title: t('analysis.deleteSuccess') });
      setSelectedAnalysis(null);
      fetchAnalyses();
    } catch (error) {
      console.error("Error deleting analysis:", error);
      toast({ title: t('analysis.deleteError'), variant: "destructive" });
    }
  };

  const downloadAsPDF = (analysis: SavedAnalysis) => {
    const content = generatePDFContent(analysis);
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
    
    toast({ title: t('analysis.downloadStarted') });
  };

  const generatePDFContent = (analysis: SavedAnalysis) => {
    const a = analysis.analysis;
    const date = new Date(analysis.created_at).toLocaleDateString();
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${analysis.children.name} - ${t('analysis.title')}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #333; }
    h1 { color: #6366f1; border-bottom: 2px solid #6366f1; padding-bottom: 10px; }
    h2 { color: #6366f1; margin-top: 30px; }
    .meta { color: #666; margin-bottom: 30px; }
    .summary { background: #f0f0ff; padding: 20px; border-radius: 10px; margin: 20px 0; }
    .section { margin: 20px 0; padding: 20px; background: #f9f9f9; border-radius: 10px; }
    .badges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .badge { background: #e0e7ff; color: #4338ca; padding: 4px 12px; border-radius: 20px; font-size: 14px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>🎨 ${analysis.children.name}</h1>
  <p class="meta">${t('analysis.title')} • ${date} • ${analysis.drawing_count} ${t('analysis.photosAnalyzed')}</p>
  
  <div class="summary">
    <strong>⭐ ${t('analysis.summary')}</strong>
    <p>${a.summary}</p>
  </div>

  <div class="section">
    <h2>❤️ ${t('analysis.emotional')}</h2>
    <p>${a.emotional_indicators.analysis}</p>
    <div class="badges">
      ${a.emotional_indicators.tones.map(t => `<span class="badge">${t}</span>`).join('')}
    </div>
  </div>

  <div class="section">
    <h2>🧠 ${t('analysis.personality')}</h2>
    <p>${a.personality_traits.analysis}</p>
    <div class="badges">
      ${a.personality_traits.traits.map(t => `<span class="badge">${t}</span>`).join('')}
    </div>
  </div>

  <div class="section">
    <h2>✨ ${t('analysis.developmental')}</h2>
    <p>${a.developmental_indicators.analysis}</p>
    <div class="badges">
      <span class="badge">${a.developmental_indicators.level}</span>
    </div>
  </div>

  <div class="section">
    <h2>🎨 ${t('analysis.creativity')}</h2>
    <p>${a.creativity_imagination.analysis}</p>
    <div class="badges">
      ${a.creativity_imagination.highlights.map(h => `<span class="badge">${h}</span>`).join('')}
    </div>
  </div>
</body>
</html>`;
  };

  const renderAnalysisContent = (analysis: AnalysisResult) => (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Star className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <p className="text-sm leading-relaxed">{analysis.summary}</p>
          </div>
        </CardContent>
      </Card>

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

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{t('analysis.savedAnalyses')}</h1>
        </div>

        {analyses.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Sparkles className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground text-center">
                {t('analysis.noAnalyses')}
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => navigate('/drawings')}
              >
                {t('analysis.goToDrawings')}
              </Button>
            </CardContent>
          </Card>
        ) : selectedAnalysis ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setSelectedAnalysis(null)}>
                ← {t('analysis.back')}
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadAsPDF(selectedAnalysis)}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(selectedAnalysis.id)}
                  className="gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Card className="mb-4">
              <CardContent className="p-4 flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  {selectedAnalysis.children.photo_url && (
                    <AvatarImage src={selectedAnalysis.children.photo_url} />
                  )}
                  <AvatarFallback>
                    {selectedAnalysis.children.photo_emoji || selectedAnalysis.children.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="font-semibold text-lg">{selectedAnalysis.children.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedAnalysis.created_at).toLocaleDateString()} • {selectedAnalysis.drawing_count} {t('analysis.photosAnalyzed')}
                  </p>
                </div>
              </CardContent>
            </Card>

            <ScrollArea className="h-[60vh]">
              {renderAnalysisContent(selectedAnalysis.analysis)}
            </ScrollArea>
          </div>
        ) : (
          <div className="grid gap-4">
            {analyses.map((analysis) => (
              <Card 
                key={analysis.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedAnalysis(analysis)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    {analysis.children.photo_url && (
                      <AvatarImage src={analysis.children.photo_url} />
                    )}
                    <AvatarFallback>
                      {analysis.children.photo_emoji || analysis.children.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-semibold">{analysis.children.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(analysis.created_at).toLocaleDateString()} • {analysis.drawing_count} {t('analysis.photosAnalyzed')}
                    </p>
                  </div>
                  <Sparkles className="h-5 w-5 text-primary" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}