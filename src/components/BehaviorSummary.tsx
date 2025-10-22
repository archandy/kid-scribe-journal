import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";

interface ChildSummary {
  childName: string;
  summary: string;
}

interface BehaviorAnalysis {
  childSummaries: ChildSummary[];
  topHashtags: string[];
  encouragement: string;
}

const BehaviorSummary = () => {
  const [analysis, setAnalysis] = useState<BehaviorAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { language } = useLanguage();

  useEffect(() => {
    fetchBehaviorAnalysis();
  }, [language]);

  const fetchBehaviorAnalysis = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-behavior', {
        body: { language }
      });

      if (error) {
        console.error('Error fetching behavior analysis:', error);
        return;
      }

      if (data && !data.error) {
        setAnalysis(data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!analysis || analysis.childSummaries.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Behavior Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Child Summaries */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            Overall Behavior Patterns
          </div>
          {analysis.childSummaries.map((child, index) => (
            <div key={index} className="space-y-2">
              <div className="font-semibold text-primary">{child.childName}</div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {child.summary}
              </p>
            </div>
          ))}
        </div>

        {/* Top Hashtags */}
        {analysis.topHashtags.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm font-semibold text-muted-foreground">
              Top Behavioral Themes
            </div>
            <div className="flex flex-wrap gap-2">
              {analysis.topHashtags.map((tag, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="bg-primary/10 text-primary hover:bg-primary/20"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Encouragement */}
        {analysis.encouragement && (
          <div className="space-y-3 rounded-lg bg-card/50 p-4 border border-primary/10">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <MessageCircle className="h-4 w-4" />
              Encouragement for Your Child
            </div>
            <p className="text-sm font-medium text-foreground leading-relaxed italic">
              "{analysis.encouragement}"
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BehaviorSummary;