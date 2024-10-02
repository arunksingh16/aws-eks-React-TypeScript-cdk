# Stage 1: Build the app
FROM node:18-alpine AS build-stage

# Set the working directory
WORKDIR /app

# Copy the package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the app's source code
COPY . .

# Build the app for production
RUN npm run build

# Stage 2: Serve the app using a lightweight web server
FROM nginx:alpine AS production-stage

# Copy the built app from the previous stage
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start nginx server
CMD ["nginx", "-g", "daemon off;"]

