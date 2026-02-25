# AGENTS.md

## Cursor Cloud specific instructions

### Project Overview

eMAG marketplace product selection and profit analysis system (`emag-xpkb`). Two-tier architecture:
- **Backend**: Node.js/Express REST API (port 3000) in `backend/`
- **Frontend**: Vanilla JS SPA (no build step) served as static files (port 8080)
- **Database**: MySQL 8 (`emag_xpkb` database)

### Starting Services

1. **MySQL**: `sudo mysqld --user=mysql --datadir=/var/lib/mysql --socket=/var/run/mysqld/mysqld.sock --pid-file=/var/run/mysqld/mysqld.pid &` (wait ~5s for startup)
2. **Backend**: `cd backend && node server.js &` (or `npm run dev` for nodemon auto-reload)
3. **Frontend**: `cd /workspace && python3 -m http.server 8080 &`

### Database Setup

Schema is at `backend/database/schema.sql` but has two issues that require manual workaround:
- `COMMENT` clauses on `FOREIGN KEY` constraints are not valid MySQL syntax — remove them
- `purchase_orders` table references `suppliers` which is defined after it — either reorder or use `SET FOREIGN_KEY_CHECKS = 0`

To apply schema: `sudo mysql -u root emag_xpkb < backend/database/schema.sql` (after fixing the above)

### Test User

No registration endpoint exists. Create users directly in MySQL:
```sql
INSERT INTO users (username, password_hash, role, is_active)
VALUES ('admin', '<bcrypt_hash>', 'admin', TRUE);
```
Generate hash: `node -e "console.log(require('bcryptjs').hashSync('admin123', 10))"`

Default test credentials: `admin` / `admin123`

### Environment Variables

Backend `.env` file in `backend/` directory. See `backend/env配置说明.txt` for full documentation. Key variables: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `CORS_ORIGIN`.

### Lint / Test / Build

- No dedicated linter or test runner is configured in `package.json`
- Frontend tests are browser-based ES Module scripts (run `window.runProfitTests()` in browser console after loading `scripts/test/profitCalculator.test.js`)
- No build step needed — frontend is served as-is via static HTTP server
- Backend can be verified with: `cd backend && node -e "require('./server.js')"`

### Gotchas

- The frontend **must** be served over HTTP (not `file://`) due to ES Module and Web Worker usage
- MySQL in this container env cannot start via systemd/init — must be started manually with `mysqld` command
- CORS is configured to allow all `localhost`/`127.0.0.1` origins in development mode
- WPS Cloud OAuth integration requires external API credentials (optional for core functionality)
