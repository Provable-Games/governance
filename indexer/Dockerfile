FROM node:22.10.0-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Generate migrations
RUN npx drizzle-kit generate

# Default command
CMD ["npm", "start"]
