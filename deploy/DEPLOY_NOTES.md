# Deployment Notes — Bondada Foundation Backend

## 1. Server prep
```
sudo adduser --system --group bondada
sudo mkdir -p /opt/bondada
sudo chown bondada:bondada /opt/bondada
sudo mkdir -p /etc/bondada
sudo chmod 700 /etc/bondada
```

## 2. Deploy code
```
# from your machine
rsync -avz --exclude node_modules --exclude storage/scholarships \
  bondada-backend/ user@your-vps:/opt/bondada/bondada-backend/

# on the VPS
cd /opt/bondada/bondada-backend
sudo -u bondada npm ci --omit=dev
```

## 3. Database

One file, no dump dependency — run these in order on a fresh database:

```
mysql -u root -p < database/00_schema.sql
mysql -u root -p < database/01_seed.sql
mysql -u root -p < database/02_procedures_scholarship.sql
mysql -u root -p < database/03_procedures_admin.sql
mysql -u root -p < database/04_procedures_contact.sql

node scripts/seed-admins.js   # after editing the ADMINS list in that file
```

Bind MySQL/MariaDB to localhost only (`bind-address = 127.0.0.1` in
my.cnf) — never expose 3306 publicly.

## 4. Environment
```
sudo cp .env.production /etc/bondada/.env.production
sudo chown bondada:bondada /etc/bondada/.env.production
sudo chmod 600 /etc/bondada/.env.production
# then edit it and fill in every REPLACE_WITH_... value,
# including the R2 credentials — see README.md "Cloudflare R2 setup"
```

## 5. Cloudflare R2

No migration step needed for a fresh setup — just set
`STORAGE_DRIVER=r2` and the R2_* variables before the first
applicant submits. See the top-level README.md for exactly where
to find each R2 credential in the Cloudflare dashboard.

## 6. systemd service
```
sudo cp deploy/bondada-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable bondada-backend
sudo systemctl start bondada-backend
sudo systemctl status bondada-backend
journalctl -u bondada-backend -f
```

## 7. nginx + TLS
```
sudo cp deploy/nginx-bondada.conf /etc/nginx/sites-available/bondada-api
sudo ln -s /etc/nginx/sites-available/bondada-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.bondadafoundation.org
```

## 8. Frontend

The public site and the in-app admin section are the same React
app now (`bondadafoundation/`) — one build, one deploy:

```
cd bondadafoundation
# .env — VITE_API_BASE_URL=https://api.bondadafoundation.org/api/v1
npm run build
# upload dist/ to your static host (nginx, Cloudflare Pages, etc.)
```

If you deploy the frontend on Cloudflare Pages, point it at this
same repo/folder and set `VITE_API_BASE_URL` as a Pages environment
variable at build time.

**Before deploying**: the `mainvideo.mp4` in `src/assets/videos/`
is ~120MB and gets bundled directly into the build output. Move it
to R2 (or Cloudflare Stream) and reference it by URL instead —
shipping a 120MB file in your JS bundle will make the site
unusably slow to load.

## 9. Log rotation
Add `/opt/bondada/bondada-backend/logs/*.log` to a logrotate config
(`/etc/logrotate.d/bondada`) if the app writes there — journald
already handles the systemd stdout/stderr stream.

## 10. Backups
- MySQL: nightly `mysqldump` (or `mariabackup`) to off-server storage.
- R2: enable object versioning on the bucket (Cloudflare dashboard →
  R2 → your bucket → Settings) so accidental deletes are recoverable.

## 11. Go-live checklist
- [ ] All 5 admin accounts created, temp passwords delivered securely
- [ ] `PATCH /applications/:id/status` rejects unauthenticated requests (confirm with curl)
- [ ] `.env.production` has real JWT secrets, real R2 credentials, real DB creds
- [ ] `STORAGE_DRIVER=r2` and a test application's documents actually appear in the R2 bucket
- [ ] systemd service enabled (`WantedBy=multi-user.target`) so it survives reboot
- [ ] nginx + TLS in front of the API
- [ ] Frontend's `VITE_API_BASE_URL` points at the production API domain, not localhost
- [ ] `mainvideo.mp4` moved out of the bundled assets
