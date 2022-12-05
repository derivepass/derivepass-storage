# derivepass-storage

Minimal storage server for [DerivePass](https://derivepass.com/).

## Installation

```sh
npm install
npm run build

# Create new user
node util/add-user.js -u username -p password

# Start the server
npm start
```

## Running as service

Place this service information into `/etc/systemd/system/derivepass.service`:
```
[Unit]
Description="storage.derivepass.com"

[Service]
ExecStart=/usr/bin/node index.js
WorkingDirectory=/var/www/derivepass/app
Restart=always
RestartSec=10
Environment=NODE_ENV=production PORT=8000 DB_PATH=/var/www/derivepass/db.sqlite
User=derivepass
Group=derivepass

[Install]
WantedBy=multi-user.target
```

Build and start the service;
```sh
apt update
apt install build-essential
curl -fsSL https://deb.nodesource.com/setup_19.x | sudo -E bash - && \
    sudo apt-get install -y nodejs

adduser derivepass
mkdir /var/www/derivepass
chown derivepass:derivepass /var/www/derivepass
git clone https://github.com/derivepass/derivepass-storage \
    /var/www/derivepass/app
cd /var/www/derivepass/app
npm install
systemctl enable derivepass.service
systemctl start derivepass.service
```

Verify that it runs with:
```sh
systemctl status derivepass.service
```

## LICENSE

This software is licensed under the MIT License.
