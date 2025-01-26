# Mern-Ecommerce
scp build.zip root@167.71.234.220:/var/www

# HTTP Block (Port 80)
server {
    listen 80;
    server_name privily.co www.privily.co;

    # Redirect all traffic to HTTPS
    return 301 https://$host$request_uri;
}

# HTTPS Block (Port 443)
server {
    listen 443 ssl;
    server_name privily.co www.privily.co;

    ssl_certificate /etc/letsencrypt/live/privily.co/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/privily.co/privkey.pem;

    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Point to the frontend build folder for HTTPS
    root /var/www/privily-frontend;
    index index.html index.htm;

    # Handle static file requests (like images, CSS, JS, etc.)
    location /uploads/ {
        alias /var/www/privily-backend/uploads/; # The actual path to the uploads folder
        access_log off;
        expires max;
    }

    # Handle API requests
    location /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;

    # Add CORS headers
    add_header 'Access-Control-Allow-Origin' '*';
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS';
    add_header 'Access-Control-Allow-Headers' 'Origin, X-Requested-With, Content-Type, Accept, Authorization';

    # Handle preflight requests
    if ($request_method = OPTIONS) {
        return 204;
    }
    }

    # Serve the main frontend app
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Serve the admin frontend app at /admin
    location /admin/ {
        alias /var/www/admin/;  # Path to the admin frontend build files
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Error handling
    error_page 404 /index.html;
}



// nginx settings

           # Define $connection_upgrade for WebSocket support
map $http_upgrade $connection_upgrade {
    default "upgrade";
    ''      "close";
}

# HTTP Block (Redirect HTTP to HTTPS)
server {
    listen 80;
    server_name privily.co www.privily.co admin.privily.co;

    # Redirect all HTTP traffic to HTTPS
    return 301 https://$host$request_uri;
}

# HTTPS Block for privily.co and www.privily.co
server {
    listen 443 ssl;
    server_name privily.co www.privily.co;

    ssl_certificate /etc/letsencrypt/live/privily.co/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/privily.co/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /var/www/privily-frontend;
    index index.html;

    location /uploads/ {
        alias /var/www/privily-backend/uploads/;
        access_log off;
        expires max;
    }


location /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
        add_header 'Access-Control-Allow-Origin' "*" always;
        add_header 'Access-Control-Allow-Methods' "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header 'Access-Control-Allow-Headers' "Content-Type, Authorization" always;
        add_header 'Access-Control-Allow-Credentials' "true" always;

}

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /admin/ {
        alias /var/www/admin/;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    error_page 404 /index.html;
}

# HTTPS Block for admin.privily.co
server {
    listen 443 ssl;
    server_name admin.privily.co;

    ssl_certificate /etc/letsencrypt/live/privily.co/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/privily.co/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /var/www/admin;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    error_page 404 /index.html;
}

