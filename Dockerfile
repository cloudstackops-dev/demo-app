# ---- Build stage ----
FROM node:20-alpine AS build

WORKDIR /usr/src/app

COPY app/package.json ./
RUN npm install --omit=dev

COPY app/server.js ./

# ---- Runtime stage ----
FROM node:20-alpine AS runtime

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /usr/src/app

COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/package.json ./
COPY --from=build /usr/src/app/server.js ./

USER appuser

EXPOSE 3000

CMD ["node", "server.js"]
