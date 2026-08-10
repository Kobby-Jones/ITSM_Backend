# ITSM Platform — Backend API

A production-ready IT Service Management backend built for Ghanaian organisations, supporting offline-first Flutter apps on Android, Windows, and Linux.

---

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quick Start (Local)](#quick-start-local)
- [Quick Start (Docker)](#quick-start-docker)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [API Reference](#api-reference)
- [Authentication](#authentication)
- [User Roles & Permissions](#user-roles--permissions)
- [SLA Configuration](#sla-configuration)
- [Ticket Routing Engine](#ticket-routing-engine)
- [Offline Sync Protocol](#offline-sync-protocol)
- [Running Tests](#running-tests)
- [Deployment (Railway)](#deployment-railway)
- [Project Structure](#project-structure)

---

## Architecture

```
Flutter Apps (Android / Windows / Linux)
            │
            ▼
    ┌─────────────────┐
    │  Express API     │  ← JWT Auth, RBAC, Rate Limiting
    │  (Node.js LTS)  │
    └────────┬────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
PostgreSQL          Redis
(Prisma ORM)    (Cache + BullMQ)
                     │
                     ▼
             Background Workers
             (Email / Push / SLA checks)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework | Express.js 4 |
| Database | PostgreSQL 16 |
| ORM | Prisma 5 |
| Cache / Queue | Redis 7 + BullMQ |
| Auth | JWT (access + refresh tokens) |
| Push Notifications | Firebase Cloud Messaging |
| Email | Nodemailer (SMTP) |
| File Uploads | Multer (disk storage) |
| API Docs | Swagger / OpenAPI 3 |
| Containerisation | Docker + Docker Compose |
| Testing | Jest + Supertest |

---

## Quick Start (Local)

### Prerequisites

- Node.js ≥ 20
- PostgreSQL ≥ 14 running locally
- Redis ≥ 7 running locally

```bash
# 1. Clone and install
git clone <repo-url>
cd itsm-backend
npm install

# 2. Copy environment file
cp .env.example .env
# Edit .env — minimum required:
#   DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, JWT_RESET_SECRET, JWT_VERIFY_SECRET

# 3. Create database and apply schema
createdb itsm_db   # or use psql
npx prisma migrate dev --name init

# 4. Seed demo data
node prisma/seed.js

# 5. Start development server
npm run dev
```

Server starts at `http://localhost:3000`  
API docs at `http://localhost:3000/api-docs`

---

## Quick Start (Docker)

```bash
# 1. Copy and fill environment file
cp .env.example .env
# Required: JWT secrets, SMTP, Firebase (optional for dev)

# 2. Start full stack (API + PostgreSQL + Redis)
docker compose up -d

# 3. Run migrations + seed inside container (first time)
docker compose run --rm migrate

# 4. Check logs
docker compose logs -f api
```

**Development mode with hot-reload:**
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

**Include dev tools (pgAdmin + Redis Commander):**
```bash
docker compose --profile dev up
```
- pgAdmin → `http://localhost:5050`  
- Redis Commander → `http://localhost:8081`

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `REDIS_HOST` | | `localhost` | Redis host |
| `REDIS_PORT` | | `6379` | Redis port |
| `REDIS_PASSWORD` | | — | Redis password |
| `JWT_SECRET` | ✅ | — | Access token signing secret (≥32 chars) |
| `JWT_REFRESH_SECRET` | ✅ | — | Refresh token secret |
| `JWT_RESET_SECRET` | ✅ | — | Password reset token secret |
| `JWT_VERIFY_SECRET` | ✅ | — | Email verify token secret |
| `JWT_ACCESS_EXPIRES_IN` | | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | | `7d` | Refresh token TTL |
| `PORT` | | `3000` | Server port |
| `NODE_ENV` | | `development` | `development` / `production` / `test` |
| `SMTP_HOST` | | — | SMTP server host |
| `SMTP_PORT` | | `587` | SMTP port |
| `SMTP_USER` | | — | SMTP username |
| `SMTP_PASS` | | — | SMTP password |
| `SMTP_FROM` | | — | From address (e.g. `noreply@yourapp.com`) |
| `FIREBASE_PROJECT_ID` | | — | Firebase project ID (FCM push) |
| `FIREBASE_CLIENT_EMAIL` | | — | Firebase service account email |
| `FIREBASE_PRIVATE_KEY` | | — | Firebase private key (with `\n`) |
| `ALLOWED_ORIGINS` | | `*` | Comma-separated CORS origins |
| `UPLOAD_DIR` | | `uploads` | Local upload directory |
| `MAX_FILE_SIZE` | | `10485760` | Max file upload size (bytes) |
| `RATE_LIMIT_MAX` | | `100` | Requests per window |
| `RATE_LIMIT_WINDOW_MS` | | `900000` | Rate limit window (15 min) |
| `BCRYPT_ROUNDS` | | `12` | bcrypt salt rounds |
| `SLA_CHECK_INTERVAL` | | `*/5 * * * *` | Cron for SLA breach checks |
| `DASHBOARD_CACHE_TTL` | | `60` | Dashboard cache TTL (seconds) |

---

## Database Setup

```bash
# Apply migrations (development)
npx prisma migrate dev

# Apply migrations (production / CI)
npx prisma migrate deploy

# Reset and reseed (development only — destructive!)
npx prisma migrate reset

# Seed demo data
node prisma/seed.js

# Open Prisma Studio (database GUI)
npx prisma studio
```

### Demo Credentials (after seed)

| Role | Email | Password |
|---|---|---|
| Super Admin | `superadmin@itsm.com` | `SuperAdmin@2024!` |
| IT Technician | `technician@itsm.com` | `Technician@2024!` |
| End User | `user@itsm.com` | `EndUser@2024!` |

---

## API Reference

Full interactive documentation is available at `/api-docs` when the server is running.

### Base URL
```
http://localhost:3000/api/v1
```

### Endpoints Summary

| Module | Base Path | Description |
|---|---|---|
| Auth | `/auth` | Register, login, tokens, password reset |
| Users | `/users` | Profile management, roles, FCM tokens |
| Tickets | `/tickets` | Full ITSM ticket lifecycle |
| SLA | `/sla` | SLA configs, status, reports |
| Routing | `/routing` | Auto-routing rules engine |
| Notifications | `/notifications` | In-app + push notifications |
| Knowledge Base | `/knowledge-base` | Articles, categories, ratings |
| Assets | `/assets` | IT asset tracking and assignment |
| Telemetry | `/telemetry` | Device health and diagnostics |
| Analytics | `/analytics` | KPIs, trends, performance reports |
| Sync | `/sync` | Offline-first batch sync |
| Search | `/search` | Global full-text search |
| Roles | `/roles` | Role and permission management |
| Audit | `/audit` | Audit log viewer |

---

## Authentication

The API uses JWT with short-lived access tokens and rotating refresh tokens.

```
POST /api/v1/auth/login
→ { accessToken, refreshToken, user }

# Use access token in all subsequent requests:
Authorization: Bearer <accessToken>

# When access token expires (401), refresh it:
POST /api/v1/auth/refresh-token
Body: { "refreshToken": "..." }
→ { accessToken, refreshToken }  ← refresh token is rotated

# Logout blacklists the access token:
POST /api/v1/auth/logout
```

---

## User Roles & Permissions

| Role | Key Permissions |
|---|---|
| `super_admin` | All permissions |
| `it_admin` | User management, all tickets, assets, analytics |
| `it_manager` | All tickets, analytics, SLA config, routing |
| `it_technician` | Assigned tickets, assets, KB |
| `end_user` | Own tickets only, KB read |

Permissions follow `resource:action` format, e.g.:
- `ticket:create`, `ticket:read:all`, `ticket:assign`, `ticket:escalate`
- `asset:create`, `asset:assign`
- `analytics:read`, `analytics:export`
- `system:config`, `system:sla`, `system:routing`

---

## SLA Configuration

Default SLA times (configurable via API or DB):

| Priority | Response Time | Resolution Time | Warning at |
|---|---|---|---|
| P1 Critical | 15 min | 4 hours | 80% |
| P2 High | 1 hour | 8 hours | 80% |
| P3 Medium | 4 hours | 24 hours | 80% |
| P4 Low | 8 hours | 48 hours | 80% |

SLA checks run every 5 minutes via BullMQ. Breached P1/P2 tickets are auto-escalated.

Update SLA config:
```http
PUT /api/v1/sla/configurations/P1_CRITICAL
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "responseTimeMinutes": 15,
  "resolutionTimeMinutes": 240,
  "warningThresholdPct": 80
}
```

---

## Ticket Routing Engine

Rules are evaluated in priority order (lowest number = first). Supported types:

| Rule Type | Condition Field | Example |
|---|---|---|
| `CATEGORY_BASED` | `category` | Route HARDWARE_ISSUES to hardware team |
| `PRIORITY_BASED` | `priorities` | Route P1 tickets to senior techs |
| `KEYWORD_BASED` | `keywords` | Keywords in title/description trigger routing |
| `DEPARTMENT_BASED` | `departmentId` | Route by user's department |
| `WORKLOAD_BASED` | — | Always assigns to least-loaded technician |

Create a routing rule:
```http
POST /api/v1/routing
Authorization: Bearer <admin-token>

{
  "name": "Hardware routing",
  "ruleType": "CATEGORY_BASED",
  "priority": 10,
  "conditions": { "category": "HARDWARE_ISSUES" },
  "departmentId": "<hardware-dept-id>"
}
```

---

## Offline Sync Protocol

The Flutter app queues operations locally when offline, then submits a batch when reconnected.

```http
POST /api/v1/sync/batch
Authorization: Bearer <token>

{
  "items": [
    {
      "offlineId": "uuid-generated-offline",
      "entityType": "ticket",
      "operation": "CREATE",
      "payload": {
        "title": "Printer not working in finance room 2B",
        "description": "The HP LaserJet stopped printing after power cut",
        "category": "PRINTING_PROBLEMS",
        "priority": "P3_MEDIUM"
      }
    },
    {
      "offlineId": "uuid-comment-offline",
      "entityType": "ticket",
      "operation": "COMMENT",
      "payload": {
        "ticketId": "server-assigned-id-or-offline-ref",
        "content": "Still not working this morning"
      }
    }
  ]
}
```

**Conflict resolution:** Server-authoritative. If `clientVersion` (ISO timestamp of last sync) is older than `ticket.updatedAt`, the server returns `{ conflict: true, serverData: {...} }` and the client must discard its local changes.

---

## Running Tests

```bash
# Unit tests only (no database required)
npm test -- --testPathPattern=unit

# All tests (requires test database)
TEST_DATABASE_URL=postgresql://... npm test

# Skip integration tests
SKIP_INTEGRATION_TESTS=true npm test

# Coverage report
npm run test:coverage

# Watch mode during development
npm run test:watch
```

---

## Deployment (Railway)

Railway auto-detects Node.js projects. Recommended setup:

1. **Create Railway project** and add:
   - Node.js service (this repo)
   - PostgreSQL plugin
   - Redis plugin

2. **Set environment variables** in Railway dashboard (all from `.env.example`)

3. **Start command:**
   ```
   npx prisma migrate deploy && node src/server.js
   ```
   Or add to `railway.toml`:
   ```toml
   [deploy]
   startCommand = "npx prisma migrate deploy && node src/server.js"
   healthcheckPath = "/health"
   healthcheckTimeout = 30
   ```

4. **First deploy:** Railway will run migrations automatically. Then manually run:
   ```bash
   railway run node prisma/seed.js
   ```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong JWT secrets (≥ 32 chars, randomly generated)
- [ ] Set `ALLOWED_ORIGINS` to your actual frontend domains
- [ ] Configure SMTP for email notifications
- [ ] Add Firebase credentials for push notifications
- [ ] Set `BCRYPT_ROUNDS=12` (minimum for production)
- [ ] Enable PostgreSQL SSL: add `?sslmode=require` to `DATABASE_URL`
- [ ] Set up log aggregation (Winston logs to files by default)
- [ ] Configure backup for PostgreSQL volume

---

## Project Structure

```
itsm-backend/
├── src/
│   ├── config/          # DB, Redis, Firebase, email, Swagger
│   ├── middleware/      # Auth, error handler, rate limiter, upload
│   ├── modules/
│   │   ├── auth/        # Register, login, tokens, password reset
│   │   ├── users/       # User CRUD, avatar, FCM token
│   │   ├── tickets/     # Full ITSM ticket lifecycle
│   │   ├── routing/     # Auto-routing rules engine
│   │   ├── sla/         # SLA config, breach detection
│   │   ├── notifications/ # In-app, push, email notifications
│   │   ├── knowledge-base/ # KB articles and ratings
│   │   ├── assets/      # IT asset management
│   │   ├── telemetry/   # Device health monitoring
│   │   ├── analytics/   # KPIs, trends, reports
│   │   ├── sync/        # Offline-first sync + global search
│   │   └── roles/       # Role/permission + audit log
│   ├── jobs/            # BullMQ workers and schedulers
│   ├── shared/
│   │   ├── constants/   # Roles, permissions, status enums
│   │   ├── errors/      # Typed error classes
│   │   └── response/    # Standardised API responses
│   ├── utils/           # Helpers, JWT utilities
│   └── server.js        # Express app entry point
├── prisma/
│   ├── schema.prisma    # Full database schema (21 models)
│   └── seed.js          # Demo data seeder
├── __tests__/
│   ├── unit/            # Pure unit tests (no DB)
│   ├── integration/     # API integration tests (supertest)
│   ├── helpers/         # Fixtures and test utilities
│   └── setup/           # Global setup/teardown
├── docker/
│   └── postgres/init.sql
├── Dockerfile
├── docker-compose.yml
├── docker-compose.dev.yml
└── .env.example
```

---

## npm Scripts

```bash
npm start          # Production server
npm run dev        # Development with nodemon hot-reload
npm test           # Run all tests
npm run test:unit  # Unit tests only
npm run test:coverage  # With coverage report
npm run lint       # ESLint
npm run db:migrate # Run Prisma migrations
npm run db:studio  # Open Prisma Studio
npm run db:seed    # Seed demo data
npm run db:reset   # Reset and reseed (dev only!)
```

---

## License

MIT — see `LICENSE` file.
