FROM node:20-alpine

WORKDIR /app

COPY backend/package*.json ./backend/

WORKDIR /app/backend

RUN npm ci --omit=dev

COPY backend/ ./
COPY frontend/ ../frontend/

ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

CMD ["npm", "start"]
