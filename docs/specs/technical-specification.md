# RICER Ifrane - Technical Specification

## Project Overview

A full-stack web application for fire incident reporting and management in Ifrane, Morocco. The platform enables civilians to report fires and allows government officials from 16 Moroccan departments to manage incidents, equipment, and resources.

**This application supports 2 languages: French and Arabic**
**Primary Language:** Arabic (with RTL *right to left* support)  
**Secondary Language:** French

> The coordinates of Ifrane according to Open Street Map which leaflet uses is 33.5275, -5.1056

## Tech Stack

### Frontend

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS with RTL support
- **State Management:** Zustand
- **Maps:** Leaflet + React-Leaflet that's using the OSM model
- **Translation:** use a dedicated internationalization (i18n) library such as next-intl or next-i18next
- **Charts:** Recharts
- **UI Components:** Custom React components

### Backend

- **Framework:** Next.js API Routes
- **Database:** MongoDB
- **ORM:** Prisma
- **Authentication:** JWT (httpOnly cookies)
- **Password Hashing:** bcrypt

### External APIs

- **Weather Data:** Please use an appropriate API for this one.

## Database Schema (Prisma/MongoDB)

### Collections

#### 1. User

```prisma
model User {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  cin         String   @unique  // National ID (Carte d'Identité Nationale)
  phone       String
  password    String   // bcrypt hashed
  role        Role     // CIVILIAN or OFFICIAL
  department  String?  // For officials only (16 Moroccan departments)
  position    String?  // For officials only (job title)
  reports     Report[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum Role {
  CIVILIAN  // Regular citizens who report fires
  OFFICIAL  // Government officials who manage incidents
}
```

#### 2. Report

```prisma
model Report {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  userId      String   @db.ObjectId
  user        User     @relation(fields: [userId], references: [id])
  latitude    Float    // Location coordinates
  longitude   Float
  description String   // Detailed description in Arabic
  images      String[] // URLs (future: image upload)
  status      Status   @default(PENDING)
  cause       String?  // Optional: fire cause
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum Status {
  PENDING      // Newly reported, awaiting response
  IN_PROGRESS  // Officials are responding
  COMPLETED    // Incident resolved
}
```

#### 3. Incident

```prisma
model Incident {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  latitude    Float
  longitude   Float
  cause       String   // Fire cause (enum-like)
  severity    Int      // 1-5 scale
  status      Status   @default(PENDING)
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

#### 4. Equipment (Officials Only)

```prisma
model Equipment {
  id              String    @id @default(auto()) @map("_id") @db.ObjectId
  category        String    // Materiel Roulant, Petit Materiel, etc.
  name            String
  quantity        Int
  condition       String    // Bon, Moyen, Mauvais
  lastMaintenance DateTime?
  location        String
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

#### 5. RetardantProduct (Officials Only)

```prisma
model RetardantProduct {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  productName     String
  acquisitionDate DateTime
  storageLocation String
  quantity        Int      // In liters
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

#### 6. Infrastructure (Officials Only)

```prisma
model Infrastructure {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  type        String   // Point d'eau, Tranchée pare-feu, etc.
  name        String
  latitude    Float?
  longitude   Float?
  status      String
  description String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

#### 7. TruckDeployment (Officials Only)

```prisma
model TruckDeployment {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  truckId    String   // Vehicle identifier
  truckName  String
  latitude   Float    // Current location
  longitude  Float
  status     String   // Disponible, En route, Sur place
  assignedTo String?  // Incident ID if deployed
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

## Authentication System

### Flow

1. User signs up with CIN (National ID) and password
2. Password hashed with bcrypt (10 rounds)
3. JWT token generated with payload: `{ userId, cin, role, department }`
4. Token stored in httpOnly cookie (expires in 7 days)
5. Middleware validates token on protected routes
6. Logout clears the cookie

### Endpoints

- `POST /api/auth/signup` - Create account (civilian or official)
- `POST /api/auth/signin` - Login with CIN + password
- `POST /api/auth/logout` - Clear session
- `GET /api/auth/me` - Get current user

## API Endpoints

### Public Endpoints

- `GET /api/weather` - Get current weather for Ifrane (33.52532, -5.11384)

### Authenticated Endpoints

- `GET /api/incidents` - List all fire incidents
- `GET /api/reports` - List all reports
- `POST /api/reports` - Create new fire report (civilians)
- `GET /api/analytics` - Get fire statistics (last 2 weeks)

### Officials-Only Endpoints

- `PATCH /api/reports/[id]` - Update report status
- `GET /api/equipment` - Get all equipment, products, infrastructure, trucks

## User Roles & Permissions

### CIVILIAN
**Can:**
- View weather data
- View fire map with all incidents
- View analytics/statistics
- Submit fire reports (with location picker)
- View all reports

**Cannot:**
- Update report status
- Access equipment dashboard

### OFFICIAL

**Can:**
- Everything civilians can do, PLUS:
- Update report status (PENDING → IN_PROGRESS → COMPLETED)
- Access equipment management dashboard
- View equipment inventory (vehicles, tools, protective gear)
- View retardant product stock
- View infrastructure (water points, fire breaks, watchtowers)
- Track truck deployments on map

## Frontend Pages

### Public Pages

- `/signin` - Login page
- `/signup` - Registration (choose civilian or official)

### Protected Pages

- `/weather` - Weather dashboard (temperature, wind speed, wind direction)
- `/map` - Interactive Leaflet map with fire markers (color-coded by status)
- `/analytics` - Line chart (incidents over time) + Pie chart (causes distribution)
- `/report` - Fire reporting form with location picker
- `/reports-list` - List of all submitted reports

### Officials-Only Pages

- `/equipment` - Equipment management dashboard with:
  - Truck deployment map
  - Equipment inventory table
  - Retardant products table
  - Infrastructure table

## Key Features

### 1. Weather Integration

- Real-time weather from Open-Meteo API
- Temperature (°C)
- Wind speed (km/h)
- Wind direction (degrees + cardinal direction in Arabic)
- Automatic refresh on page load

### 2. Interactive Maps

- **Fire Map:** Display all incidents with color-coded markers
  - Red = PENDING
  - Orange = IN_PROGRESS
  - Green = COMPLETED
- **Location Picker:** Click to select fire location when reporting
- **Truck Map:** Real-time truck positions (officials only)

### 3. Fire Reporting

- Map-based location selection
- Optional cause selection (9 predefined causes)
- Arabic text description
- Instant submission
- Future: Image upload capability

### 4. Analytics Dashboard

- Line chart: Incidents over last 14 days
- Pie chart: Distribution by cause
- Summary cards: Total incidents, days with fires, daily average

### 5. Equipment Management (Officials)

- 5 equipment categories tracked
- Maintenance status (Bon, Moyen, Mauvais)
- Retardant product inventory (liters)
- 3 infrastructure types (17+ items)
- 5+ truck deployments with real-time locations

## Fire Causes (9 Types)

1. **CAMPFIRE_UNATTENDED** - نار مخيم غير مراقبة
2. **CIGARETTE** - سيجارة
3. **AGRICULTURAL_BURNING** - حرق زراعي
4. **ELECTRICAL** - كهربائي
5. **LIGHTNING** - صاعقة
6. **ARSON** - حريق متعمد
7. **EQUIPMENT_MALFUNCTION** - عطل في المعدات
8. **OTHER** - أخرى
9. **UNKNOWN** - غير معروف

## Moroccan Government Departments (16)

1. ADM - الطرق السيارة بالمغرب
2. CCDRF - مركز الحفاظ على الموارد الغابوية
3. CEDEFO - مركز الدفاع عن الغابات
4. DFCI - الدفاع عن الغابات ضد الحرائق
5. DPEFLCD - المديرية الإقليمية للمياه والغابات
6. DREFLCD - المديرية الجهوية للمياه والغابات
7. FA - القوات المساعدة
8. FAR - القوات المسلحة الملكية
9. GR - الدرك الملكي
10. HCEFLCD - المندوبية السامية للمياه والغابات
11. MET - وزارة التجهيز والنقل
12. MI - وزارة الداخلية
13. MJS - وزارة الشباب والرياضة
14. ONCE - المكتب الوطني للسكك الحديدية
15. ONDA - المكتب الوطني للمطارات
16. ONEEP - المكتب الوطني للكهرباء والماء
17. PN - الإنعاش الوطني

## RTL (Right-to-Left) Support

### Implementation

- `<html lang="ar" dir="rtl">` in root layout
- Tailwind CSS RTL utilities:
  - `text-right` for text alignment
  - `space-x-reverse` for spacing
  - `mr-*` / `ml-*` swapped appropriately
- All UI text in Arabic
- Form inputs, buttons, navigation - all RTL-aware

## Environment Variables

```env
# Database
DATABASE_URL="mongodb://localhost:27017/fire-safety"
# OR
DATABASE_URL="mongodb+srv://user:pass@cluster.mongodb.net/fire-safety"

# JWT
JWT_SECRET="your-super-secret-random-key-64-chars-minimum"

```

### Environment Setup

1. Create MongoDB cluster (Atlas or local)
2. Set `DATABASE_URL` in environment
3. Set `JWT_SECRET` (min 64 random characters)
4. Run Prisma migrations: `npx prisma db push`
5. Seed database: `npm run prisma:seed`
6. Deploy to Vercel or similar

## Testing Data (Seed)

When running `npm run prisma:seed`, the database is populated with:

- **2 test users:**
  - Civilian: CIN `AB123456` / Password `password123`
  - Official: CIN `CD789012` / Password `password123`

- **12 fire incidents** (various locations around Ifrane)
- **5 citizen reports**
- **15 equipment items** (5 categories)
- **3 retardant products** (15,000+ liters total)
- **17 infrastructure items** (water points, fire breaks, towers)
- **5 truck deployments** (various statuses)

## Localization

### Arabic UI Text (100% Coverage)

- All buttons, labels, headers in Arabic
- Error messages in Arabic
- Form validation messages in Arabic
- Status labels in Arabic
- Chart labels in Arabic

### French (Secondary)

- Department names (with Arabic primary)
- Some technical terms
- Documentation references

## Project Structure

```text
fire-safety-platform/
├── prisma/
│   ├── schema.prisma       # 7 models
│   └── seed.ts            # Test data
├── src/
│   ├── app/
│   │   ├── (auth)/        # Login/signup pages
│   │   ├── (dashboard)/   # Protected pages
│   │   ├── api/           # 10 API routes
│   │   ├── layout.tsx     # Root layout (RTL)
│   │   └── page.tsx       # Redirect to signin
│   ├── components/
│   │   ├── auth/          # SignInForm, SignUpForm
│   │   ├── layout/        # Navbar
│   │   ├── map/           # FireMap, LocationPicker
│   │   ├── weather/       # WeatherDisplay
│   │   ├── analytics/     # Charts
│   │   ├── reports/       # Forms, lists
│   │   └── equipment/     # Tables, maps
│   ├── lib/               # Prisma client, auth helpers
│   ├── store/             # Zustand stores (auth, incidents, reports)
│   ├── types/             # TypeScript interfaces
│   └── utils/             # Constants, helpers
├── .env.local             # Environment variables
├── package.json           # Dependencies
├── tailwind.config.ts     # Tailwind + RTL
└── tsconfig.json          # TypeScript config
```
