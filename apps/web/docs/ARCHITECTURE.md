# RICER Architecture

## Overview

**RICER** (Rapid Incident Coordination and Emergency Response) is a real-time wildfire management system for Ifrane Province, Morocco. The platform enables fire reporting, incident tracking, resource management, and emergency coordination.

## Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Mapping**: MapLibre GL JS with deck.gl for 3D visualization
- **Internationalization**: Custom i18n (Arabic, French, English)

### Backend
- **Runtime**: Node.js (Next.js API Routes)
- **Database**: MongoDB with Prisma ORM
- **Authentication**: JWT with bcrypt
- **Background Jobs**: Redis-based queue system
- **Notifications**: Twilio WhatsApp API
- **Caching**: Redis

### Testing
- **Unit/Integration**: Vitest + React Testing Library
- **E2E**: Playwright
- **Performance**: Lighthouse CI
- **Security**: Semgrep, OWASP ZAP

## Directory Structure

```
apps/web/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (protected)/        # Protected routes (authenticated users)
│   │   │   ├── map/            # Interactive incident map
│   │   │   ├── report/         # Fire reporting form
│   │   │   ├── reports-list/   # Report management
│   │   │   ├── analytics/      # Dashboard & statistics
│   │   │   ├── equipment/      # Equipment tracking
│   │   │   └── weather/        # Weather information
│   │   ├── api/                # API routes
│   │   │   ├── auth/           # Authentication endpoints
│   │   │   ├── incidents/      # Incident CRUD
│   │   │   ├── reports/        # Report CRUD
│   │   │   ├── equipment/      # Equipment CRUD
│   │   │   ├── geo/            # GeoJSON endpoints for map
│   │   │   ├── analytics/      # Analytics data
│   │   │   ├── weather/        # Weather data
│   │   │   └── health/         # Health checks
│   │   ├── signin/             # Sign-in page
│   │   └── signup/             # Sign-up page
│   ├── components/             # React components
│   │   ├── ui/                 # Reusable UI primitives
│   │   ├── map/                # Map components
│   │   ├── reports/            # Report-related components
│   │   ├── analytics/          # Analytics visualizations
│   │   ├── equipment/          # Equipment management UI
│   │   ├── layout/             # Layout & navigation
│   │   ├── shell/              # Shell containers
│   │   └── auth/               # Authentication UI
│   ├── lib/                    # Core libraries
│   │   ├── map/                # Map utilities & layers
│   │   ├── errors/             # Error handling
│   │   ├── notifications/      # WhatsApp queue system
│   │   ├── platform/           # Infrastructure (rate limiting, circuit breaker)
│   │   ├── validation/         # Input validation
│   │   └── observability/      # Logging & monitoring
│   ├── config/                 # Configuration files
│   ├── i18n/                   # Internationalization
│   ├── hooks/                  # Custom React hooks
│   ├── store/                  # Zustand state stores
│   ├── types/                  # TypeScript type definitions
│   └── utils/                  # Utility functions
├── scripts/                    # Utility scripts
│   ├── db/                     # Database scripts
│   ├── generate/               # Code generation
│   ├── services/               # Service management
│   └── deploy/                 # Deployment scripts
├── prisma/                     # Database schema & seeds
├── tests/                      # Test suites
│   ├── unit/                   # Unit tests
│   ├── integration/            # Integration tests
│   ├── e2e/                    # End-to-end tests
│   └── performance/            # Performance tests
├── docs/                       # Documentation
└── public/                     # Static assets
```

## API Routes Architecture

### Authentication (`/api/auth`)
- `POST /api/auth/signup` - User registration
- `POST /api/auth/signin` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/token` - Token refresh

### Incident Management (`/api/incidents`)
- `GET /api/incidents` - List all incidents (filtered by permissions)
- `POST /api/incidents` - Create incident (OFFICIAL only)
- `GET /api/incidents/[id]` - Get incident details
- `PATCH /api/incidents/[id]` - Update incident (OFFICIAL only)
- `DELETE /api/incidents/[id]` - Delete incident (OFFICIAL only)

### Report Management (`/api/reports`)
- `GET /api/reports` - List all reports
- `POST /api/reports` - Submit fire report (triggers notification workflow)
- `GET /api/reports/[id]` - Get report details
- `PATCH /api/reports/[id]` - Update report status (OFFICIAL only)

### GeoJSON Endpoints (`/api/geo`)
Optimized endpoints for map visualization with caching:
- `GET /api/geo/incidents` - Incident point features (10s cache)
- `GET /api/geo/resources` - Resource point features (10s cache, OFFICIAL only)
- `GET /api/geo/infrastructure` - Infrastructure features (1h cache)
- `GET /api/geo/risk-basins` - Risk basin polygons (1h cache)

### Equipment (`/api/equipment`)
- `GET /api/equipment` - List equipment
- `POST /api/equipment` - Add equipment (OFFICIAL only)
- `GET /api/equipment/[id]` - Get equipment details
- `PATCH /api/equipment/[id]` - Update equipment (OFFICIAL only)

### Analytics (`/api/analytics`)
- `GET /api/analytics` - Get dashboard metrics

### Weather (`/api/weather`)
- `GET /api/weather` - Get current weather data

## Key Design Patterns

### Error Handling
- **AppError Class**: Centralized error definitions with i18n support
- **withApiHandler**: Higher-order function wrapping API routes with error handling
- **Error Catalog**: Auto-generated documentation of all error codes

### Rate Limiting
- **Redis-based**: Sliding window rate limiting
- **Per-endpoint Configuration**: Different limits for different operations
- **Graceful Degradation**: Returns 429 with retry-after header

### Circuit Breaker
- **External Service Protection**: Prevents cascade failures
- **Configurable Thresholds**: Failure threshold, timeout, reset timeout
- **Half-open State**: Gradual recovery testing

### Background Job Queue
- **Redis Queue**: FIFO queue for WhatsApp notifications
- **Worker Process**: Separate process polls queue
- **Retry Logic**: Exponential backoff (max 3 retries)
- **Dead Letter Queue**: Failed jobs moved to DLQ
- **Rate Limiting**: Respects Twilio API limits (1s between calls)

### Authentication & Authorization
- **JWT Tokens**: Stored in HTTP-only cookies
- **Role-based**: CIVILIAN, OFFICIAL roles
- **Scope-based Permissions**: Fine-grained access control
- **Session Management**: Token refresh mechanism

## State Management

### Zustand Stores
- **useAuthStore**: Authentication state (user, login, logout)
- **useLanguageStore**: UI language preference (ar, fr, en)
- **useMapStore**: Map state (layers, viewport, selected features, errors)

All stores use Zustand's persist middleware for localStorage sync.

## Map Architecture

### Layers
- **Base Maps**: Streets (MapTiler) / Satellite (ESRI)
- **Incident Points**: Clustered point layer with status-based colors
- **Heatmap**: Density visualization (optional)
- **Resources**: deck.gl IconLayer (trucks, aircraft, personnel, equipment)
- **Infrastructure**: deck.gl IconLayer + PathLayer (watchtowers, firebreaks)
- **Risk Basins**: Polygon layer with risk-level styling

### 3D Mode
- **Terrain**: Enabled via MapLibre terrain source
- **Pitch**: 50° camera angle
- **Buildings**: 3D extrusions (if available)

### Performance Optimizations
- **Clustering**: Incident markers cluster at lower zoom levels
- **Caching**: GeoJSON endpoints cached with stale-while-revalidate
- **Lazy Loading**: deck.gl layers only created when active
- **Memoization**: Expensive computations cached with useMemo

## Data Flow

### Fire Report Submission
1. User submits report via `/report` page
2. `POST /api/reports` validates data
3. Report saved to MongoDB
4. Notification job enqueued to Redis
5. Background worker processes queue
6. WhatsApp messages sent via Twilio
7. Map updates via real-time polling (10s interval)

### Incident Management (OFFICIAL only)
1. Official creates incident via `POST /api/incidents`
2. Incident saved with geolocation
3. Status tracked through workflow: VIGILANCE → ALERTE → INTERVENTION → MAITRISE → ETEINT
4. Map reflects status changes via color coding
5. Analytics dashboard updates

## Security Considerations

### Input Validation
- **Prisma**: Type-safe database queries prevent SQL injection
- **GeoJSON Validation**: All coordinates validated before storage
- **Schema Validation**: API inputs validated against schemas

### Authentication
- **bcrypt**: Password hashing (12 rounds)
- **JWT**: Signed tokens with secret rotation capability
- **HTTP-only Cookies**: XSS protection
- **CORS**: Configured for production domain

### Rate Limiting
- **API Endpoints**: Prevent abuse
- **Login**: Brute-force protection
- **Report Submission**: Spam prevention

### Monitoring
- **Sentry**: Error tracking and performance monitoring
- **Structured Logging**: JSON logs with correlation IDs
- **Health Checks**: `/api/health` endpoint

## Deployment Architecture

### Production
- **Hosting**: Vercel (serverless functions)
- **Database**: MongoDB Atlas
- **Cache**: Redis Cloud
- **CDN**: Vercel Edge Network
- **Monitoring**: Sentry

### Environment Variables
```env
DATABASE_URL=mongodb://...
REDIS_URL=redis://...
JWT_SECRET=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=whatsapp:+...
SENTRY_DSN=...
NEXT_PUBLIC_MAPTILER_KEY=...
```

## Performance Targets

- **Time to Interactive**: < 3s
- **Lighthouse Score**: > 90
- **API Response Time**: < 200ms (p95)
- **Map Render Time**: < 1s for 1000 features
- **E2E Test Coverage**: > 80%

## Future Enhancements

- [ ] Real-time updates via WebSockets
- [ ] Mobile apps (React Native)
- [ ] Offline support (PWA)
- [ ] ML-based fire prediction
- [ ] Drone integration
- [ ] Advanced analytics (Recharts → custom dashboards)
