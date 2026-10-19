#!/bin/bash

# Exit on error
set -e

# Load environment variables
source .env.production

# Build Docker image
echo "Building Docker image..."
docker-compose build

# Stop and remove existing containers
echo "Stopping existing containers..."
docker-compose down

# Start containers
echo "Starting containers..."
docker-compose up -d

# Clean up unused images
echo "Cleaning up..."
docker image prune -f

echo "Deployment completed successfully!" 