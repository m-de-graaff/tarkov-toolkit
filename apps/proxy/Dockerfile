FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-fund --no-audit
COPY server.mjs ./
ENV PORT=8787
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8787/healthz || exit 1
CMD ["node", "server.mjs"]
