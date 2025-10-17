import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ChildForm } from "@/components/ChildForm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

interface Child {
  id: string;
  name: string;
  birthdate: string;
  photo_emoji?: string;
  photo_url?: string;
}

const Children = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [children, setChildren] = useState<Child[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [deletingChildId, setDeletingChildId] = useState<string | null>(null);

  useEffect(() => {
    fetchChildren();
  }, []);

  const fetchChildren = async () => {
    try {
      const { data, error } = await supabase
        .from("children")
        .select("*")
        .order("birthdate", { ascending: false });

      if (error) throw error;
      setChildren(data || []);
    } catch (error) {
      console.error("Error fetching children:", error);
      toast.error(t('children.fetchError'));
    } finally {
      setIsLoading(false);
    }
  };

  const calculateAge = (birthdate: string) => {
    const today = new Date();
    const birth = new Date(birthdate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const handleSubmit = async (data: { name: string; birthdate: Date; photo_url?: string; id?: string }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error(t('children.authError'));
        return;
      }

      const childData = {
        name: data.name,
        birthdate: data.birthdate.toISOString().split('T')[0],
        photo_url: data.photo_url || null,
        user_id: session.user.id,
      };

      if (data.id) {
        // Update existing child
        const { error } = await supabase
          .from("children")
          .update(childData)
          .eq("id", data.id);

        if (error) throw error;
        toast.success(t('children.updateSuccess'));
      } else {
        // Insert new child
        const { error } = await supabase
          .from("children")
          .insert(childData);

        if (error) throw error;
        toast.success(t('children.addSuccess'));
      }

      setIsDialogOpen(false);
      setEditingChild(null);
      fetchChildren();
    } catch (error) {
      console.error("Error saving child:", error);
      toast.error(t('children.saveError'));
    }
  };

  const handleDelete = async () => {
    if (!deletingChildId) return;

    try {
      const { error } = await supabase
        .from("children")
        .delete()
        .eq("id", deletingChildId);

      if (error) throw error;
      toast.success(t('children.deleteSuccess'));
      fetchChildren();
    } catch (error) {
      console.error("Error deleting child:", error);
      toast.error(t('children.deleteError'));
    } finally {
      setDeletingChildId(null);
    }
  };

  const handleEdit = (child: Child) => {
    setEditingChild(child);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingChild(null);
    setIsDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/settings")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">{t('children.title')}</h1>
        </div>

        <Button onClick={handleAdd} className="w-full" size="lg">
          <Plus className="mr-2 h-5 w-5" />
          {t('children.addChild')}
        </Button>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            {t('children.loading')}
          </div>
        ) : children.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">{t('children.noChildren')}</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {children.map((child) => (
              <Card key={child.id} className="p-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    {child.photo_url ? (
                      <AvatarImage src={child.photo_url} alt={child.name} />
                    ) : (
                      <AvatarFallback className="text-3xl">👶</AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold">{child.name}</h3>
                    <p className="text-muted-foreground">
                      {calculateAge(child.birthdate)} {t('children.yearsOld')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(child)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingChildId(child.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingChild ? t('children.editChild') : t('children.addChild')}
              </DialogTitle>
              <DialogDescription>
                {t('children.formDescription')}
              </DialogDescription>
            </DialogHeader>
            <ChildForm
              initialData={editingChild || undefined}
              onSubmit={handleSubmit}
              onCancel={() => {
                setIsDialogOpen(false);
                setEditingChild(null);
              }}
            />
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deletingChildId} onOpenChange={(open) => !open && setDeletingChildId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('children.deleteConfirmTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('children.deleteConfirmDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('children.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>
                {t('children.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default Children;
