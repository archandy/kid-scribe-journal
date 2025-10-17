import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { PhotoCropper } from "@/components/PhotoCropper";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  birthdate: z.date({
    required_error: "Birthdate is required",
  }),
  photo_url: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ChildFormProps {
  initialData?: {
    id?: string;
    name: string;
    birthdate: string;
    photo_url?: string;
    photo_emoji?: string;
  };
  onSubmit: (data: FormData & { id?: string }) => Promise<void>;
  onCancel: () => void;
}

export const ChildForm = ({ initialData, onSubmit, onCancel }: ChildFormProps) => {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(initialData?.photo_url);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      birthdate: initialData?.birthdate ? new Date(initialData.birthdate) : undefined,
      photo_url: initialData?.photo_url || "",
    },
  });

  const calculateAge = (birthdate: Date) => {
    const today = new Date();
    let age = today.getFullYear() - birthdate.getFullYear();
    const monthDiff = today.getMonth() - birthdate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthdate.getDate())) {
      age--;
    }
    return age;
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    // Create preview URL for cropping
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageToCrop(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedImage: Blob) => {
    setIsUploading(true);
    setImageToCrop(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in to upload photos");
        return;
      }

      // Delete old photo if exists
      if (photoUrl && initialData?.id) {
        const oldPath = photoUrl.split("/").pop();
        if (oldPath) {
          await supabase.storage
            .from("child-photos")
            .remove([`${session.user.id}/${oldPath}`]);
        }
      }

      // Upload cropped photo
      const fileName = `${Math.random().toString(36).substring(2)}.jpg`;
      const filePath = `${session.user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("child-photos")
        .upload(filePath, croppedImage);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("child-photos")
        .getPublicUrl(filePath);

      setPhotoUrl(publicUrl);
      form.setValue("photo_url", publicUrl);
      toast.success("Photo uploaded successfully");
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast.error("Failed to upload photo");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCropCancel = () => {
    setImageToCrop(null);
  };

  const handleRemovePhoto = () => {
    setPhotoUrl(undefined);
    form.setValue("photo_url", "");
  };

  const handleSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit({ ...data, id: initialData?.id, photo_url: photoUrl });
    } finally {
      setIsSubmitting(false);
    }
  };

  const watchedBirthdate = form.watch("birthdate");

  return (
    <>
      {imageToCrop && (
        <PhotoCropper
          image={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="photo_url"
          render={() => (
            <FormItem>
              <FormLabel>{t('children.photoEmoji')}</FormLabel>
              <FormControl>
                <div className="flex flex-col items-center gap-4">
                  <Avatar className="h-24 w-24">
                    {photoUrl ? (
                      <AvatarImage src={photoUrl} alt="Child photo" />
                    ) : (
                      <AvatarFallback className="text-4xl">👶</AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isUploading}
                      onClick={() => document.getElementById("photo-upload")?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {isUploading ? "Uploading..." : "Upload Photo"}
                    </Button>
                    {photoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemovePhoto}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    )}
                  </div>
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('children.name')}</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t('children.namePlaceholder')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="birthdate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>{t('children.birthdate')}</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span>{t('children.selectDate')}</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date > new Date() || date < new Date("1900-01-01")
                    }
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        {watchedBirthdate && (
          <div className="p-3 bg-muted rounded-lg">
            <FormLabel>{t('children.age')}</FormLabel>
            <p className="text-2xl font-semibold mt-1">
              {calculateAge(watchedBirthdate)} {t('children.yearsOld')}
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1"
          >
            {t('children.cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? t('children.saving') : t('children.save')}
          </Button>
        </div>
      </form>
    </Form>
    </>
  );
};
