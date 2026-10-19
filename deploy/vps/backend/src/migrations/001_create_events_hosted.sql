-- Create events_hosted table
CREATE TABLE IF NOT EXISTS events_hosted (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_title VARCHAR(255) NOT NULL,
  event_date DATE NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  short_description TEXT,
  detailed_description TEXT,
  featured_image TEXT,
  gallery_images JSONB DEFAULT '[]',
  image_tags JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
); 