#!/bin/bash
set -e

echo "Creating Nginx configuration for super-admin.examplanner.in..."
cat << 'INNER_EOF' > /etc/nginx/sites-available/super-admin.examplanner.in
server {
    listen 80;
    server_name super-admin.examplanner.in;

    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
INNER_EOF

echo "Enabling the site..."
if [ ! -f /etc/nginx/sites-enabled/super-admin.examplanner.in ]; then
    ln -s /etc/nginx/sites-available/super-admin.examplanner.in /etc/nginx/sites-enabled/
fi

echo "Testing Nginx configuration..."
nginx -t

echo "Reloading Nginx..."
systemctl reload nginx

echo "Done! The super admin app should now be accessible (once the pipeline finishes deploying the container on port 3010)."
