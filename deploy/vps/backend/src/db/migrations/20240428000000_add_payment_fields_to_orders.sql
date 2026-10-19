-- Add new payment-related columns to orders table
ALTER TABLE orders 
ADD COLUMN total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN deposit_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN balance_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN deposit_payment_link TEXT,
ADD COLUMN balance_payment_link TEXT,
ADD COLUMN deposit_paid_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN balance_paid_at TIMESTAMP WITH TIME ZONE;

-- Update order_status check constraint to include 'confirmed'
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_order_status_check 
CHECK (order_status IN ('pending', 'confirmed', 'paid', 'cancelled')); 