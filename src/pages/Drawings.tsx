import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Upload, ArrowLeft, Trash2 } from "lucide-react";

interface Child {
  id: string;
  name: string;
  photo_url?: string;
  photo_emoji?: string;
}

interface Drawing {
  id: string;
  image_url: string;
  title?: string;
  created_at: string;
  child_id: string;
  children: Child;
}

export default function Drawings() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [children, setChildren] = useState<Child[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [familyId, setFamilyId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: familyData } = await supabase
        .from("family_members")
        .select("family_id")
        .eq("user_id", user.id)
        .single();

      if (!familyData) return;
      setFamilyId(familyData.family_id);

      const { data: childrenData } = await supabase
        .from("children")
        .select("*")
        .eq("family_id", familyData.family_id)
        .order("name");

      setChildren(childrenData || []);

      const { data: drawingsData } = await supabase
        .from("drawings")
        .select(`
          *,
          children:child_id (
            id,
            name,
            photo_url,
            photo_emoji
          )
        `)
        .eq("family_id", familyData.family_id)
        .order("created_at", { ascending: false });

      setDrawings(drawingsData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files[0] || !selectedChild || !familyId) return;

    const file = event.target.files[0];
    if (!file.type.startsWith("image/")) {
      toast({ title: t("drawings.uploadError"), variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${familyId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("drawings")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("drawings")
        .insert({
          family_id: familyId,
          child_id: selectedChild,
          image_url: filePath,
          uploaded_by: user.id,
        });

      if (insertError) throw insertError;

      toast({ title: t("drawings.uploadSuccess") });
      setUploadDialogOpen(false);
      setSelectedChild("");
      fetchData();
    } catch (error) {
      console.error("Error uploading:", error);
      toast({ title: t("drawings.uploadError"), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (drawing: Drawing) => {
    if (!confirm(t("drawings.deleteConfirm"))) return;

    try {
      await supabase.storage.from("drawings").remove([drawing.image_url]);
      
      const { error } = await supabase
        .from("drawings")
        .delete()
        .eq("id", drawing.id);

      if (error) throw error;

      toast({ title: t("drawings.deleteSuccess") });
      fetchData();
    } catch (error) {
      console.error("Error deleting:", error);
      toast({ title: t("drawings.deleteError"), variant: "destructive" });
    }
  };

  const getImageUrl = (path: string) => {
    const { data } = supabase.storage.from("drawings").getPublicUrl(path);
    return data.publicUrl;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container max-w-6xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold bg-gradient-hero bg-clip-text text-transparent">
              {t("drawings.title")}
            </h1>
          </div>

          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                {t("drawings.upload")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("drawings.upload")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t("drawings.selectChild")}
                  </label>
                  <Select value={selectedChild} onValueChange={setSelectedChild}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {children.map((child) => (
                        <SelectItem key={child.id} value={child.id}>
                          {child.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t("drawings.selectFile")}
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUpload}
                    disabled={!selectedChild || uploading}
                    className="w-full"
                  />
                </div>
                {uploading && <p className="text-sm text-muted-foreground">{t("drawings.uploading")}</p>}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {drawings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">{t("drawings.noDrawings")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {drawings.map((drawing) => (
              <Card key={drawing.id} className="overflow-hidden group relative">
                <div className="aspect-square relative">
                  <img
                    src={getImageUrl(drawing.image_url)}
                    alt={drawing.title || "Drawing"}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDelete(drawing)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardContent className="p-2">
                  <p className="text-sm font-medium truncate">{drawing.children.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(drawing.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
