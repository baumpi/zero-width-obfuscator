# Zero‑Width Obfuscator
Simple, minimal, versatile red‑teaming utility. Dockerized static site served by Nginx.

## Run locally
```bash
npm i
npm run dev
npm run build
npm run preview
```

## Tests
```bash
npm test
```

## Docker (local)
```bash
docker build -t zw-obfuscator:latest .
docker run --rm -p 8080:80 zw-obfuscator:latest
# open http://localhost:8080
```

## Docker Compose
```bash
docker compose up --build -d
```

## Unraid
Option A — Build on Unraid:
```bash
docker build -t zw-obfuscator:latest .
docker run -d --name zw-obfuscator -p 8080:80 --restart unless-stopped zw-obfuscator:latest
```

Option B — Use Compose:
```bash
docker compose up -d --build
```

## Push to GitHub (first time)
```bash
GITHUB_USER="baumpi"
REPO="zero-width-obfuscator"

git init
git add .
git commit -m "feat: initial dockerized app"
git branch -M main
git remote add origin git@github.com:$GITHUB_USER/$REPO.git
git push -u origin main
```

If using HTTPS, set the remote to `https://github.com/$GITHUB_USER/$REPO.git`.

## Image via GHCR with Actions
Image will publish to: `ghcr.io/baumpi/zero-width-obfuscator:latest`
