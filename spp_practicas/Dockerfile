FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY frontend/package*.json frontend/
RUN npm --prefix frontend ci
COPY . .
RUN npm --prefix frontend run build

FROM node:22-alpine
ENV NODE_ENV=production TZ=America/Bogota
RUN apk add --no-cache tzdata
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=20s --timeout=3s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
