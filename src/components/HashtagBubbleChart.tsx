import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hash, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, ResponsiveContainer, Cell } from "recharts";

interface HashtagBubbleChartProps {
  childId?: string;
}

interface HashtagData {
  name: string;
  value: number;
  x: number;
  y: number;
  z: number;
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

      // Convert to array and prepare for bubble chart
      const hashtagArray = Array.from(hashtagCount.entries())
        .map(([name, value], index) => ({
          name,
          value,
          x: Math.cos((index / hashtagCount.size) * 2 * Math.PI) * 50 + 50,
          y: Math.sin((index / hashtagCount.size) * 2 * Math.PI) * 50 + 50,
          z: value * 100,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 15); // Show top 15

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

  const chartConfig = {
    hashtag: {
      label: "Frequency",
      color: "hsl(var(--primary))",
    },
  };

  const colors = [
    "hsl(var(--primary))",
    "hsl(var(--accent))",
    "hsl(var(--success))",
    "hsl(var(--primary-glow))",
    "hsl(var(--accent-glow))",
  ];

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hash className="h-5 w-5 text-primary" />
          Hashtag Trends
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Most frequent hashtags from notes (bubble size = frequency)
        </p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <XAxis type="number" dataKey="x" hide domain={[0, 100]} />
              <YAxis type="number" dataKey="y" hide domain={[0, 100]} />
              <ZAxis type="number" dataKey="z" range={[400, 4000]} />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border bg-card p-2 shadow-md">
                        <div className="text-sm font-semibold">{payload[0].payload.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {payload[0].payload.value} times
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter data={data}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} opacity={0.7} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </ChartContainer>
        <div className="flex flex-wrap gap-2 mt-4 justify-center">
          {data.slice(0, 10).map((item, index) => (
            <div
              key={item.name}
              className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border"
              style={{
                backgroundColor: `${colors[index % colors.length]}15`,
                borderColor: colors[index % colors.length],
              }}
            >
              <span>{item.name}</span>
              <span className="text-muted-foreground">({item.value})</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default HashtagBubbleChart;
