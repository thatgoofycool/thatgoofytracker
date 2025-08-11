FROM debian:stable-slim

RUN apt-get update && apt-get install -y curl ca-certificates ffmpeg && rm -rf /var/lib/apt/lists/*

ENV NODE_VERSION=20.16.0
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . ./

EXPOSE 8080
CMD ["node", "server.js"]


