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
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex flex-col relative overflow-hidden">
      {/* Playful background elements */}
      <div className="absolute top-10 right-20 w-40 h-40 bg-gradient-fun rounded-full opacity-20 blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 left-20 w-32 h-32 bg-gradient-playful rounded-full opacity-20 blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-gradient-accent rounded-full opacity-15 blur-2xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      
      {/* Header */}
      <header className="p-4 border-b border-border/30 bg-card/30 backdrop-blur-lg flex items-center justify-between relative z-10">
        <div>
          <h1 className="text-2xl md:text-3xl font-black bg-gradient-fun bg-clip-text text-transparent">
            ✨ {t('app.title')} ✨
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1 font-medium">
            {t('app.subtitle')}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <LanguageSelector />
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-gradient-playful hover:text-white hover:scale-110 transition-all duration-300">
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
      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-6 relative z-10">
        <div className="text-center mb-4 animate-fade-in">
          <h2 className="text-3xl md:text-4xl font-black bg-gradient-playful bg-clip-text text-transparent mb-3">
            🌈 {t('app.welcome')} 🌈
          </h2>
          <p className="text-muted-foreground text-lg font-medium">
            {t('app.chooseAction')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          {/* Record Note Card */}
          <button
            onClick={() => navigate('/record')}
            className="group relative overflow-hidden rounded-3xl bg-gradient-accent border-4 border-white shadow-strong p-10 hover:shadow-accent-glow transition-all duration-500 hover:scale-110 hover:-rotate-2 text-left animate-scale-in"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="flex flex-col items-center text-center gap-5 relative z-10">
              <div className="h-24 w-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-strong group-hover:scale-125 group-hover:rotate-12 transition-all duration-500 ring-4 ring-white/30">
                <Mic className="h-12 w-12 text-white drop-shadow-lg" />
              </div>
              <div>
                <h3 className="text-2xl md:text-3xl font-black mb-3 text-white drop-shadow-lg">
                  🎤 {t('home.recordNote')}
                </h3>
                <p className="text-sm md:text-base text-white/90 font-medium">
                  {t('home.recordDescription')}
                </p>
              </div>
            </div>
            <div className="absolute top-4 right-4 text-3xl animate-bounce opacity-0 group-hover:opacity-100 transition-opacity">
              ✨
            </div>
          </button>

          {/* Upload Drawing Card */}
          <button
            onClick={() => navigate('/drawings')}
            className="group relative overflow-hidden rounded-3xl bg-gradient-playful border-4 border-white shadow-strong p-10 hover:shadow-accent-glow transition-all duration-500 hover:scale-110 hover:rotate-2 text-left animate-scale-in"
            style={{ animationDelay: '0.1s' }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="flex flex-col items-center text-center gap-5 relative z-10">
              <div 
                className="h-24 w-24 rounded-full flex items-center justify-center shadow-strong group-hover:scale-125 group-hover:-rotate-12 transition-all duration-500 bg-cover bg-center relative ring-4 ring-white/30"
                style={{ backgroundImage: `url(${galleryThumbnail})` }}
              >
                <div className="absolute inset-0 rounded-full bg-white/30 backdrop-blur-[2px]"></div>
              </div>
              <div>
                <h3 className="text-2xl md:text-3xl font-black mb-3 text-white drop-shadow-lg">
                  🎨 {t('home.uploadDrawing')}
                </h3>
                <p className="text-sm md:text-base text-white/90 font-medium">
                  {t('home.drawingDescription')}
                </p>
              </div>
            </div>
            <div className="absolute top-4 left-4 text-3xl animate-bounce opacity-0 group-hover:opacity-100 transition-opacity" style={{ animationDelay: '0.2s' }}>
              🌟
            </div>
          </button>
        </div>
      </main>
    </div>
  );
};

export default Home;
