import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Upload, Home, Trash2, Check, Filter } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EXIF from "exif-js";

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
  photo_date?: string;
  child_id: string;
  children: Child;
  signedUrl?: string;
  selected?: boolean;
}

interface GroupedDrawings {
  date: string;
  drawings: Drawing[];
  allSelected: boolean;
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
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoDate, setPhotoDate] = useState<Date | null>(null);
  const [groupedDrawings, setGroupedDrawings] = useState<GroupedDrawings[]>([]);
  const [filterChildId, setFilterChildId] = useState<string>("all");

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
        .order("photo_date", { ascending: false, nullsFirst: false });

      // Optimize: Generate signed URLs in batch and with longer expiry (24h)
      if (drawingsData) {
        const drawingPaths = drawingsData.map(d => d.image_url);
        const childPhotoPaths = drawingsData
          .map(d => d.children.photo_url)
          .filter(url => url && !url.startsWith('http')) as string[];

        // Batch create signed URLs for better performance
        const [drawingUrls, childPhotoUrls] = await Promise.all([
          supabase.storage.from("drawings").createSignedUrls(drawingPaths, 86400),
          childPhotoPaths.length > 0 
            ? supabase.storage.from("child-photos").createSignedUrls(childPhotoPaths, 86400)
            : Promise.resolve({ data: [], error: null })
        ]);

        const drawingsWithUrls = drawingsData.map((drawing, index) => {
          let childPhotoUrl = drawing.children.photo_url;
          if (childPhotoUrl && !childPhotoUrl.startsWith('http')) {
            const photoIndex = childPhotoPaths.indexOf(childPhotoUrl);
            childPhotoUrl = childPhotoUrls.data?.[photoIndex]?.signedUrl || childPhotoUrl;
          }

          return {
            ...drawing,
            signedUrl: drawingUrls.data?.[index]?.signedUrl || "",
            selected: false,
            children: {
              ...drawing.children,
              photo_url: childPhotoUrl
            }
          };
        });
        setDrawings(drawingsWithUrls);
        
        // Group drawings by date
        const grouped = drawingsWithUrls.reduce((acc: GroupedDrawings[], drawing) => {
          const date = new Date(drawing.photo_date || drawing.created_at);
          const dateStr = date.toLocaleDateString('ja-JP', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
          
          const existingGroup = acc.find(g => g.date === dateStr);
          if (existingGroup) {
            existingGroup.drawings.push(drawing);
          } else {
            acc.push({
              date: dateStr,
              drawings: [drawing],
              allSelected: false
            });
          }
          return acc;
        }, []);
        
        setGroupedDrawings(grouped);
      } else {
        setDrawings([]);
        setGroupedDrawings([]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const extractPhotoDate = (file: File): Promise<Date | null> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          EXIF.getData(img as any, function() {
            const dateTimeOriginal = EXIF.getTag(this, "DateTimeOriginal");
            if (dateTimeOriginal) {
              // EXIF date format: "YYYY:MM:DD HH:MM:SS"
              const parts = dateTimeOriginal.split(" ");
              const dateParts = parts[0].split(":");
              const timeParts = parts[1].split(":");
              const date = new Date(
                parseInt(dateParts[0]),
                parseInt(dateParts[1]) - 1,
                parseInt(dateParts[2]),
                parseInt(timeParts[0]),
                parseInt(timeParts[1]),
                parseInt(timeParts[2])
              );
              resolve(date);
            } else {
              resolve(null);
            }
          });
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files[0]) return;

    const file = event.target.files[0];
    if (!file.type.startsWith("image/")) {
      toast({ title: t("drawings.uploadError"), variant: "destructive" });
      return;
    }

    setSelectedFile(file);
    
    // Extract EXIF date
    const exifDate = await extractPhotoDate(file);
    setPhotoDate(exifDate || new Date(file.lastModified));
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedChild || !familyId) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${familyId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("drawings")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("drawings")
        .insert({
          family_id: familyId,
          child_id: selectedChild,
          image_url: filePath,
          uploaded_by: user.id,
          photo_date: photoDate?.toISOString(),
        });

      if (insertError) throw insertError;

      toast({ title: t("drawings.uploadSuccess") });
      setUploadDialogOpen(false);
      setSelectedChild("");
      setPreviewImage(null);
      setSelectedFile(null);
      setPhotoDate(null);
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

  const getImageUrl = (drawing: Drawing) => {
    return drawing.signedUrl || "";
  };

  // Memoize filtered and grouped drawings
  const filteredGroupedDrawings = useMemo(() => {
    const filtered = filterChildId === "all" 
      ? groupedDrawings 
      : groupedDrawings.map(group => ({
          ...group,
          drawings: group.drawings.filter(d => d.child_id === filterChildId)
        })).filter(group => group.drawings.length > 0);
    return filtered;
  }, [groupedDrawings, filterChildId]);

  const toggleDrawingSelection = useCallback((drawingId: string) => {
    setDrawings(prev => prev.map(d => 
      d.id === drawingId ? { ...d, selected: !d.selected } : d
    ));
    setGroupedDrawings(prev => prev.map(group => ({
      ...group,
      drawings: group.drawings.map(d => 
        d.id === drawingId ? { ...d, selected: !d.selected } : d
      ),
      allSelected: group.drawings.every(d => 
        d.id === drawingId ? !d.selected : d.selected
      )
    })));
  }, []);

  const toggleGroupSelection = useCallback((dateStr: string) => {
    setGroupedDrawings(prev => prev.map(group => {
      if (group.date === dateStr) {
        const newSelected = !group.allSelected;
        return {
          ...group,
          allSelected: newSelected,
          drawings: group.drawings.map(d => ({ ...d, selected: newSelected }))
        };
      }
      return group;
    }));
    
    setDrawings(prev => prev.map(d => {
      const group = groupedDrawings.find(g => g.date === dateStr);
      const isInGroup = group?.drawings.some(gd => gd.id === d.id);
      if (isInGroup) {
        const targetGroup = groupedDrawings.find(g => g.date === dateStr);
        return { ...d, selected: !targetGroup?.allSelected };
      }
      return d;
    }));
  }, [groupedDrawings]);

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
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} title="Home">
              <Home className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-hero bg-clip-text text-transparent">
              {t("drawings.title")}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Select value={filterChildId} onValueChange={setFilterChildId}>
              <SelectTrigger className="w-[140px] md:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all") || "All"}</SelectItem>
                {children.map((child) => (
                  <SelectItem key={child.id} value={child.id}>
                    {child.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                {t("drawings.upload")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t("drawings.upload")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-medium mb-3 block">
                    {t("drawings.selectChild")}
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {children.map((child) => (
                      <button
                        key={child.id}
                        onClick={() => setSelectedChild(child.id)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                          selectedChild === child.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <Avatar className="h-12 w-12">
                          {child.photo_url && (
                            <AvatarImage src={child.photo_url} alt={child.name} />
                          )}
                          <AvatarFallback className="text-2xl">
                            {child.photo_emoji || child.name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium truncate w-full text-center">
                          {child.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {previewImage && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium block">
                      {t("drawings.preview")}
                    </label>
                    <img
                      src={previewImage}
                      alt="Preview"
                      className="w-full h-48 object-contain rounded-lg border"
                    />
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    {t("drawings.selectFile")}
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    disabled={uploading}
                    className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                  />
                </div>

                <Button
                  onClick={handleUpload}
                  disabled={!selectedChild || !selectedFile || uploading}
                  className="w-full"
                >
                  {uploading ? t("drawings.uploading") : t("drawings.uploadButton")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {drawings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">{t("drawings.noDrawings")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {filteredGroupedDrawings.map((group) => (
              <div key={group.date} className="space-y-3">
                <div className="flex items-center justify-between bg-background/80 backdrop-blur-sm rounded-lg p-3 border">
                  <h2 className="text-base font-semibold">{group.date}</h2>
                  <button
                    onClick={() => toggleGroupSelection(group.date)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                      group.allSelected 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    {group.allSelected && <Check className="h-4 w-4" />}
                  </button>
                </div>
                
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {group.drawings.map((drawing) => (
                    <div key={drawing.id} className="relative group">
                      <div className="aspect-square relative rounded-lg overflow-hidden">
                        <img
                          src={getImageUrl(drawing)}
                          alt={drawing.title || "Drawing"}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        
                        {/* Checkbox overlay */}
                        <button
                          onClick={() => toggleDrawingSelection(drawing.id)}
                          className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                            drawing.selected
                              ? "bg-primary text-primary-foreground scale-100"
                              : "bg-black/40 text-white scale-0 group-hover:scale-100"
                          }`}
                        >
                          {drawing.selected && <Check className="h-4 w-4" />}
                        </button>
                        
                        {/* Delete button on hover */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDelete(drawing)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
