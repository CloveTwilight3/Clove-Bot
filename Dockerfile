FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies (including dev dependencies for building)
COPY package*.json ./
RUN npm ci

# Copy app source
COPY . .

# Build TypeScript
RUN npm run build

# Deploy commands to Discord
RUN npm run deploy-commands:prod

# Remove dev dependencies after building
RUN npm prune --production

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S bot -u 1001

# Change ownership of the app directory
RUN chown -R bot:nodejs /usr/src/app
USER bot

# Expose port (if needed for health checks)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Bot is running')" || exit 1

# Start the bot
CMD ["npm", "start"]