interface Rental {
  id: string;
  title: string;
  description: string;
  category: string;
  featured_image?: string;
  gallery_images?: string[];
  bullet_points?: { key: string; value: string }[];
  pricing: number;
  status: string;
  created_at: string;
  updated_at: string;
} 