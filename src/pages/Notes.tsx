import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import NotesList from "@/components/NotesList";
import BehaviorSummary from "@/components/BehaviorSummary";
import { useLanguage } from "@/contexts/LanguageContext";

const Notes = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

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
        <BehaviorSummary />
        <NotesList />
      </main>
    </div>
  );
};

export default Notes;
