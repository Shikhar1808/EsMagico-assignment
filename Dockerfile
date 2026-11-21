# Stage 1: build the React client
FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: API server that also serves the built client
FROM node:22-alpine
WORKDIR /app/server
ENV NODE_ENV=production PORT=8080
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=client /app/client/dist /app/client/dist
EXPOSE 8080
USER node
CMD ["node", "server.js"]
