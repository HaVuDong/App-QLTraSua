FROM node:22-bookworm-slim AS build

WORKDIR /app

ENV EXPO_NO_TELEMETRY=1
ARG EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
ARG EXPO_PUBLIC_CUSTOMER_APP_BASE_URL=http://localhost:8080
ENV EXPO_PUBLIC_API_BASE_URL=$EXPO_PUBLIC_API_BASE_URL
ENV EXPO_PUBLIC_CUSTOMER_APP_BASE_URL=$EXPO_PUBLIC_CUSTOMER_APP_BASE_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build:web

FROM nginx:1.27-alpine AS runner

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
