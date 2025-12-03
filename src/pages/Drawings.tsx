import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Upload, Check, Trash2, Download, Sparkles } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Layout } from "@/components/Layout";
import { DrawingAnalysis } from "@/components/DrawingAnalysis";

import * as exifr from "exifr";

interface Child {
  id: string;
  name: string;
  photo_url?: string;
  photo_emoji?: string;
}

interface Drawing {
  id: string;
  image_url: string;
  thumbnail_url?: string;
  title?: string;
  created_at: string;
  photo_date?: string;
  child_id: string;
  children: Child;
  signedUrl?: string;
  thumbnailSignedUrl?: string;
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
  const [fullScreenImage, setFullScreenImage] = useState<Drawing | null>(null);
  const [loadedCount, setLoadedCount] = useState(30); // Load 30 images initially
  const [hasMore, setHasMore] = useState(true);
  const [imageLoading, setImageLoading] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

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

      const { data: drawingsData, count } = await supabase
        .from("drawings")
        .select(`
          id,
          image_url,
          thumbnail_url,
          title,
          created_at,
          photo_date,
          child_id,
          family_id,
          uploaded_by,
          children:child_id (
            id,
            name,
            photo_url,
            photo_emoji
          )
        `, { count: 'exact' })
        .eq("family_id", familyData.family_id)
        .order("photo_date", { ascending: false, nullsFirst: false })
        .limit(50);

      // Optimize: Generate signed URLs in batch and with longer expiry (24h)
      if (drawingsData) {
        setHasMore((count || 0) > 50);
        
        const drawingPaths = drawingsData.map(d => d.image_url);
        const thumbnailPaths = drawingsData
          .map(d => d.thumbnail_url)
          .filter(url => url) as string[];
        const childPhotoPaths = drawingsData
          .map(d => d.children.photo_url)
          .filter(url => url && !url.startsWith('http')) as string[];

        // Batch create signed URLs for better performance
        const [drawingUrls, thumbnailUrls, childPhotoUrls] = await Promise.all([
          supabase.storage.from("drawings").createSignedUrls(drawingPaths, 86400),
          thumbnailPaths.length > 0
            ? supabase.storage.from("drawings").createSignedUrls(thumbnailPaths, 86400)
            : Promise.resolve({ data: [], error: null }),
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

          let thumbnailSignedUrl = drawing.thumbnail_url 
            ? thumbnailUrls.data?.[thumbnailPaths.indexOf(drawing.thumbnail_url)]?.signedUrl || ""
            : "";

          return {
            ...drawing,
            signedUrl: drawingUrls.data?.[index]?.signedUrl || "",
            thumbnailSignedUrl,
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

  const generateThumbnail = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          // Calculate thumbnail dimensions (max 400px width)
          const maxWidth = 400;
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Failed to create thumbnail'));
              }
            },
            'image/jpeg',
            0.7
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const extractPhotoDate = async (file: File): Promise<Date | null> => {
    console.log("📸 Extracting EXIF from file:", {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: new Date(file.lastModified).toISOString()
    });
    
    try {
      const exif = await exifr.parse(file, {
        pick: ['DateTimeOriginal', 'CreateDate', 'DateTime', 'OffsetTimeOriginal'],
        translateKeys: false,
        translateValues: false,
        reviveValues: true
      });
      
      console.log("📊 EXIF data parsed:", exif);
      
      const raw = exif?.DateTimeOriginal || exif?.CreateDate || exif?.DateTime;
      
      if (!raw) {
        console.warn("⚠️ No EXIF date found in any field");
        return null;
      }

      console.log("✅ Found EXIF date:", raw, "Type:", typeof raw);

      // exifr returns Date objects directly, but handle string fallback
      if (raw instanceof Date) {
        console.log("✅ Returning Date object:", raw.toISOString());
        return raw;
      }
      if (typeof raw === "string") {
        const [d, t] = raw.split(" ");
        if (!d || !t) {
          console.warn("⚠️ Invalid date string format:", raw);
          return null;
        }
        const [Y, M, D] = d.split(":").map(Number);
        const [h, m, s] = t.split(":").map(Number);
        const date = new Date(Y, M - 1, D, h, m, s);
        console.log("✅ Parsed date from string:", date.toISOString());
        return date;
      }
      
      console.warn("⚠️ Unknown date format:", typeof raw);
      return null;
    } catch (error) {
      console.error("❌ EXIF parse error:", error);
      return null;
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files[0]) return;

    const file = event.target.files[0];
    console.log("📁 File selected:", {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: new Date(file.lastModified).toISOString()
    });
    
    if (!file.type.startsWith("image/")) {
      toast({ title: t("drawings.uploadError"), variant: "destructive" });
      return;
    }

    setSelectedFile(file);
    
    // Extract EXIF date
    console.log("🔍 Starting EXIF extraction...");
    const exifDate = await extractPhotoDate(file);
    const finalDate = exifDate || new Date(file.lastModified);
    console.log("📅 Final photo date:", finalDate.toISOString(), "Source:", exifDate ? "EXIF" : "lastModified");
    setPhotoDate(finalDate);
    
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
      const timestamp = Date.now();
      const fileName = `${timestamp}.${fileExt}`;
      const thumbnailFileName = `${timestamp}_thumb.jpg`;
      const filePath = `${familyId}/${fileName}`;
      const thumbnailPath = `${familyId}/${thumbnailFileName}`;

      // Generate thumbnail
      const thumbnailBlob = await generateThumbnail(selectedFile);

      // Upload both full-size and thumbnail in parallel
      const [uploadResult, thumbnailResult] = await Promise.all([
        supabase.storage.from("drawings").upload(filePath, selectedFile),
        supabase.storage.from("drawings").upload(thumbnailPath, thumbnailBlob)
      ]);

      if (uploadResult.error) throw uploadResult.error;
      if (thumbnailResult.error) throw thumbnailResult.error;

      const { error: insertError } = await supabase
        .from("drawings")
        .insert({
          family_id: familyId,
          child_id: selectedChild,
          image_url: filePath,
          thumbnail_url: thumbnailPath,
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

  const handleDownload = async (drawing: Drawing) => {
    try {
      const response = await fetch(getFullImageUrl(drawing));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${drawing.children.name}_${new Date(drawing.photo_date || drawing.created_at).toLocaleDateString()}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "Downloaded successfully" });
    } catch (error) {
      console.error("Error downloading:", error);
      toast({ title: "Failed to download", variant: "destructive" });
    }
  };

  const handleDelete = async (drawing: Drawing) => {
    if (!confirm(t("drawings.deleteConfirm"))) return;

    try {
      await supabase.storage.from("drawings").remove([drawing.image_url]);
      if (drawing.thumbnail_url) {
        await supabase.storage.from("drawings").remove([drawing.thumbnail_url]);
      }
      
      const { error } = await supabase
        .from("drawings")
        .delete()
        .eq("id", drawing.id);

      if (error) throw error;

      toast({ title: t("drawings.deleteSuccess") });
      setFullScreenImage(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting:", error);
      toast({ title: t("drawings.deleteError"), variant: "destructive" });
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedDrawings.length;
    if (!confirm(t("drawings.deleteConfirm") + ` (${count} ${count === 1 ? 'item' : 'items'})`)) return;

    try {
      // Delete storage files
      const imagePaths = selectedDrawings.map(d => d.image_url);
      const thumbnailPaths = selectedDrawings
        .map(d => d.thumbnail_url)
        .filter(url => url) as string[];

      await Promise.all([
        supabase.storage.from("drawings").remove(imagePaths),
        thumbnailPaths.length > 0 
          ? supabase.storage.from("drawings").remove(thumbnailPaths)
          : Promise.resolve()
      ]);
      
      // Delete database records
      const { error } = await supabase
        .from("drawings")
        .delete()
        .in("id", selectedDrawings.map(d => d.id));

      if (error) throw error;

      toast({ title: `${count} ${count === 1 ? 'item' : 'items'} ${t("drawings.deleteSuccess")}` });
      fetchData();
    } catch (error) {
      console.error("Error deleting:", error);
      toast({ title: t("drawings.deleteError"), variant: "destructive" });
    }
  };

  const getThumbnailUrl = (drawing: Drawing) => {
    return drawing.thumbnailSignedUrl || drawing.signedUrl || "";
  };

  const getFullImageUrl = (drawing: Drawing) => {
    return drawing.signedUrl || "";
  };

  const loadMoreDrawings = useCallback(async () => {
    if (!familyId || !hasMore) return;
    
    try {
      const { data: moreDrawings } = await supabase
        .from("drawings")
        .select(`
          id,
          image_url,
          thumbnail_url,
          title,
          created_at,
          photo_date,
          child_id,
          family_id,
          uploaded_by,
          children:child_id (
            id,
            name,
            photo_url,
            photo_emoji
          )
        `)
        .eq("family_id", familyId)
        .order("photo_date", { ascending: false, nullsFirst: false })
        .range(drawings.length, drawings.length + 49);

      if (moreDrawings && moreDrawings.length > 0) {
        const drawingPaths = moreDrawings.map(d => d.image_url);
        const thumbnailPaths = moreDrawings
          .map(d => d.thumbnail_url)
          .filter(url => url) as string[];
        const childPhotoPaths = moreDrawings
          .map(d => d.children.photo_url)
          .filter(url => url && !url.startsWith('http')) as string[];

        const [drawingUrls, thumbnailUrls, childPhotoUrls] = await Promise.all([
          supabase.storage.from("drawings").createSignedUrls(drawingPaths, 86400),
          thumbnailPaths.length > 0
            ? supabase.storage.from("drawings").createSignedUrls(thumbnailPaths, 86400)
            : Promise.resolve({ data: [], error: null }),
          childPhotoPaths.length > 0 
            ? supabase.storage.from("child-photos").createSignedUrls(childPhotoPaths, 86400)
            : Promise.resolve({ data: [], error: null })
        ]);

        const drawingsWithUrls = moreDrawings.map((drawing, index) => {
          let childPhotoUrl = drawing.children.photo_url;
          if (childPhotoUrl && !childPhotoUrl.startsWith('http')) {
            const photoIndex = childPhotoPaths.indexOf(childPhotoUrl);
            childPhotoUrl = childPhotoUrls.data?.[photoIndex]?.signedUrl || childPhotoUrl;
          }

          let thumbnailSignedUrl = drawing.thumbnail_url 
            ? thumbnailUrls.data?.[thumbnailPaths.indexOf(drawing.thumbnail_url)]?.signedUrl || ""
            : "";

          return {
            ...drawing,
            signedUrl: drawingUrls.data?.[index]?.signedUrl || "",
            thumbnailSignedUrl,
            selected: false,
            children: {
              ...drawing.children,
              photo_url: childPhotoUrl
            }
          };
        });

        setDrawings(prev => [...prev, ...drawingsWithUrls]);
        setHasMore(moreDrawings.length === 50);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error loading more drawings:", error);
    }
  }, [familyId, drawings.length, hasMore]);

  // Memoize selected drawings count
  const selectedDrawings = useMemo(() => {
    return drawings.filter(d => d.selected);
  }, [drawings]);

  // Memoize filtered and grouped drawings with progressive loading
  const filteredGroupedDrawings = useMemo(() => {
    const filtered = filterChildId === "all" 
      ? groupedDrawings 
      : groupedDrawings.map(group => ({
          ...group,
          drawings: group.drawings.filter(d => d.child_id === filterChildId)
        })).filter(group => group.drawings.length > 0);
    
    // Apply loaded count limit
    let count = 0;
    const limited = filtered.map(group => {
      const remainingSlots = loadedCount - count;
      if (remainingSlots <= 0) return { ...group, drawings: [] };
      
      const limitedDrawings = group.drawings.slice(0, remainingSlots);
      count += limitedDrawings.length;
      return { ...group, drawings: limitedDrawings };
    }).filter(group => group.drawings.length > 0);
    
    return limited;
  }, [groupedDrawings, filterChildId, loadedCount]);

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

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMoreDrawings();
        }
      },
      { threshold: 0.5 }
    );

    const sentinel = document.getElementById('load-more-sentinel');
    if (sentinel) observer.observe(sentinel);

    return () => observer.disconnect();
  }, [hasMore, loadMoreDrawings]);

  // Progressive image loading
  const handleScroll = useCallback(() => {
    const scrollPosition = window.innerHeight + window.scrollY;
    const documentHeight = document.documentElement.scrollHeight;
    
    if (scrollPosition >= documentHeight - 500 && loadedCount < drawings.length) {
      setLoadedCount(prev => Math.min(prev + 20, drawings.length));
    }
  }, [loadedCount, drawings.length]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          {t("drawings.title")}
        </h1>

        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button size="icon" variant="default">
              <Upload className="h-5 w-5" />
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
          
        {/* Child filter buttons */}
        <div className="flex items-center gap-2 overflow-x-auto border-b border-border pb-2 mb-6">
          <button
            onClick={() => setFilterChildId("all")}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              filterChildId === "all"
                ? "bg-secondary text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            All
          </button>
          {children.map((child) => (
            <button
              key={child.id}
              onClick={() => setFilterChildId(child.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                filterChildId === child.id
                  ? "bg-secondary text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <Avatar className="h-5 w-5">
                {child.photo_url && (
                  <AvatarImage src={child.photo_url} alt={child.name} />
                )}
                <AvatarFallback className="text-xs">
                  {child.photo_emoji || child.name[0]}
                </AvatarFallback>
              </Avatar>
              {child.name}
            </button>
          ))}
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
                <div className="flex items-center justify-between py-2">
                  <h2 className="text-sm font-semibold text-foreground">
                    {group.date}
                  </h2>
                  <button
                    onClick={() => toggleGroupSelection(group.date)}
                    className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                      group.allSelected 
                        ? "bg-primary text-primary-foreground" 
                        : "border border-border hover:bg-secondary"
                    }`}
                  >
                    {group.allSelected && <Check className="h-4 w-4" />}
                  </button>
                </div>
                
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                  {group.drawings.map((drawing) => (
                    <div key={drawing.id} className="relative group">
                      <div 
                        className="aspect-square relative rounded-lg overflow-hidden cursor-pointer bg-muted hover:opacity-90 transition-opacity"
                        onClick={() => {
                          setFullScreenImage(drawing);
                          setImageLoading(true);
                        }}
                      >
                        <img
                          src={getThumbnailUrl(drawing)}
                          alt={drawing.title || "Drawing"}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                        
                        {/* Checkbox overlay */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDrawingSelection(drawing.id);
                          }}
                          className={`absolute top-2 left-2 w-5 h-5 rounded flex items-center justify-center transition-all z-10 ${
                            drawing.selected
                              ? "bg-primary text-primary-foreground"
                              : "bg-background/80 opacity-0 group-hover:opacity-100"
                          }`}
                        >
                          {drawing.selected && <Check className="h-3 w-3" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            {/* Load more sentinel */}
            {hasMore && (
              <div id="load-more-sentinel" className="h-20 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">{t("common.loading") || "Loading..."}</p>
              </div>
            )}
          </div>
        )}

        {/* Full-screen image dialog */}
        <Dialog open={!!fullScreenImage} onOpenChange={(open) => {
          if (!open) {
            setFullScreenImage(null);
            setImageLoading(false);
            setShowAnalysis(false);
          }
        }}>
          <DialogContent className="max-w-full w-full h-full p-0 border-0 bg-transparent overflow-hidden">
            {/* Blurred background overlay */}
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: fullScreenImage ? `url(${getThumbnailUrl(fullScreenImage)})` : undefined,
                filter: 'blur(40px)',
                transform: 'scale(1.1)'
              }}
            />
            <div className="absolute inset-0 bg-white/60 backdrop-blur-xl" />
            
            {/* Content */}
            <div className="relative w-full h-full flex flex-col items-center justify-center p-8 sm:p-12 gap-4 sm:gap-6">
              {imageLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/30 border-t-primary"></div>
                </div>
              )}
              
              {fullScreenImage && (
                <>
                  {/* Main image - hide when showing analysis */}
                  {!showAnalysis && (
                    <div className="flex-1 w-full flex items-center justify-center max-h-[55vh]">
                      <img
                        src={getFullImageUrl(fullScreenImage)}
                        alt={fullScreenImage.title || "Drawing"}
                        className="max-w-[80vw] max-h-[55vh] object-contain rounded-xl shadow-2xl"
                        onLoad={() => setImageLoading(false)}
                        onError={() => setImageLoading(false)}
                        style={{ 
                          opacity: imageLoading ? 0 : 1, 
                          transition: 'opacity 0.3s ease-in-out'
                        }}
                      />
                    </div>
                  )}
                  
                  {/* Show analysis or options */}
                  {showAnalysis ? (
                    <DrawingAnalysis 
                      imageUrl={getFullImageUrl(fullScreenImage)}
                      childName={fullScreenImage.children.name}
                      onClose={() => setShowAnalysis(false)}
                    />
                  ) : (
                    /* Options card */
                    <div className="w-full max-w-md bg-white/95 backdrop-blur-sm rounded-3xl shadow-xl overflow-hidden">
                      {/* Child name */}
                      <div className="px-6 py-4 text-center border-b border-border/50">
                        <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'serif' }}>
                          {fullScreenImage.children.name}
                        </h2>
                      </div>
                      
                      {/* Analyze button */}
                      <button
                        onClick={() => setShowAnalysis(true)}
                        className="w-full px-6 py-5 flex items-center justify-center border-b border-border/50 hover:bg-black/5 transition-colors"
                      >
                        <Sparkles className="h-7 w-7 text-primary" />
                      </button>
                      
                      {/* Download button */}
                      <button
                        onClick={() => handleDownload(fullScreenImage)}
                        className="w-full px-6 py-5 flex items-center justify-center border-b border-border/50 hover:bg-black/5 transition-colors"
                      >
                        <Download className="h-7 w-7 text-foreground" />
                      </button>
                      
                      {/* Delete button */}
                      <button
                        onClick={() => handleDelete(fullScreenImage)}
                        className="w-full px-6 py-5 flex items-center justify-center hover:bg-black/5 transition-colors"
                      >
                        <Trash2 className="h-7 w-7 text-destructive" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      
        {/* Floating delete button */}
        {selectedDrawings.length > 0 && (
          <div className="fixed bottom-6 right-6 z-50">
            <Button 
              variant="destructive" 
              size="lg"
              onClick={handleBulkDelete}
              className="relative rounded-full h-14 w-14 p-0"
            >
              <Trash2 className="h-6 w-6" />
              <span className="absolute -top-1 -right-1 bg-background text-destructive text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-destructive">
                {selectedDrawings.length}
              </span>
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
