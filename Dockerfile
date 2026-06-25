FROM node:20-alpine

WORKDIR /app

COPY backend/package.json ./backend/package.json

WORKDIR /app/backend

RUN npm install --omit=dev

COPY backend/ ./
COPY frontend/ ../frontend/

ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

CMD ["npm", "start"]
