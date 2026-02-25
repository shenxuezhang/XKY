# AGENTS.md

## Cursor Cloud specific instructions

### Architecture overview
- **Backend**: Node.js + Express REST API in `backend/` (port 3000)
- **Frontend**: Vanilla JS SPA served as static files from project root (port 8080)
- **Database**: MySQL 8.0, database name `emag_xpkb`, schema at `backend/database/schema.sql`

### Starting services

1. **MySQL**: `sudo mysqld --user=mysql &` (wait ~5s for startup)
2. **Backend**: `cd /workspace/backend && node server.js &` (port 3000, uses `.env` for config)
3. **Frontend**: `npx serve /workspace -l 8080 --no-clipboard &` (any static file server works)

### Database setup gotchas
- The `schema.sql` has `COMMENT` clauses on `FOREIGN KEY` constraints, which MySQL 8 does not support. Use sed to strip them before import:
  ```
  sed "s/ON DELETE CASCADE COMMENT '[^']*'/ON DELETE CASCADE/g; s/ON DELETE SET NULL COMMENT '[^']*'/ON DELETE SET NULL/g" backend/database/schema.sql | sudo mysql emag_xpkb
  ```
- The `purchase_orders` table references `suppliers`, but `FOREIGN_KEY_CHECKS = 0` at top of schema handles creation order.
- Root MySQL user should use `mysql_native_password` auth with empty password for local dev.

### Test user
Create with: `INSERT INTO users (username, password_hash, role) VALUES ('admin', '<bcrypt-hash-of-admin123>', 'admin');`
Credentials: `admin` / `admin123`

### No build step
The frontend has no build system — it uses ES modules, TailwindCSS via CDN, and SheetJS via CDN. No `npm run build` required for frontend.

### Package manager
Backend uses **npm** (see `backend/package-lock.json`). Run `npm install` inside `backend/`.

### Lint / Test
No ESLint or test framework is configured. `scripts/test/profitCalculator.test.js` is a browser-based ES module test (not runnable via Node directly). Backend syntax can be validated by requiring each file with Node.

### WPS Cloud integration
Optional. Requires `WPS_APP_ID`, `WPS_APP_SECRET`, `WPS_REDIRECT_URI` env vars for WPS (金山文档) OAuth. The app works fully without it — local Excel import is the primary data ingestion path.
