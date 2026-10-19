import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useRouter } from "next/navigation";

interface RentalFormProps {
  initialData?: {
    id?: string;
    title?: string;
    description?: string;
    category?: string;
    featured_image?: string;
    gallery_images?: string[];
    specifications?: { key: string; value: string }[];
    pricing: number;
    status: string;
  };
}

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  featured_image: z.string().optional(),
  gallery_images: z.array(z.string()).optional(),
  specifications: z.array(z.object({
    key: z.string(),
    value: z.string()
  })).optional(),
  pricing: z.number().min(0, "Pricing must be a positive number"),
  status: z.string().min(1, "Status is required")
});

export function RentalForm({ initialData }: RentalFormProps) {
  const router = useRouter();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      category: initialData?.category || "Rental",
      featured_image: initialData?.featured_image || "",
      gallery_images: initialData?.gallery_images || [],
      specifications: initialData?.specifications || [],
      pricing: initialData?.pricing || 0,
      status: initialData?.status || "active"
    }
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const response = await fetch(initialData?.id ? `/api/v1/rentals/${initialData.id}` : '/api/v1/rentals', {
        method: initialData?.id ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error('Failed to save rental');
      }

      router.refresh();
      router.push("/rentals");
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };
} 