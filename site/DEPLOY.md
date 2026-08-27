# Landing page deployment — itspagecraft.com

The Pagecraft marketing site is a static build served from the main-domain document root.
The application remains isolated at `https://build.itspagecraft.com/`.

## Production target

- Public URL: `https://itspagecraft.com/`
- SSH alias: `itspagecraft-host`
- Document root: `/home/itspbuku/public_html`
- Local SSH configuration: `.pagecraft-local/ssh-config` in the primary Pagecraft checkout

## Validate

```bash
git diff --check
node --check site/main.js
```

Confirm that the structured data in `site/index.html` parses as JSON before deploying.

## Back up the current document root

Create a uniquely named archive outside the web root before every production update:

```bash
ssh -F .pagecraft-local/ssh-config itspagecraft-host \
  'mkdir -p /home/itspbuku/deployment-backups && \
   tar -czf /home/itspbuku/deployment-backups/itspagecraft-apex-before-<commit>-<utc>.tar.gz \
   -C /home/itspbuku/public_html .'
```

## Deploy

Upload only the runtime marketing files. Do not use `--delete`; the document root also contains
host-managed certificate and cPanel directories that must remain intact.

```bash
rsync -az --itemize-changes \
  -e 'ssh -F .pagecraft-local/ssh-config' \
  site/.htaccess site/index.html site/styles.css site/variants.css site/main.js \
  site/favicon.svg site/robots.txt site/sitemap.xml site/fonts site/images \
  itspagecraft-host:/home/itspbuku/public_html/
```

## Verify

Verify the apex page, crawler files, social image, stylesheet, and JavaScript over HTTPS. Compare
local and remote SHA-256 checksums for `index.html`, `styles.css`, and `main.js`, then check the
live page at desktop and mobile widths in the built-in browser.

## Roll back

Extract the matching pre-deploy archive into a temporary directory first, inspect it, and then
restore only the affected landing files. Never extract an unverified archive directly over the
document root.
