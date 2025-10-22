import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import NotesList from "@/components/NotesList";
import BehaviorSummary from "@/components/BehaviorSummary";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface Child {
  id: string;
  name: string;
  birthdate: string;
}

const Notes = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [children, setChildren] = useState<Child[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState<string>("all");

  useEffect(() => {
    fetchChildren();
  }, []);

  const fetchChildren = async () => {
    try {
      const { data, error } = await supabase
        .from('children')
        .select('id, name, birthdate')
        .order('name');

      if (error) throw error;
      setChildren(data || []);
    } catch (error) {
      console.error('Error fetching children:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="p-4 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-hero bg-clip-text text-transparent">
              Past Notes
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              View your saved notes and memories
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs value={selectedChild} onValueChange={setSelectedChild} className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="all">All Children</TabsTrigger>
              {children.map((child) => (
                <TabsTrigger key={child.id} value={child.id}>
                  {child.name}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="all">
              <BehaviorSummary />
              <NotesList />
            </TabsContent>

            {children.map((child) => (
              <TabsContent key={child.id} value={child.id}>
                <BehaviorSummary childId={child.id} />
                <NotesList childId={child.id} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default Notes;
