# Dispatch Routing System - Production Deployment Guide

**Version**: 1.0.0
**Last Updated**: 2026-02-12
**Status**: Production Ready ✅

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [GraphHopper Service](#graphhopper-service)
6. [Redis Cache](#redis-cache)
7. [Deployment Steps](#deployment-steps)
8. [Verification & Smoke Tests](#verification--smoke-tests)
9. [Performance Targets](#performance-targets)
10. [Monitoring & Alerts](#monitoring--alerts)
11. [Rollback Plan](#rollback-plan)
12. [Maintenance Schedule](#maintenance-schedule)
13. [Troubleshooting](#troubleshooting)

---

## Overview

The Dispatch Routing System provides real-time route calculation, isochrone generation, and nearest team queries for emergency response operations. This guide covers production deployment for the following features:

- **Route Calculation**: Primary + alternative routes via GraphHopper
- **Isochrones**: Reachability polygons (5/10/15/30 minutes)
- **Nearest Teams**: Geospatial queries with MongoDB $geoNear
- **GPU Detection**: Adaptive rendering based on device capabilities
- **Caching**: Redis-backed response caching (1-hour TTL)

---

## Prerequisites

### System Requirements

- **Node.js**: 18.x or higher
- **MongoDB**: 6.0+ with 2dsphere index support
- **Redis**: 7.0+ (optional but recommended)
- **GraphHopper**: Self-hosted instance or API access
- **RAM**: Minimum 2GB available
- **CPU**: 2+ cores recommended

### Access Requirements

- MongoDB connection string with read/write permissions
- GraphHopper API key or self-hosted instance URL
- Redis connection URL (optional)
- AWS/CloudWatch credentials for monitoring (optional)

---

## Environment Configuration

### Required Environment Variables

Create/update `.env.production` with:

```bash
# Database
DATABASE_URL="mongodb+srv://user:password@cluster.mongodb.net/ricer?retryWrites=true&w=majority"

# GraphHopper Routing Service
GRAPHHOPPER_URL="https://graphhopper.example.com"
# OR for self-hosted:
# GRAPHHOPPER_URL="http://localhost:8989"

# Redis Cache (Optional - uses in-memory fallback if not provided)
REDIS_URL="redis://username:password@redis-host:6379"

# Application
NODE_ENV="production"
PORT=3000

# JWT Secret
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"

# Monitoring (Optional)
SENTRY_DSN="https://abc123@o123456.ingest.sentry.io/123456"
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
```

### Environment Variable Validation

Before deployment, validate all required variables:

```bash
# Validation script
node scripts/validate-env.js
```

Expected output:
```
✅ DATABASE_URL present
✅ GRAPHHOPPER_URL present
✅ JWT_SECRET present (length: 32+)
⚠️  REDIS_URL not set (using in-memory cache)
✅ All critical environment variables validated
```

---

## Database Setup

### MongoDB Configuration

#### 1. Create 2dsphere Index on Team.location

**Critical for geospatial queries** (nearest teams):

```javascript
// Connect to MongoDB
use ricer;

// Create 2dsphere index on teams.location
db.teams.createIndex(
  { location: "2dsphere" },
  { name: "location_2dsphere" }
);

// Verify index creation
db.teams.getIndexes();
```

Expected output:
```javascript
[
  { v: 2, key: { _id: 1 }, name: "_id_" },
  { v: 2, key: { status: 1 }, name: "status_1" },
  { v: 2, key: { type: 1 }, name: "type_1" },
  { v: 2, key: { location: "2dsphere" }, name: "location_2dsphere" } // ← This one
]
```

#### 2. Verify Team Document Structure

Ensure all team documents have valid GeoJSON Point locations:

```javascript
db.teams.findOne({ name: "Team Alpha" });
```

Expected structure:
```javascript
{
  _id: ObjectId("..."),
  name: "Team Alpha",
  type: "GROUND_CREW",
  status: "AVAILABLE",
  location: {
    type: "Point",
    coordinates: [-5.1056, 33.5275] // [longitude, latitude]
  },
  capacity: 6,
  equipment: ["hose", "ladder", "pump"],
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

#### 3. Database Health Check

```bash
# Run health check script
npm run db:health

# Expected output:
# ✅ MongoDB connection: OK
# ✅ Teams collection exists: 24 documents
# ✅ 2dsphere index present: location_2dsphere
# ✅ Sample geospatial query: OK (5 teams found within 50km)
```

---

## GraphHopper Service

### Option A: Self-Hosted GraphHopper

#### Installation

```bash
# Download GraphHopper
wget https://github.com/graphhopper/graphhopper/releases/download/8.0/graphhopper-web-8.0.jar

# Download map data for Morocco
wget https://download.geofabrik.de/africa/morocco-latest.osm.pbf

# Start GraphHopper
java -Xmx4g -Xms1g \
  -Ddw.graphhopper.datareader.file=morocco-latest.osm.pbf \
  -Ddw.graphhopper.graph.location=./graph-cache \
  -jar graphhopper-web-8.0.jar server config.yml
```

#### Configuration (config.yml)

```yaml
graphhopper:
  graph.flag_encoders: car,foot
  prepare.ch.weightings: fastest
  prepare.lm.weightings: fastest

  # Isochrone support
  prepare.ch.edge_based: off

  # Alternative routes
  routing.ch.disabling_allowed: true
  routing.alternative_route.max_paths: 3

server:
  application_connectors:
    - type: http
      port: 8989
  request_log:
    appenders:
      - type: file
        current_log_filename: ./logs/access.log
        archive: true
```

### Option B: GraphHopper Cloud API

Set `GRAPHHOPPER_URL=https://graphhopper.com/api/1/route` and include API key in requests.

**Not recommended** - Self-hosted provides better performance and no rate limits.

### Verification

Test GraphHopper connectivity:

```bash
curl -X POST http://localhost:8989/route \
  -H "Content-Type: application/json" \
  -d '{
    "points": [[-5.1056, 33.5275], [-5.0800, 33.5500]],
    "profile": "car",
    "instructions": true
  }'
```

Expected: JSON response with route data (distance, time, coordinates).

---

## Redis Cache

### Setup

```bash
# Install Redis (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install redis-server

# Start Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Verify
redis-cli ping
# Expected: PONG
```

### Configuration

Edit `/etc/redis/redis.conf`:

```conf
# Memory limit (2GB)
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence (optional - cache can be rebuilt)
save ""
appendonly no

# Security
requirepass your-redis-password
bind 127.0.0.1

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log
```

Restart Redis:
```bash
sudo systemctl restart redis-server
```

### Verification

```bash
# Test cache write/read
redis-cli -a your-redis-password
SET test "Hello from dispatch"
GET test
# Expected: "Hello from dispatch"

EXPIRE test 60
TTL test
# Expected: 60 (or less)
```

---

## Deployment Steps

### Pre-Deployment Checklist

- [ ] All environment variables set in production `.env`
- [ ] MongoDB 2dsphere index created
- [ ] GraphHopper service running and accessible
- [ ] Redis running (or using in-memory fallback)
- [ ] All tests passing (`npm run test`)
- [ ] Linting clean (`npm run lint`)
- [ ] TypeScript compilation successful (`npm run typecheck`)

### Step-by-Step Deployment

#### 1. Pull Latest Code

```bash
git checkout main
git pull origin main
```

#### 2. Install Dependencies

```bash
npm ci  # Use ci for production (clean install)
```

#### 3. Build Application

```bash
npm run build
```

Expected output:
```
Route (app)                                Size     First Load JS
┌ ○ /                                      142 B          87.3 kB
├ ○ /_not-found                            871 B          84.1 kB
├ ○ /api/dispatch/isochrones               0 B                0 B
├ ○ /api/dispatch/route                    0 B                0 B
├ ○ /api/dispatch/teams/nearest            0 B                0 B
└ ● /map                                   312 kB          399 kB
```

#### 4. Run Database Migrations

```bash
npx prisma generate
npx prisma db push
```

#### 5. Create MongoDB Indexes

```bash
npm run db:setup-indexes
```

#### 6. Start Production Server

```bash
# Using PM2 (recommended)
pm2 start npm --name "ricer-dispatch" -- run start
pm2 save

# OR using systemd
sudo systemctl start ricer-dispatch
```

#### 7. Verify Service Health

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "services": {
    "database": "ok",
    "redis": "ok",
    "graphhopper": "ok"
  },
  "timestamp": "2026-02-12T10:30:00.000Z"
}
```

---

## Verification & Smoke Tests

### Automated Smoke Tests

Run after deployment:

```bash
npm run test:smoke
```

### Manual Verification

#### Test 1: Route Calculation

```bash
curl -X POST http://localhost:3000/api/dispatch/route \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "origin": [-5.1056, 33.5275],
    "destination": [-5.0800, 33.5500],
    "profile": "fire_truck",
    "alternatives": 2
  }'
```

✅ Expected:
- Response time < 3s
- Primary route + up to 2 alternatives
- Header: `X-Cache: MISS` (first request)

#### Test 2: Isochrones Generation

```bash
curl -X POST http://localhost:3000/api/dispatch/isochrones \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "origin": [-5.1056, 33.5275],
    "profile": "fire_truck",
    "times": [5, 10, 15, 30]
  }'
```

✅ Expected:
- Response time < 3s
- 4 polygon features (one per time bucket)
- Header: `X-Cache: MISS` (first request), `HIT` (second request)

#### Test 3: Nearest Teams Query

```bash
curl -X POST http://localhost:3000/api/dispatch/teams/nearest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "location": [-5.1056, 33.5275],
    "maxDistance": 50000,
    "limit": 10,
    "status": "AVAILABLE"
  }'
```

✅ Expected:
- Response time < 200ms
- Teams sorted by distance
- Each team has `distance` property (meters)

#### Test 4: Map Layer Toggles (E2E)

```bash
npm run test:e2e -- dispatch-layer-controls.spec.ts
```

✅ Expected:
- All toggles (Routes, Active Teams, Isochrones) functional
- Layers show/hide correctly
- Tooltips display on hover

#### Test 5: GPU Detection

Open browser console, navigate to `/map`, check:

```
[Map] GPU tier set: tier-a { renderer: "webgl2", ... }
```

✅ Expected:
- GPU detection completes within 2s
- Map loads immediately (doesn't wait for GPU detection)
- Falls back to tier-c on timeout/error

---

## Performance Targets

### API Response Times (P95)

| Endpoint                       | Target   | Alert Threshold |
|--------------------------------|----------|-----------------|
| POST /api/dispatch/route       | <3s      | >5s             |
| POST /api/dispatch/isochrones  | <3s      | >5s             |
| POST /api/dispatch/teams/nearest | <200ms | >500ms          |

### Cache Performance

| Metric              | Target | Alert Threshold |
|---------------------|--------|-----------------|
| Cache hit rate      | >50%   | <30%            |
| Cache miss latency  | <3s    | >5s             |
| Redis connection    | 100%   | <99%            |

### Frontend Performance

| Metric                  | Target | Alert Threshold |
|-------------------------|--------|-----------------|
| Map load time           | <3s    | >5s             |
| FPS (Tier A/B, 5 routes) | ≥30   | <25             |
| FPS (Tier C, 3 routes)  | ≥25   | <20             |
| GPU detection time      | <2s    | Timeout at 2s   |

### Resource Utilization

| Resource           | Normal | Warning | Critical |
|--------------------|--------|---------|----------|
| MongoDB CPU        | <40%   | >60%    | >80%     |
| MongoDB Connections | <500  | >800    | >1000    |
| Redis Memory       | <1.5GB | >1.8GB  | >2GB     |
| Node.js Memory     | <1GB   | >1.5GB  | >2GB     |

---

## Monitoring & Alerts

### Metrics to Track

#### Application Metrics

```javascript
// CloudWatch/Prometheus metrics
dispatch.route.duration_ms (histogram)
dispatch.route.cache_hit (counter)
dispatch.route.error (counter)
dispatch.isochrone.duration_ms (histogram)
dispatch.isochrone.cache_hit (counter)
dispatch.teams.nearest.duration_ms (histogram)
dispatch.teams.nearest.count (gauge)
dispatch.gpu.tier_distribution (gauge)
```

#### Infrastructure Metrics

- MongoDB query time (P50, P95, P99)
- Redis cache hit rate
- GraphHopper request rate
- Network latency to GraphHopper
- Disk I/O (for MongoDB)

### Alert Configuration

#### Critical Alerts (Immediate Response)

```yaml
# Example: AWS CloudWatch Alarm
RouteAPIHighLatency:
  MetricName: dispatch.route.duration_ms
  Statistic: p95
  Threshold: 5000  # 5 seconds
  EvaluationPeriods: 2
  AlarmActions:
    - arn:aws:sns:us-east-1:123456:critical-alerts

MongoDBConnectionFailure:
  MetricName: database.connection.failures
  Statistic: Sum
  Threshold: 5
  Period: 300  # 5 minutes
  AlarmActions:
    - arn:aws:sns:us-east-1:123456:critical-alerts
```

#### Warning Alerts (Monitor)

```yaml
LowCacheHitRate:
  MetricName: dispatch.route.cache_hit_rate
  Statistic: Average
  Threshold: 0.3  # 30%
  EvaluationPeriods: 3
  Period: 900  # 15 minutes
  AlarmActions:
    - arn:aws:sns:us-east-1:123456:warning-alerts
```

### Logging Configuration

Structured JSON logging for all dispatch operations:

```javascript
// Example log entry
{
  "timestamp": "2026-02-12T10:30:15.234Z",
  "level": "info",
  "event": "route_calculated",
  "meta": {
    "userId": "user-123",
    "origin": [-5.1056, 33.5275],
    "destination": [-5.0800, 33.5500],
    "profile": "fire_truck",
    "distance_km": 12.5,
    "duration_min": 18,
    "durationMs": 2341,
    "provider": "graphhopper",
    "cached": false
  }
}
```

Log retention:
- Application logs: 30 days
- Access logs: 90 days
- Error logs: 1 year

---

## Rollback Plan

### Scenario: Critical Bug in Dispatch System

#### Option 1: Feature Flag Disable (Fastest)

```bash
# Disable dispatch features via environment variable
export FEATURE_DISPATCH_ENABLED=false

# Restart application
pm2 restart ricer-dispatch
```

Time: ~30 seconds

#### Option 2: Roll Back to Previous Deployment

```bash
# List PM2 apps
pm2 list

# Stop current deployment
pm2 stop ricer-dispatch

# Switch to previous build
cd /var/www/ricer/releases/previous
npm ci
npm run build

# Start previous version
pm2 start npm --name "ricer-dispatch" -- run start
```

Time: ~5 minutes

#### Option 3: Database Rollback (If Schema Changed)

```bash
# Revert Prisma migrations
npx prisma migrate resolve --rolled-back migration_name

# OR restore from backup
mongorestore --uri="mongodb://..." --db=ricer /backups/ricer-2026-02-12
```

Time: ~15 minutes (depends on database size)

### Rollback Testing

Test rollback procedure monthly:

```bash
npm run test:rollback
```

---

## Maintenance Schedule

### Daily

- [ ] Monitor CloudWatch/Prometheus dashboards
- [ ] Check error logs for anomalies
- [ ] Verify cache hit rate >50%

### Weekly

- [ ] Review performance metrics trends
- [ ] Check MongoDB index usage
- [ ] Verify Redis memory usage
- [ ] Run smoke tests in staging

### Monthly

- [ ] Update dependencies (`npm audit`, `npm outdated`)
- [ ] Review and optimize database queries
- [ ] Test rollback procedure
- [ ] Review and update monitoring thresholds
- [ ] Capacity planning review

### Quarterly

- [ ] GraphHopper map data update
- [ ] Security audit
- [ ] Load testing with realistic traffic
- [ ] Disaster recovery drill

---

## Troubleshooting

### Issue: Route API Returns 504 Timeout

**Symptoms**:
- POST /api/dispatch/route returns 504
- Logs show "ROUTING_TIMEOUT"

**Diagnosis**:
```bash
# Check GraphHopper service
curl http://localhost:8989/health

# Check GraphHopper logs
tail -f /path/to/graphhopper/logs/access.log
```

**Resolution**:
1. Verify GraphHopper is running: `systemctl status graphhopper`
2. Check network connectivity: `ping graphhopper-host`
3. Increase timeout in `graphhopper.ts` (default: 10s)
4. Check GraphHopper CPU/memory usage

---

### Issue: Isochrones Return Empty Features

**Symptoms**:
- POST /api/dispatch/isochrones returns `features: []`
- No errors in logs

**Diagnosis**:
```bash
# Test GraphHopper isochrone endpoint directly
curl "http://localhost:8989/isochrone?point=33.5275,-5.1056&time_limit=300&buckets=1&profile=car"
```

**Resolution**:
1. Verify GraphHopper supports isochrones (requires LM preparation)
2. Check coordinates format (lat,lon for GraphHopper)
3. Verify time_limit is in seconds, not minutes
4. Check GraphHopper config includes `prepare.lm.weightings`

---

### Issue: Nearest Teams Returns No Results

**Symptoms**:
- POST /api/dispatch/teams/nearest returns empty array
- Logs show "nearest_teams_query_haversine" (fallback)

**Diagnosis**:
```bash
# Check 2dsphere index exists
mongo ricer --eval "db.teams.getIndexes()"

# Test $geoNear manually
mongo ricer --eval '
  db.teams.aggregate([
    {
      $geoNear: {
        near: { type: "Point", coordinates: [-5.1056, 33.5275] },
        distanceField: "distance",
        maxDistance: 50000,
        spherical: true
      }
    },
    { $limit: 5 }
  ])
'
```

**Resolution**:
1. Create missing 2dsphere index (see Database Setup)
2. Verify team locations are valid GeoJSON Points
3. Check coordinates order: [longitude, latitude]
4. Increase maxDistance if teams are far away

---

### Issue: Low Cache Hit Rate (<30%)

**Symptoms**:
- CloudWatch shows cache_hit_rate <30%
- High GraphHopper request volume

**Diagnosis**:
```bash
# Check Redis connection
redis-cli -a password ping

# Check cache stats
redis-cli -a password INFO stats | grep hits
```

**Resolution**:
1. Verify Redis is running and accessible
2. Check `REDIS_URL` environment variable
3. Increase cache TTL (currently 1 hour)
4. Monitor for cache evictions (maxmemory policy)
5. Consider increasing Redis memory limit

---

### Issue: GPU Detection Blocking Map Load

**Symptoms**:
- Map takes >3s to load
- Console shows "[GPU] Detection timeout"

**Diagnosis**:
- Check browser console for GPU detection logs
- Verify timeout is set to 2s (default)

**Resolution**:
1. GPU detection should never block - verify useEffect in RicerMap.tsx
2. Check for errors in detectGPUCapabilities()
3. Verify fallback to Tier C on timeout
4. Consider disabling GPU detection for specific browsers/devices

---

## Support & Escalation

### Internal Contacts

- **DevOps Lead**: devops@ricer.example.com
- **Backend Team**: backend@ricer.example.com
- **Frontend Team**: frontend@ricer.example.com
- **On-Call Engineer**: PagerDuty escalation

### External Vendors

- **GraphHopper Support**: support@graphhopper.com
- **MongoDB Support**: support@mongodb.com
- **AWS Support**: AWS Support Console

### Incident Response

1. **P0 (Critical)**: Complete service outage → Immediate rollback
2. **P1 (High)**: Degraded performance → Investigate + rollback if needed
3. **P2 (Medium)**: Non-critical bug → Fix in next deployment
4. **P3 (Low)**: Minor issue → Backlog for future sprint

---

## Appendix

### A. GraphHopper Profile Mapping

| Our Profile  | GraphHopper Profile | Speed Limit |
|--------------|---------------------|-------------|
| fire_truck   | car                 | No limit    |
| car          | car                 | Standard    |
| foot         | foot                | 5 km/h      |

### B. MongoDB Connection String Format

```
mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
```

### C. Redis Connection String Format

```
redis://username:password@hostname:6379
```

### D. Useful Commands

```bash
# Check application logs
pm2 logs ricer-dispatch --lines 100

# Monitor system resources
htop

# Check MongoDB query performance
mongo ricer --eval "db.teams.explain('executionStats').aggregate([...])"

# Test Redis latency
redis-cli --latency -h redis-host -a password

# Restart GraphHopper
systemctl restart graphhopper

# Clear Redis cache
redis-cli -a password FLUSHDB
```

---

**Document Version**: 1.0.0
**Last Reviewed**: 2026-02-12
**Next Review**: 2026-03-12

For questions or updates, contact: devops@ricer.example.com
