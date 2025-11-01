import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, ImagePlus, Menu, X, BookOpen, Settings as SettingsIcon, Users, Image, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSelector from "@/components/LanguageSelector";
import { toast } from "sonner";
import galleryThumbnail from "@/assets/gallery-thumbnail.jpg";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const Home = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Signed out successfully");
      navigate('/auth');
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("Failed to sign out");
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle flex flex-col">
      {/* Header */}
      <header className="p-4 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-hero bg-clip-text text-transparent">
            {t('app.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('app.subtitle')}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <LanguageSelector />
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>{t('home.menu')}</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-2 mt-6">
                <Button
                  variant="ghost"
                  className="justify-start"
                  onClick={() => {
                    navigate('/notes');
                    setMenuOpen(false);
                  }}
                >
                  <BookOpen className="h-5 w-5 mr-3" />
                  {t('notes.title')}
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start"
                  onClick={() => {
                    navigate('/drawings');
                    setMenuOpen(false);
                  }}
                >
                  <Image className="h-5 w-5 mr-3" />
                  {t('drawings.title')}
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start"
                  onClick={() => {
                    navigate('/children');
                    setMenuOpen(false);
                  }}
                >
                  <Users className="h-5 w-5 mr-3" />
                  {t('children.title')}
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start"
                  onClick={() => {
                    navigate('/settings');
                    setMenuOpen(false);
                  }}
                >
                  <SettingsIcon className="h-5 w-5 mr-3" />
                  {t('settings.title')}
                </Button>
                <div className="border-t border-border my-2" />
                <Button
                  variant="ghost"
                  className="justify-start text-destructive hover:text-destructive"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-5 w-5 mr-3" />
                  {t('settings.signOut')}
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        <div className="text-center mb-4">
          <h2 className="text-3xl font-bold bg-gradient-hero bg-clip-text text-transparent mb-2">
            {t('app.welcome')}
          </h2>
          <p className="text-muted-foreground">
            {t('app.chooseAction')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
          {/* Record Note Card */}
          <button
            onClick={() => navigate('/record')}
            className="group relative overflow-hidden rounded-2xl bg-card border border-border p-8 hover:shadow-accent-glow transition-all duration-300 hover:scale-105 text-left"
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="h-20 w-20 rounded-full bg-gradient-accent flex items-center justify-center shadow-accent-glow group-hover:shadow-strong transition-all">
                <Mic className="h-10 w-10 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2 bg-gradient-hero bg-clip-text text-transparent">
                  {t('home.recordNote')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t('home.recordDescription')}
                </p>
              </div>
            </div>
          </button>

          {/* Upload Drawing Card */}
          <button
            onClick={() => navigate('/drawings')}
            className="group relative overflow-hidden rounded-2xl bg-card border border-border hover:shadow-accent-glow transition-all duration-300 hover:scale-105 text-left"
          >
            <div className="flex flex-col items-center text-center gap-4 p-8">
              <div 
                className="h-20 w-20 rounded-full flex items-center justify-center shadow-medium group-hover:shadow-strong transition-all bg-cover bg-center relative"
                style={{ backgroundImage: `url(${galleryThumbnail})` }}
              >
                <div className="absolute inset-0 rounded-full bg-gradient-secondary/30"></div>
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2 bg-gradient-hero bg-clip-text text-transparent">
                  {t('home.uploadDrawing')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t('home.drawingDescription')}
                </p>
              </div>
            </div>
          </button>
        </div>
      </main>
    </div>
  );
};

export default Home;
