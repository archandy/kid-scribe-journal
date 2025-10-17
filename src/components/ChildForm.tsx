import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  birthdate: z.date({
    required_error: "Birthdate is required",
  }),
  photo_emoji: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ChildFormProps {
  initialData?: {
    id?: string;
    name: string;
    birthdate: string;
    photo_emoji?: string;
  };
  onSubmit: (data: FormData & { id?: string }) => Promise<void>;
  onCancel: () => void;
}

export const ChildForm = ({ initialData, onSubmit, onCancel }: ChildFormProps) => {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      birthdate: initialData?.birthdate ? new Date(initialData.birthdate) : undefined,
      photo_emoji: initialData?.photo_emoji || "👶",
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

  const handleSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit({ ...data, id: initialData?.id });
    } finally {
      setIsSubmitting(false);
    }
  };

  const watchedBirthdate = form.watch("birthdate");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="photo_emoji"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('children.photoEmoji')}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="👶"
                  maxLength={2}
                  className="text-4xl text-center"
                />
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
  );
};
