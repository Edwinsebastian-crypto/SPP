FROM node:22-alpine
ENV NODE_ENV=production TZ=America/Bogota
RUN apk add --no-cache tzdata
WORKDIR /srv
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY assets ./assets
COPY src ./src
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
