import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import NotesList from "@/components/NotesList";
import HashtagBubbleChart from "@/components/HashtagBubbleChart";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Layout } from "@/components/Layout";

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
    <Layout>
      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('notes.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('notes.subtitle')}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-foreground" />
          </div>
        ) : (
          <Tabs value={selectedChild} onValueChange={setSelectedChild} className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="all">{t('notes.allChildren')}</TabsTrigger>
              {children.map((child) => (
                <TabsTrigger key={child.id} value={child.id}>
                  {child.name}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="all">
              <HashtagBubbleChart />
              <NotesList />
            </TabsContent>

            {children.map((child) => (
              <TabsContent key={child.id} value={child.id}>
                <HashtagBubbleChart childId={child.id} />
                <NotesList childId={child.id} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </Layout>
  );
};

export default Notes;
