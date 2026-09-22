# RICER Ifrane - Fire Safety Management Platform

A full-stack web application for fire incident reporting and management in Ifrane, Morocco. The platform enables civilians to report fires and allows government officials from 16 Moroccan departments to manage incidents, equipment, and resources.

## Features

### For Civilians
- **Real-time Weather Dashboard** - View temperature, wind speed, and wind direction
- **Interactive Fire Map** - See all fire incidents with color-coded status markers
- **Fire Reporting** - Report fires with map-based location selection
- **View Reports** - Access all submitted fire reports
- **Analytics Dashboard** - View fire statistics and trends

### For Officials
All civilian features PLUS:
- **Equipment Management** - Track vehicles, tools, protective gear, and supplies
- **Truck Deployment Map** - Monitor real-time truck locations and assignments
- **Retardant Products Inventory** - Manage fire retardant stock
- **Infrastructure Management** - Track water points, fire breaks, and watchtowers
- **Report Status Management** - Update fire report statuses (Pending → In Progress → Completed)

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React, TypeScript
- **Styling:** Tailwind CSS with RTL support
- **State Management:** Zustand
- **Maps:** Leaflet + React-Leaflet (OpenStreetMap)
- **Charts:** Recharts
- **Backend:** Next.js API Routes
- **Database:** MongoDB with Prisma ORM
- **Authentication:** JWT with httpOnly cookies
- **Weather API:** Open-Meteo (no API key required)

## Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** 18.x or higher ([Download](https://nodejs.org/))
- **npm** or **yarn** package manager
- **MongoDB Atlas** account ([Sign up free](https://www.mongodb.com/cloud/atlas))
- **Git** (optional, for version control)

## Installation Guide

### Step 1: Set Up MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and create a free account
2. Create a new cluster (choose the free M0 tier)
3. Wait for the cluster to be created (2-5 minutes)
4. Click "Connect" on your cluster
5. Choose "Connect your application"
6. Copy the connection string (it looks like: `mongodb+srv://<username>:<password>@...`)
7. Replace `<password>` with your actual database password
8. Replace `<database>` with `fire-safety`

### Step 2: Clone or Download the Project

If you have Git:
```bash
git clone <repository-url>
cd RICER-project/apps/web
```

Or extract the project ZIP file and navigate to the folder.

### Step 3: Install Dependencies

```bash
npm install
```

This will install all required packages (Next.js, React, Prisma, Leaflet, etc.)

### Step 4: Configure Environment Variables

1. Copy the example environment file:
```bash
cp .env.example .env.local
```

2. Edit `.env.local` and add your values:
```env
# Replace with your MongoDB Atlas connection string
DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/fire-safety?retryWrites=true&w=majority"

# Generate a secure JWT secret (64+ characters recommended)
# You can use: openssl rand -base64 64
JWT_SECRET="your-super-secret-jwt-key-minimum-64-characters-for-production"
```

### Step 5: Set Up the Database

1. Generate Prisma client:
```bash
npm run prisma:generate
```

2. Push the database schema to MongoDB:
```bash
npm run prisma:push
```

3. Seed the database with test data:
```bash
npm run prisma:seed
```

This creates:
- 2 test users (1 civilian, 1 official)
- 12 fire incidents
- 5 reports
- 15 equipment items
- 3 retardant products
- 17 infrastructure items
- 5 truck deployments

### Step 6: Run the Development Server

```bash
npm run dev
```

The application will be available at: **http://localhost:3000**

### Step 7: Test the Application

#### Test Accounts

**Civilian Account:**
- CIN: `AB123456`
- Password: `password123`

**Official Account:**
- CIN: `CD789012`
- Password: `password123`

## Application Pages

### Public Pages
- `/signin` - Login page
- `/signup` - Registration (choose civilian or official)

### Protected Pages
- `/weather` - Weather dashboard
- `/map` - Interactive fire map
- `/analytics` - Statistics and charts
- `/report` - Fire reporting form
- `/reports-list` - List of all reports
- `/equipment` - Equipment management (officials only)

## Database Schema

### Collections

1. **User** - User accounts (civilians and officials)
2. **Report** - Fire reports submitted by users
3. **Incident** - Fire incident records
4. **Equipment** - Equipment inventory (vehicles, tools, gear)
5. **RetardantProduct** - Fire retardant products stock
6. **Infrastructure** - Infrastructure items (water points, fire breaks, towers)
7. **TruckDeployment** - Real-time truck locations and status

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/signin` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Public Endpoints
- `GET /api/weather` - Get current weather for Ifrane
- `GET /api/incidents` - List all fire incidents (authenticated)
- `GET /api/reports` - List all reports (authenticated)
- `POST /api/reports` - Create new report (authenticated)
- `GET /api/analytics` - Get statistics (authenticated)

### Officials Only
- `PATCH /api/reports/[id]` - Update report status
- `GET /api/equipment` - Get all equipment data

## RTL (Right-to-Left) Support

The entire application is built with Arabic-first RTL support:
- Arabic UI text throughout
- RTL-aware layouts and components
- Arabic date formatting
- Right-aligned text inputs and forms

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run prisma:generate  # Generate Prisma client
npm run prisma:push      # Push schema to database
npm run prisma:seed      # Seed database with test data
```

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com) and import your repository
3. Add environment variables:
   - `DATABASE_URL` - Your MongoDB Atlas connection string
   - `JWT_SECRET` - Your JWT secret key
4. Deploy!

### Environment Variables for Production

Make sure to set these in your production environment:
```
DATABASE_URL=mongodb+srv://...
JWT_SECRET=your-production-secret-key
NODE_ENV=production
```

## Key Features Detail

### Weather Integration
- Real-time data from Open-Meteo API
- Temperature, wind speed, wind direction
- Arabic cardinal directions
- Fire risk alerts based on conditions

### Interactive Maps
- OpenStreetMap via Leaflet
- Color-coded fire markers (red/orange/green)
- Click-to-select location picker
- Truck deployment tracking
- Custom markers and popups

### Analytics
- Line chart: 14-day incident timeline
- Pie chart: Distribution by cause
- Summary statistics cards
- Data visualization with Recharts

### Equipment Management
- 5 equipment categories
- Retardant product tracking (liters)
- Infrastructure status monitoring
- Real-time truck deployment map

## Security Features

- JWT authentication with httpOnly cookies
- Password hashing with bcrypt (10 rounds)
- Role-based access control (Civilian/Official)
- Protected API routes
- Secure environment variable handling

## Moroccan Context

### 16 Government Departments
The system supports officials from 16 Moroccan departments including:
- HCEFLCD (المندوبية السامية للمياه والغابات)
- FAR (القوات المسلحة الملكية)
- GR (الدرك الملكي)
- And 13 more departments

### 9 Fire Cause Types
- Campfire unattended (نار مخيم غير مراقبة)
- Cigarette (سيجارة)
- Agricultural burning (حرق زراعي)
- Electrical (كهربائي)
- Lightning (صاعقة)
- Arson (حريق متعمد)
- Equipment malfunction (عطل في المعدات)
- Other (أخرى)
- Unknown (غير معروف)

## Troubleshooting

### "POST /api/auth/signup 500" Error

This is typically a database connection issue. Solutions:

1. **Check `.env.local` exists and has correct values:**
   ```bash
   # Make sure DATABASE_URL is set correctly
   # Make sure JWT_SECRET is set (64+ characters)
   ```

2. **Regenerate Prisma Client:**
   ```bash
   npm run prisma:generate
   npm run prisma:push
   ```

3. **Check MongoDB Atlas:**
   - Network Access: Add your IP or `0.0.0.0/0`
   - Database Access: User exists with read/write permissions
   - Connection String: Password is URL-encoded (special chars like @ become %40)

4. **Use automated setup:**
   Not available in this repository.

### Common Issues

**"Cannot connect to database"**
- Check your `DATABASE_URL` in `.env.local`
- Ensure your IP is whitelisted in MongoDB Atlas
- Verify the database password is correct

**"Leaflet map not loading"**
- This is normal on first page load
- The map uses dynamic imports (client-side only)
- Check browser console for errors

**"Invalid JWT token"**
- Clear cookies and login again
- Check `JWT_SECRET` is set in `.env.local`

**"Module not found"**
- Run `npm install` again
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`

## License

This project is for educational and demonstration purposes.

## Contributing

This is a demonstration project. Feel free to fork and customize for your needs!

## Support

For issues or questions, please refer to the documentation or create an issue in the repository.

---

**Made for Ifrane, Morocco**
