# syntax=docker/dockerfile:1
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# 先装依赖（利用层缓存）
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 应用代码（注意：不 COPY data/config.json，密钥不进镜像）
COPY server.js ./
COPY public ./public

# 仅把配置模板烤进镜像根目录（不放 /app/data 下，避免被 data 卷挂载遮蔽）
COPY data/config.example.json /app/config.example.json

EXPOSE 3000
CMD ["node", "server.js"]
