import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Note {
  id: string;
  date: string;
  transcript: string;
  children: string[] | null;
  summary: string | null;
  tags: string[] | null;
  duration: number;
  structured_content: any;
}

const NotesList = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
      toast.error('Failed to load notes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    
    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', deleteId);

      if (error) throw error;
      
      setNotes(notes.filter(note => note.id !== deleteId));
      toast.success('Note deleted successfully');
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Failed to delete note');
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No notes yet. Start recording to capture your first moment!</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 max-w-2xl mx-auto">
        {notes.map((note) => (
          <Card key={note.id} className="overflow-hidden hover:shadow-medium transition-shadow">
            <CardContent className="p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {new Date(note.date).toLocaleDateString()} • {note.duration}s
                  </p>
                  <p className="text-sm line-clamp-2">{note.transcript || note.summary}</p>
                </div>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="shrink-0"
                  onClick={() => setDeleteId(note.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Summary */}
              {note.summary && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm">{note.summary}</p>
                </div>
              )}

              {/* Tags and Children */}
              <div className="flex flex-wrap gap-2">
                {note.tags && note.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    #{tag}
                  </Badge>
                ))}
                {note.children && note.children.map((child) => (
                  <Badge key={child} variant="default" className="bg-primary">
                    {child}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default NotesList;
