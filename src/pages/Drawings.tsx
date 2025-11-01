import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Upload, Home, Check, Trash2 } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";

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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container max-w-6xl mx-auto p-4 space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")} title="Home">
                <Home className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-hero bg-clip-text text-transparent">
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
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setFilterChildId("all")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all whitespace-nowrap ${
                filterChildId === "all"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <span className="text-sm font-medium">All</span>
            </button>
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => setFilterChildId(child.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all whitespace-nowrap ${
                  filterChildId === child.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <Avatar className="h-6 w-6">
                  {child.photo_url && (
                    <AvatarImage src={child.photo_url} alt={child.name} />
                  )}
                  <AvatarFallback className="text-xs">
                    {child.photo_emoji || child.name[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{child.name}</span>
              </button>
            ))}
          </div>
        </div>

        {drawings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">{t("drawings.noDrawings")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {filteredGroupedDrawings.map((group) => (
              <div key={group.date} className="space-y-4">
                <div className="flex items-center justify-between bg-gradient-subtle backdrop-blur-sm rounded-2xl p-4 shadow-soft border border-border/50">
                  <h2 className="text-lg font-bold bg-gradient-hero bg-clip-text text-transparent">{group.date}</h2>
                  <button
                    onClick={() => toggleGroupSelection(group.date)}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-soft ${
                      group.allSelected 
                        ? "bg-primary text-primary-foreground scale-110" 
                        : "bg-background hover:bg-muted border border-border"
                    }`}
                  >
                    {group.allSelected && <Check className="h-5 w-5" />}
                  </button>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {group.drawings.map((drawing) => (
                    <div key={drawing.id} className="relative group">
                      <div 
                        className="aspect-square relative rounded-2xl overflow-hidden cursor-pointer bg-card shadow-soft hover:shadow-medium transition-all duration-300 border border-border/50"
                        onClick={() => {
                          setFullScreenImage(drawing);
                          setImageLoading(true);
                        }}
                      >
                        <img
                          src={getThumbnailUrl(drawing)}
                          alt={drawing.title || "Drawing"}
                          className="w-full h-full object-cover transition-all duration-300 group-hover:scale-110"
                          loading="lazy"
                          decoding="async"
                          style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                        />
                        
                        {/* Gradient overlay on hover */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        
                        {/* Child avatar badge */}
                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                          <Avatar className="h-8 w-8 border-2 border-white shadow-strong">
                            {drawing.children.photo_url && (
                              <AvatarImage src={drawing.children.photo_url} alt={drawing.children.name} />
                            )}
                            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                              {drawing.children.photo_emoji || drawing.children.name[0]}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        
                        {/* Checkbox overlay */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDrawingSelection(drawing.id);
                          }}
                          className={`absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center transition-all z-10 shadow-medium ${
                            drawing.selected
                              ? "bg-primary text-primary-foreground scale-100"
                              : "bg-white/90 text-foreground scale-0 group-hover:scale-100"
                          }`}
                        >
                          {drawing.selected && <Check className="h-4 w-4" />}
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
          }
        }}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-background/98 backdrop-blur-xl border-2 border-border/50">
            <div className="relative w-full h-full flex flex-col items-center justify-center p-6 gap-6">
              {imageLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/30 border-t-primary"></div>
                </div>
              )}
              {fullScreenImage && (
                <>
                  {/* Header with child info */}
                  <div className="w-full flex items-center justify-center gap-4 bg-gradient-subtle px-6 py-4 rounded-2xl shadow-soft border border-border/50">
                    <Avatar className="h-12 w-12 border-2 border-primary shadow-soft">
                      {fullScreenImage.children.photo_url && (
                        <AvatarImage src={fullScreenImage.children.photo_url} alt={fullScreenImage.children.name} />
                      )}
                      <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                        {fullScreenImage.children.photo_emoji || fullScreenImage.children.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-bold text-lg">{fullScreenImage.children.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(fullScreenImage.photo_date || fullScreenImage.created_at).toLocaleDateString('ja-JP', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                  
                  {/* Image container */}
                  <div className="relative flex-1 w-full flex items-center justify-center">
                    <img
                      src={getFullImageUrl(fullScreenImage)}
                      alt={fullScreenImage.title || "Drawing"}
                      className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-strong"
                      onLoad={() => setImageLoading(false)}
                      onError={() => setImageLoading(false)}
                      style={{ 
                        opacity: imageLoading ? 0 : 1, 
                        transition: 'opacity 0.5s ease-in-out',
                        border: '4px solid hsl(var(--border) / 0.3)'
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Floating delete button */}
      {selectedDrawings.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button 
            variant="destructive" 
            size="lg"
            onClick={handleBulkDelete}
            className="gap-2 shadow-lg"
          >
            <Trash2 className="h-5 w-5" />
            Delete ({selectedDrawings.length})
          </Button>
        </div>
      )}
    </div>
  );
}
