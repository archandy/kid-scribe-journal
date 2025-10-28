import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PhotoCropper } from "@/components/PhotoCropper";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  birthdate: z.string().min(1, "Birthdate is required"),
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
  const [signedUrl, setSignedUrl] = useState<string | undefined>();
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  // Generate signed URL for existing photo
  useEffect(() => {
    const getSignedUrl = async () => {
      if (photoUrl && !photoUrl.startsWith('data:')) {
        const { data } = await supabase.storage
          .from("child-photos")
          .createSignedUrl(photoUrl, 3600); // 1 hour expiry
        if (data) setSignedUrl(data.signedUrl);
      }
    };
    getSignedUrl();
  }, [photoUrl]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      birthdate: initialData?.birthdate || "",
      photo_url: initialData?.photo_url || "",
    },
  });

  const calculateAge = (birthdate: string) => {
    if (!birthdate) return null;
    const [year, month, day] = birthdate.split('-').map(Number);
    const today = new Date();
    let age = today.getFullYear() - year;
    const monthDiff = today.getMonth() + 1 - month;
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) {
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

      // Store the file path instead of URL
      setPhotoUrl(filePath);
      form.setValue("photo_url", filePath);
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
  const age = calculateAge(watchedBirthdate);

  // Generate year options (current year to 100 years ago)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  // Parse current birthdate
  const [selectedYear, selectedMonth, selectedDay] = watchedBirthdate 
    ? watchedBirthdate.split('-').map(Number) 
    : [null, null, null];

  const handleDateChange = (type: 'year' | 'month' | 'day', value: string) => {
    const currentValue = watchedBirthdate || `${currentYear}-01-01`;
    const [year, month, day] = currentValue.split('-');
    
    let newYear = year;
    let newMonth = month;
    let newDay = day;

    if (type === 'year') newYear = value;
    if (type === 'month') newMonth = value.padStart(2, '0');
    if (type === 'day') newDay = value.padStart(2, '0');

    // Validate day doesn't exceed month's max days
    const maxDays = new Date(Number(newYear), Number(newMonth), 0).getDate();
    if (Number(newDay) > maxDays) {
      newDay = maxDays.toString().padStart(2, '0');
    }

    const newDate = `${newYear}-${newMonth}-${newDay}`;
    form.setValue('birthdate', newDate);
  };

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
                    {signedUrl ? (
                      <AvatarImage src={signedUrl} alt="Child photo" />
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
                      {isUploading ? t('form.uploading') : t('form.uploadPhoto')}
                    </Button>
                    {photoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemovePhoto}
                      >
                        <X className="h-4 w-4 mr-2" />
                        {t('form.remove')}
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
          render={() => (
            <FormItem className="flex flex-col">
              <FormLabel>{t('children.birthdate')}</FormLabel>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Select 
                    value={selectedYear?.toString() || ""} 
                    onValueChange={(value) => handleDateChange('year', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('form.year')} />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Select 
                    value={selectedMonth?.toString() || ""} 
                    onValueChange={(value) => handleDateChange('month', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('form.month')} />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((month) => (
                        <SelectItem key={month} value={month.toString()}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Select 
                    value={selectedDay?.toString() || ""} 
                    onValueChange={(value) => handleDateChange('day', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('form.day')} />
                    </SelectTrigger>
                    <SelectContent>
                      {days.map((day) => (
                        <SelectItem key={day} value={day.toString()}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {age !== null && (
          <div className="p-3 bg-muted rounded-lg">
            <FormLabel>{t('children.age')}</FormLabel>
            <p className="text-2xl font-semibold mt-1">
              {age} {t('children.yearsOld')}
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
