FROM node:22.10.0-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies — use the committed lockfile so prod and CI match
RUN npm ci

# Copy source code (migrations are committed; no generate step needed)
COPY . .

# Build the Apibara indexer
RUN npx apibara build

# Default command
CMD ["npm", "start"]
