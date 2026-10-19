# Use Node.js LTS version
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install --production

# Bundle app source
COPY . .

# Create necessary directories
RUN mkdir -p logs uploads

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["npm", "start"] 