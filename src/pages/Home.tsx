import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Image, BookOpen, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Layout } from "@/components/Layout";

const Home = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
      } else {
        setIsCheckingAuth(false);
      }
    };
    
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate('/auth');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-8 py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            {t('app.welcome')}
          </h1>
          <p className="text-muted-foreground">
            {t('app.chooseAction')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/record')}
            className="group flex items-start gap-4 p-6 rounded-lg border border-border hover:bg-secondary transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center flex-shrink-0 group-hover:bg-accent transition-colors">
              <Mic className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">
                {t('home.recordNote')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('home.recordDescription')}
              </p>
            </div>
          </button>

          <button
            onClick={() => navigate('/drawings')}
            className="group flex items-start gap-4 p-6 rounded-lg border border-border hover:bg-secondary transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center flex-shrink-0 group-hover:bg-accent transition-colors">
              <Image className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">
                {t('home.uploadDrawing')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('home.drawingDescription')}
              </p>
            </div>
          </button>

          <button
            onClick={() => navigate('/notes')}
            className="group flex items-start gap-4 p-6 rounded-lg border border-border hover:bg-secondary transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center flex-shrink-0 group-hover:bg-accent transition-colors">
              <BookOpen className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">
                {t('notes.title')}
              </h3>
              <p className="text-sm text-muted-foreground">
                View and manage your notes
              </p>
            </div>
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default Home;
