import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hash, Loader2, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ChartContainer } from "@/components/ui/chart";
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";

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

      // Convert to array and sort
      const sortedHashtags = Array.from(hashtagCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20); // Show top 20

      // Pack bubbles using simple circle packing algorithm
      const hashtagArray = sortedHashtags.map(([name, value], index) => {
        const row = Math.floor(index / 5);
        const col = index % 5;
        const maxValue = sortedHashtags[0][1];
        const normalizedSize = (value / maxValue) * 0.8 + 0.2; // Scale between 0.2 and 1.0
        
        return {
          name,
          value,
          x: col * 20 + 10,
          y: row * 25 + 12.5,
          z: normalizedSize * 1000, // Size for bubble
          fill: index,
        };
      });

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

  const getColor = (index: number, total: number) => {
    // Create gradient from primary to accent based on frequency rank
    const ratio = index / total;
    if (ratio < 0.3) return "hsl(var(--primary))";
    if (ratio < 0.6) return "hsl(var(--accent))";
    return "hsl(var(--muted-foreground))";
  };

  const maxValue = data.length > 0 ? data[0].value : 1;

  return (
    <Card className="mb-6 border-primary/20 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-primary" />
            Hashtag Trends
          </CardTitle>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            <span>{data.length} hashtags</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Visual representation of most frequent hashtags • Larger bubbles = higher frequency
        </p>
      </CardHeader>
      <CardContent className="pt-6">
        <ChartContainer config={chartConfig} className="h-[500px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <XAxis type="number" dataKey="x" hide domain={[0, 100]} />
              <YAxis type="number" dataKey="y" hide domain={[0, 100]} />
              <ZAxis type="number" dataKey="z" range={[600, 5000]} />
              <Tooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    const percentage = ((item.value / maxValue) * 100).toFixed(0);
                    return (
                      <div className="rounded-lg border border-primary/20 bg-card/95 backdrop-blur-sm p-3 shadow-strong animate-scale-in">
                        <div className="text-sm font-bold text-primary mb-1">{item.name}</div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <div>Frequency: <span className="font-semibold text-foreground">{item.value} times</span></div>
                          <div>Relative: <span className="font-semibold text-foreground">{percentage}%</span></div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter 
                data={data} 
                animationDuration={800}
                animationEasing="ease-out"
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={getColor(index, data.length)} 
                    opacity={0.75}
                    className="hover-scale cursor-pointer transition-all duration-300"
                    style={{ filter: `drop-shadow(0 2px 8px ${getColor(index, data.length)}40)` }}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </ChartContainer>
        
        {/* Legend with top hashtags */}
        <div className="mt-6 pt-4 border-t border-border">
          <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
            Top Hashtags by Frequency
          </div>
          <div className="flex flex-wrap gap-2">
            {data.slice(0, 12).map((item, index) => {
              const percentage = ((item.value / maxValue) * 100).toFixed(0);
              return (
                <div
                  key={item.name}
                  className="group flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-300 hover:scale-105 hover:shadow-medium cursor-pointer animate-fade-in"
                  style={{
                    backgroundColor: `${getColor(index, data.length)}08`,
                    borderColor: getColor(index, data.length),
                    animationDelay: `${index * 50}ms`,
                  }}
                >
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getColor(index, data.length) }}
                  />
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.value}
                  </span>
                  <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    ({percentage}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default HashtagBubbleChart;
