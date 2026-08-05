# Web app: build the Vite bundle, serve it with nginx.
# Build arg VITE_PRICES_BASE points the client at the price proxy
# (docker-compose sets /api/prices); leave unset to hit json.tarkov.dev direct.
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile
ARG VITE_PRICES_BASE=
ENV VITE_PRICES_BASE=${VITE_PRICES_BASE}
RUN pnpm --filter @raidplanner/web build

FROM nginx:1.27-alpine
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
# envsubst in the nginx entrypoint fills PROXY_URL (default set here)
ENV PROXY_URL=http://proxy:8787
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
