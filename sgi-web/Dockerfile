FROM node:20-alpine AS build
WORKDIR /app

COPY sgi-web/package*.json ./
RUN npm ci

COPY sgi-web/ ./

ARG VITE_API_BASE_URL=/api
ARG VITE_BASE_PATH=/

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_BASE_PATH=$VITE_BASE_PATH

RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY sgi-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
