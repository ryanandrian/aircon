# Dockerfile iot-bridge (Node, ringan — subscribe MQTT → POST ingest).
FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY index.ts ./
ENV NODE_ENV=production
CMD ["node", "--experimental-strip-types", "index.ts"]
