# Use an official Python runtime as a parent image
FROM python:3.11-alpine

# Install Node.js and npm
RUN apk add --update nodejs npm

# Install build dependencies
RUN apk add --no-cache gcc musl-dev libffi-dev openssl-dev cargo

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci

# Copy requirements.txt
COPY requirements.txt ./

# Install Python dependencies
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Build the Next.js app
RUN npm run build

# Expose the port the app runs on
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Create a directory for SSL certificates
RUN mkdir -p /app/certs

# Start the application
CMD ["npm", "run", "start:https"]

