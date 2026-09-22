# Scripts Directory

Utility scripts organized by functionality.

## Structure

```
scripts/
├── db/           # Database maintenance & migrations
├── generate/     # Code generation scripts
├── services/     # Service management scripts
├── deploy/       # Deployment & verification scripts
└── debug/        # Debugging utilities (future)
```

---

## Database Scripts (`/db/`)

### fix-mongodb-indexes.js
Creates sparse unique indexes for MongoDB collections.

**Purpose:**
Fixes index issues when MongoDB expects unique constraints but has null values.

**Usage:**
```bash
npm run db:fix-indexes
```

**What it does:**
1. Connects to MongoDB using `DATABASE_URL`
2. Drops existing problematic indexes
3. Creates sparse unique indexes on email fields
4. Validates index creation

**Collections affected:**
- `User.email` - Sparse unique index
- Other collections as needed

**When to run:**
- After database schema changes
- When encountering duplicate key errors
- During initial setup

**Example output:**
```
Connecting to MongoDB...
Dropping old indexes...
Creating sparse unique indexes...
✓ User.email index created
Done!
```

---

## Generation Scripts (`/generate/`)

### generate-error-catalog.ts
Generates markdown documentation for all application errors.

**Purpose:**
Creates a human-readable error catalog from `AppError` class definitions.

**Usage:**
```bash
npm run generate:errors
```

**Input:**
- `src/lib/errors/AppError.ts` - Error definitions

**Output:**
- `docs/ERROR_CATALOG.md` - Generated documentation

**Generated content:**
- Error code
- HTTP status
- Translation key
- English message
- Context/usage notes

**Example output:**
```markdown
### 1000 - Validation Error
**Status:** 400 Bad Request
**Translation Key:** `errorValidation`
**Message:** Invalid input data
```

**When to run:**
- After adding/modifying error codes
- Before documentation reviews
- During release preparation

---

## Service Scripts (`/services/`)

### start-notification-worker.ts
Starts the background WhatsApp notification worker process.

**Purpose:**
Processes queued notification jobs and sends WhatsApp messages via Twilio.

**Usage:**
```bash
npm run worker:start
```

**Environment variables required:**
```env
REDIS_URL=redis://localhost:6379
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=whatsapp:+...
```

**How it works:**
1. Connects to Redis queue
2. Polls queue every 2 seconds
3. Processes up to 5 jobs per batch
4. Sends WhatsApp messages via Twilio
5. Implements retry logic (max 3 attempts)
6. Moves failed jobs to dead letter queue

**Features:**
- **Rate limiting**: 1 second delay between Twilio calls
- **Exponential backoff**: Failed jobs requeued with delay
- **Dead letter queue**: Permanently failed jobs preserved
- **Graceful shutdown**: Handles SIGINT/SIGTERM

**Monitoring:**
Logs structured JSON to stdout:
```json
{
  "timestamp": "2024-02-07T15:00:00Z",
  "level": "info",
  "event": "worker_started"
}
```

**When to run:**
- In production: Run as a persistent background service
- In development: Run in separate terminal when testing notifications
- After code changes: Restart worker to pick up changes

**Deployment:**
```bash
# Production (with PM2)
pm2 start npm --name "ricer-worker" -- run worker:start

# Docker
CMD ["npm", "run", "worker:start"]
```

---

## Deployment Scripts (`/deploy/`)

### verify-deploy.ts
Verifies deployment health and configuration.

**Purpose:**
Post-deployment smoke tests to ensure critical functionality works.

**Usage:**
```bash
npm run deploy:verify
```

**Checks performed:**
1. **Health endpoint**: `/api/health` returns 200
2. **Database connectivity**: Can connect to MongoDB
3. **Redis connectivity**: Can connect to Redis cache
4. **Environment variables**: All required vars set
5. **Authentication**: Can create test token
6. **Map tiles**: MapTiler API accessible

**Exit codes:**
- `0` - All checks passed
- `1` - One or more checks failed

**Example output:**
```
✓ Health endpoint responding
✓ Database connected
✓ Redis connected
✓ Environment variables configured
✓ Authentication functional
✓ Map tiles loading
```

**When to run:**
- After deploying to production
- After environment variable changes
- During troubleshooting
- In CI/CD pipeline

**CI/CD integration:**
```yaml
# GitHub Actions example
- name: Verify deployment
  run: npm run deploy:verify
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    REDIS_URL: ${{ secrets.REDIS_URL }}
```

---

## Package.json Scripts

All scripts are accessible via npm:

```json
{
  "db:fix-indexes": "node scripts/db/fix-mongodb-indexes.js",
  "generate:errors": "tsx scripts/generate/generate-error-catalog.ts",
  "worker:start": "tsx scripts/services/start-notification-worker.ts",
  "deploy:verify": "tsx scripts/deploy/verify-deploy.ts"
}
```

---

## Development Guidelines

### Adding New Scripts

1. **Choose the right category:**
   - Database operations → `/db/`
   - Code generation → `/generate/`
   - Background services → `/services/`
   - Deployment checks → `/deploy/`
   - Debugging tools → `/debug/`

2. **File naming:**
   - Use kebab-case: `fix-mongodb-indexes.js`
   - Be descriptive: `generate-error-catalog.ts` not `gen-errors.ts`

3. **Add npm script:**
   ```json
   "category:action": "tsx scripts/category/your-script.ts"
   ```

4. **Document here:**
   Add section explaining purpose, usage, when to run

5. **Error handling:**
   - Always catch errors
   - Log to structured logger
   - Exit with appropriate code (0 = success, 1 = failure)

6. **Environment variables:**
   - Load from `.env` if needed
   - Validate required vars early
   - Provide helpful error messages

### Script Template

```typescript
#!/usr/bin/env tsx
import { logger } from '@/lib/observability/logger';

async function main() {
  try {
    logger.info({ event: 'script_started', script: 'my-script' });

    // Script logic here

    logger.info({ event: 'script_completed', script: 'my-script' });
    process.exit(0);
  } catch (error) {
    logger.error({
      event: 'script_failed',
      script: 'my-script',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : { message: String(error) }
    });
    process.exit(1);
  }
}

main();
```

---

## Dependencies

Scripts may use:
- **tsx**: TypeScript execution (`tsx script.ts`)
- **Prisma Client**: Database access
- **Redis**: Queue/cache access
- **dotenv**: Environment variable loading

Install dev dependencies:
```bash
npm install -D tsx @types/node
```

---

## Troubleshooting

### "Cannot find module" errors
```bash
# Ensure tsx is installed
npm install -D tsx

# Run with explicit tsx
npx tsx scripts/your-script.ts
```

### Database connection failures
```bash
# Verify DATABASE_URL is set
echo $DATABASE_URL

# Test connection with Prisma
npx prisma db pull
```

### Redis connection failures
```bash
# Verify REDIS_URL is set
echo $REDIS_URL

# Test Redis connection
redis-cli -u $REDIS_URL ping
```

### Permission errors
```bash
# Make script executable
chmod +x scripts/your-script.ts

# Run with node/tsx explicitly
tsx scripts/your-script.ts
```

---

## Future Scripts

Planned additions:

- [ ] `/db/seed-test-data.ts` - Generate realistic test data
- [ ] `/db/migrate-legacy.ts` - Migrate from old schema
- [ ] `/generate/generate-api-docs.ts` - Auto-generate API docs from OpenAPI spec
- [ ] `/debug/analyze-performance.ts` - Performance profiling
- [ ] `/debug/check-permissions.ts` - Verify RBAC configuration
- [ ] `/services/start-metrics-collector.ts` - Metrics aggregation service
