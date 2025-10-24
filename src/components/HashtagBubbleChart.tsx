import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hash, Loader2, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface HashtagBubbleChartProps {
  childId?: string;
}

interface HashtagData {
  name: string;
  value: number;
  percentage: number;
}

const HashtagBubbleChart = ({ childId }: HashtagBubbleChartProps = {}) => {
  const [data, setData] = useState<HashtagData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchHashtagData();
  }, [childId]);

  const fetchHashtagData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: familyMember } = await supabase
        .from('family_members')
        .select('family_id')
        .eq('user_id', user.id)
        .single();

      if (!familyMember) return;

      let query = supabase
        .from('notes')
        .select('tags, children')
        .eq('family_id', familyMember.family_id);

      if (childId) {
        const { data: childData } = await supabase
          .from('children')
          .select('name')
          .eq('id', childId)
          .single();
        
        if (childData) {
          query = query.contains('children', [childData.name]);
        }
      }

      const { data: notes } = await query;

      if (!notes) return;

      // Aggregate hashtags
      const hashtagCount = new Map<string, number>();
      notes.forEach(note => {
        if (note.tags) {
          note.tags.forEach((tag: string) => {
            hashtagCount.set(tag, (hashtagCount.get(tag) || 0) + 1);
          });
        }
      });

      // Convert to array and sort
      const sortedHashtags = Array.from(hashtagCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Show top 10

      const totalNotes = notes.length;
      const hashtagArray = sortedHashtags.map(([name, value]) => ({
        name,
        value,
        percentage: Math.round((value / totalNotes) * 100),
      }));

      setData(hashtagArray);
    } catch (error) {
      console.error('Error fetching hashtag data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-primary" />
            Hashtag Trends
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return null;
  }

  const getColor = (index: number) => {
    if (index < 3) return "hsl(var(--primary))";
    if (index < 6) return "hsl(var(--accent))";
    return "hsl(var(--muted-foreground))";
  };

  const maxValue = data.length > 0 ? data[0].value : 1;

  return (
    <Card className="mb-6 border-primary/20">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-primary" />
            Top Behavioral Traits
          </CardTitle>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            <span>Top {data.length}</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Most frequently mentioned traits in recent notes
        </p>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {data.map((item, index) => (
            <div 
              key={item.name} 
              className="animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getColor(index) }}
                  />
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {item.value} {item.value === 1 ? 'note' : 'notes'}
                  </span>
                  <span className="text-xs font-semibold text-foreground min-w-[3ch] text-right">
                    {item.percentage}%
                  </span>
                </div>
              </div>
              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                  style={{ 
                    width: `${(item.value / maxValue) * 100}%`,
                    backgroundColor: getColor(index),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default HashtagBubbleChart;
