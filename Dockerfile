# IDMS — container image. Node 22 LTS provides the built-in node:sqlite module.
FROM node:22.12-alpine

WORKDIR /app

# Install production dependencies first (better layer caching)
COPY package*.json ./
RUN npm install --omit=dev

# App source
COPY . .

ENV NODE_ENV=production
# Most hosts inject PORT; default to 8088 for local `docker run`.
ENV PORT=8088
EXPOSE 8088

# `npm start` runs: node --experimental-sqlite server/index.js
# The server auto-seeds the demo database on first boot.
CMD ["npm", "start"]
