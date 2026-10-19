CREATE TABLE IF NOT EXISTS testimonials (
    id SERIAL PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT NOT NULL,
    featured_image_url VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create an index for faster searches
CREATE INDEX IF NOT EXISTS idx_testimonials_client_name ON testimonials (client_name);
CREATE INDEX IF NOT EXISTS idx_testimonials_location ON testimonials (location);
CREATE INDEX IF NOT EXISTS idx_testimonials_rating ON testimonials (rating);
CREATE INDEX IF NOT EXISTS idx_testimonials_status ON testimonials (status);