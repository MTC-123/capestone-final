# API Documentation

## Base URL
```
Production: https://ricer-ifrane.vercel.app
Development: http://localhost:3000
```

## Authentication

All protected endpoints require a valid JWT token in an HTTP-only cookie named `auth_token`.

### Roles
- **CIVILIAN**: Can view incidents, submit reports
- **OFFICIAL**: Full access to all operations

---

## Authentication Endpoints

### POST /api/auth/signup
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe",
  "phone": "+212600000000"
}
```

**Response:** `201 Created`
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "CIVILIAN",
  "scopes": ["map:read", "report:create", "report:read"]
}
```

**Errors:**
- `400` - Validation error (weak password, invalid email)
- `409` - Email already registered

---

### POST /api/auth/signin
Authenticate and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:** `200 OK`
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "CIVILIAN",
  "scopes": ["map:read", "report:create", "report:read"]
}
```

Sets HTTP-only cookie: `auth_token`

**Errors:**
- `401` - Invalid credentials
- `429` - Rate limit exceeded

---

### POST /api/auth/logout
Invalidate current session.

**Response:** `200 OK`
```json
{
  "message": "Logged out successfully"
}
```

---

### GET /api/auth/me
Get current authenticated user.

**Response:** `200 OK`
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "CIVILIAN",
  "scopes": ["map:read", "report:create", "report:read"]
}
```

**Errors:**
- `401` - Not authenticated

---

## Incident Management

### GET /api/incidents
List all incidents.

**Query Parameters:**
- `status` (optional): Filter by status (VIGILANCE, ALERTE, INTERVENTION, MAITRISE, ETEINT)
- `severity` (optional): Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)

**Response:** `200 OK`
```json
{
  "incidents": [
    {
      "id": "incident_123",
      "cause": "LIGHTNING",
      "severity": "HIGH",
      "status": "INTERVENTION",
      "description": "Large forest fire near Azrou",
      "location": {
        "type": "Point",
        "coordinates": [-5.2217, 33.4344]
      },
      "createdAt": "2024-02-01T10:30:00Z",
      "updatedAt": "2024-02-01T14:20:00Z"
    }
  ]
}
```

---

### POST /api/incidents
Create a new incident (OFFICIAL only).

**Request Body:**
```json
{
  "cause": "LIGHTNING",
  "severity": "HIGH",
  "status": "VIGILANCE",
  "description": "Smoke reported in Atlas forest",
  "location": {
    "type": "Point",
    "coordinates": [-5.2217, 33.4344]
  }
}
```

**Response:** `201 Created`
```json
{
  "id": "incident_456",
  "cause": "LIGHTNING",
  "severity": "HIGH",
  "status": "VIGILANCE",
  "description": "Smoke reported in Atlas forest",
  "location": {
    "type": "Point",
    "coordinates": [-5.2217, 33.4344]
  },
  "createdAt": "2024-02-07T15:00:00Z",
  "updatedAt": "2024-02-07T15:00:00Z"
}
```

**Errors:**
- `401` - Not authenticated
- `403` - Insufficient permissions (OFFICIAL role required)
- `400` - Invalid input

---

### GET /api/incidents/[id]
Get incident details.

**Response:** `200 OK`
```json
{
  "id": "incident_123",
  "cause": "LIGHTNING",
  "severity": "HIGH",
  "status": "INTERVENTION",
  "description": "Large forest fire near Azrou",
  "location": {
    "type": "Point",
    "coordinates": [-5.2217, 33.4344]
  },
  "createdAt": "2024-02-01T10:30:00Z",
  "updatedAt": "2024-02-01T14:20:00Z"
}
```

**Errors:**
- `404` - Incident not found

---

### PATCH /api/incidents/[id]
Update incident (OFFICIAL only).

**Request Body:**
```json
{
  "status": "MAITRISE",
  "description": "Fire contained, mopping up operations ongoing"
}
```

**Response:** `200 OK`
```json
{
  "id": "incident_123",
  "status": "MAITRISE",
  "description": "Fire contained, mopping up operations ongoing",
  "updatedAt": "2024-02-01T18:45:00Z"
}
```

**Errors:**
- `403` - Insufficient permissions
- `404` - Incident not found

---

## Report Management

### GET /api/reports
List all fire reports.

**Response:** `200 OK`
```json
{
  "reports": [
    {
      "id": "report_789",
      "location": {
        "type": "Point",
        "coordinates": [-5.2217, 33.4344]
      },
      "description": "Visible smoke from highway",
      "fireSize": "MEDIUM",
      "status": "PENDING",
      "reporterPhone": "+212600000000",
      "createdAt": "2024-02-07T12:00:00Z"
    }
  ]
}
```

---

### POST /api/reports
Submit a fire report.

**Request Body:**
```json
{
  "location": {
    "type": "Point",
    "coordinates": [-5.2217, 33.4344]
  },
  "description": "Large smoke plume visible",
  "fireSize": "LARGE",
  "reporterPhone": "+212600000000"
}
```

**Response:** `201 Created`
```json
{
  "id": "report_999",
  "location": {
    "type": "Point",
    "coordinates": [-5.2217, 33.4344]
  },
  "description": "Large smoke plume visible",
  "fireSize": "LARGE",
  "status": "PENDING",
  "reporterPhone": "+212600000000",
  "createdAt": "2024-02-07T15:30:00Z"
}
```

**Side Effects:**
- Triggers WhatsApp notification to emergency contacts
- Notification job queued in Redis

**Errors:**
- `400` - Invalid location or missing required fields
- `429` - Rate limit exceeded (max 5 reports per hour per user)

---

### PATCH /api/reports/[id]
Update report status (OFFICIAL only).

**Request Body:**
```json
{
  "status": "REVIEWED"
}
```

**Response:** `200 OK`

**Errors:**
- `403` - Insufficient permissions
- `404` - Report not found

---

## GeoJSON Endpoints

Optimized endpoints for map visualization with caching headers.

### GET /api/geo/incidents
Get incidents as GeoJSON FeatureCollection.

**Response:** `200 OK`
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-5.2217, 33.4344]
      },
      "properties": {
        "id": "incident_123",
        "cause": "LIGHTNING",
        "severity": "HIGH",
        "status": "INTERVENTION",
        "description": "Large forest fire",
        "createdAt": "2024-02-01T10:30:00Z"
      }
    }
  ]
}
```

**Caching:** `Cache-Control: public, s-maxage=10, stale-while-revalidate=5`

---

### GET /api/geo/resources
Get resources as GeoJSON (OFFICIAL only).

**Response:** `200 OK`
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-5.2200, 33.4300]
      },
      "properties": {
        "id": "resource_456",
        "type": "TRUCK",
        "name": "Truck-01",
        "status": "En route",
        "assignedTo": "incident_123"
      }
    }
  ]
}
```

**Caching:** `Cache-Control: public, s-maxage=10, stale-while-revalidate=5`

---

### GET /api/geo/infrastructure
Get infrastructure as GeoJSON.

**Response:** `200 OK`
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-5.2100, 33.4200]
      },
      "properties": {
        "id": "infra_789",
        "type": "WATCHTOWER",
        "name": "Tower Alpha",
        "status": "ACTIVE",
        "description": "Main watchtower"
      }
    }
  ]
}
```

**Caching:** `Cache-Control: public, s-maxage=3600, stale-while-revalidate=60`

---

### GET /api/geo/risk-basins
Get risk basins as GeoJSON.

**Response:** `200 OK`
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-5.25, 33.40], [-5.20, 33.40], [-5.20, 33.45], [-5.25, 33.45], [-5.25, 33.40]]]
      },
      "properties": {
        "id": "basin_001",
        "name": "Cedar Forest Zone",
        "riskLevel": 4,
        "description": "High-density cedar forest"
      }
    }
  ]
}
```

**Caching:** `Cache-Control: public, s-maxage=3600, stale-while-revalidate=60`

---

## Equipment Management

### GET /api/equipment
List equipment (trucks, aircraft, etc.).

**Response:** `200 OK`
```json
{
  "equipment": [
    {
      "id": "truck_01",
      "type": "TRUCK",
      "name": "Fire Truck 01",
      "status": "Disponible",
      "location": {
        "type": "Point",
        "coordinates": [-5.2217, 33.4344]
      }
    }
  ]
}
```

---

### POST /api/equipment
Add new equipment (OFFICIAL only).

**Request Body:**
```json
{
  "type": "TRUCK",
  "name": "Fire Truck 05",
  "status": "Disponible",
  "location": {
    "type": "Point",
    "coordinates": [-5.2217, 33.4344]
  }
}
```

**Response:** `201 Created`

---

## Analytics

### GET /api/analytics
Get dashboard analytics.

**Response:** `200 OK`
```json
{
  "totalIncidents": 42,
  "activeIncidents": 5,
  "totalReports": 127,
  "responseTime": 15.5,
  "incidentsByStatus": {
    "VIGILANCE": 10,
    "ALERTE": 8,
    "INTERVENTION": 5,
    "MAITRISE": 12,
    "ETEINT": 7
  },
  "incidentsBySeverity": {
    "LOW": 15,
    "MEDIUM": 18,
    "HIGH": 7,
    "CRITICAL": 2
  }
}
```

---

## Weather

### GET /api/weather
Get current weather conditions.

**Response:** `200 OK`
```json
{
  "temperature": 28,
  "humidity": 35,
  "windSpeed": 12,
  "windDirection": "NE",
  "conditions": "Clear"
}
```

---

## Health Check

### GET /api/health
Service health status.

**Response:** `200 OK`
```json
{
  "status": "healthy",
  "timestamp": "2024-02-07T15:00:00Z",
  "services": {
    "database": "up",
    "redis": "up"
  }
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": 2000,
    "message": "Not authenticated",
    "translationKey": "errorNotAuthenticated"
  }
}
```

Common HTTP status codes:
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

---

## Rate Limits

- **Authentication**: 5 requests per minute
- **Report Submission**: 5 reports per hour per user
- **API Endpoints**: 100 requests per minute per IP
- **GeoJSON**: 60 requests per minute per user

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1612702800
```
