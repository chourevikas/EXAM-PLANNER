FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

# Where Super Admins are sent to sign in (the separate Super Admin app), e.g. https://superadmin.example.com
ARG VITE_SUPERADMIN_URL
ENV VITE_SUPERADMIN_URL=$VITE_SUPERADMIN_URL

ENV VITE_CLERK_PUBLISHABLE_KEY=pk_test_YW1hemVkLXN0YXJsaW5nLTQ2LmNsZXJrLmFjY291bnRzLmRldiQ

COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
