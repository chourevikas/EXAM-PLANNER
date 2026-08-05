FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package.json and lock file
COPY package.json package-lock.json ./
# Copy workspaces package.json files
COPY apps/web/package.json ./apps/web/
# Copy other packages if they exist (we'll just copy everything for simplicity)
COPY . .

RUN npm ci

RUN npm run build --workspace=@examplanner/web

FROM nginx:alpine
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
