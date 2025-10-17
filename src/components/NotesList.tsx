import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, ExternalLink } from "lucide-react";

// Sample data - will be replaced with real data from IndexedDB/Notion
const SAMPLE_NOTES = [
  {
    id: "1",
    date: "2025-01-15",
    transcript: "Hana showed amazing creativity today building a castle out of blocks...",
    children: ["Hana"],
    tags: ["creativity", "motor skills"],
    sentiment: "very positive",
    duration: 45,
  },
  {
    id: "2",
    date: "2025-01-14",
    transcript: "Sena asked so many questions about the stars and planets...",
    children: ["Sena"],
    tags: ["curiosity", "language"],
    sentiment: "positive",
    duration: 62,
  },
];

const NotesList = () => {
  if (SAMPLE_NOTES.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No notes yet. Start recording to capture your first moment!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Recent Notes</h2>
        <Button variant="ghost" size="sm">View All</Button>
      </div>

      {SAMPLE_NOTES.map((note) => (
        <Card key={note.id} className="overflow-hidden hover:shadow-medium transition-shadow">
          <CardContent className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-1">
                <p className="text-sm text-muted-foreground">
                  {new Date(note.date).toLocaleDateString()} • {note.duration}s
                </p>
                <p className="text-sm line-clamp-2">{note.transcript}</p>
              </div>
              <Button size="icon" variant="ghost" className="shrink-0">
                <Play className="h-4 w-4" />
              </Button>
            </div>

            {/* Children & Tags */}
            <div className="flex flex-wrap gap-2">
              {note.children.map((child) => (
                <Badge key={child} variant="default" className="bg-primary">
                  {child}
                </Badge>
              ))}
              {note.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
              <Badge variant="secondary">
                {note.sentiment === "very positive" && "😊"}
                {note.sentiment === "positive" && "🙂"}
                {note.sentiment === "neutral" && "😐"}
              </Badge>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" size="sm" className="text-xs">
                <ExternalLink className="h-3 w-3 mr-1" />
                Open in Notion
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default NotesList;
