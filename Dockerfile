# Stage 1: build the React client
FROM node:24-slim AS build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: the image that runs
FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server/ ./server/
COPY --from=build /app/client/dist ./client/dist
RUN mkdir -p server/state server/backups && chown node:node server/state server/backups
USER node
EXPOSE 3001
CMD ["node", "server/index.js"]