FROM node:22-slim AS build
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN DATABASE_URL=file:/tmp/build.db npm run build && npm prune --omit=dev

FROM node:22-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production DATABASE_URL=file:/data/dorfplaner.db
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src/lib/backup.ts ./src/lib/backup.ts
COPY --from=build /app/package.json ./
EXPOSE 3000
# Migrationen anwenden, dann starten
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -p 3000"]
