# RICER Ifrane - Complete Installation Guide

This guide will walk you through every step needed to set up and run the RICER Ifrane fire safety management platform.

## What You'll Need

Before starting, make sure you have:
- [ ] A computer with internet connection
- [ ] Node.js 18 or higher installed
- [ ] A MongoDB Atlas account (free)
- [ ] A code editor (VS Code recommended)
- [ ] About 30 minutes

---

## Part 1: Install Node.js (If Not Already Installed)

### Windows
1. Go to https://nodejs.org/
2. Download the LTS (Long Term Support) version
3. Run the installer
4. Click "Next" through the installation
5. Verify installation:
   - Open Command Prompt (cmd)
   - Type: `node --version`
   - Should show: `v18.x.x` or higher

### macOS
1. Go to https://nodejs.org/
2. Download the LTS version
3. Run the .pkg installer
4. Follow the installation steps
5. Verify in Terminal: `node --version`

### Linux (Ubuntu/Debian)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
```

---

## Part 2: Set Up MongoDB Atlas

### Step 1: Create Account
1. Go to https://www.mongodb.com/cloud/atlas
2. Click "Try Free"
3. Sign up with your email or Google account
4. Verify your email address

### Step 2: Create a Cluster
1. After logging in, click "Build a Database"
2. Choose **FREE** tier (M0)
3. Select a cloud provider (AWS, Google Cloud, or Azure)
4. Choose a region **closest to Morocco** (Europe - Paris is good)
5. Cluster Name: Keep default or name it "fire-safety"
6. Click "Create"
7. Wait 2-5 minutes for cluster creation

### Step 3: Create Database User
1. You'll see "Security Quickstart"
2. Create a database user:
   - Username: `fireuser` (or your choice)
   - Password: Click "Autogenerate" or create your own
   - **IMPORTANT:** Save this password somewhere safe!
3. Click "Create User"

### Step 4: Allow Network Access
1. Click "Add My Current IP Address"
2. This allows your computer to connect
3. For production, you'll need to add more IPs
4. Click "Finish and Close"

### Step 5: Get Connection String
1. Click "Connect" on your cluster
2. Choose "Connect your application"
3. Driver: Node.js
4. Version: 5.5 or later
5. Copy the connection string - it looks like:
   ```
   mongodb+srv://fireuser:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. **IMPORTANT:** Replace `<password>` with your actual password
7. Save this connection string - you'll need it soon!

---

## Part 3: Project Setup

### Step 1: Get the Project Files
1. Clone the repository or download it as a ZIP and extract it
2. The web app lives under: `apps/web`

### Step 2: Open Terminal in Project Folder

**Windows:**
1. Open File Explorer
2. Navigate to the `apps/web` folder
3. Type `cmd` in the address bar and press Enter

**macOS/Linux:**
1. Open Terminal
2. Navigate to the app folder: `cd <repo>/apps/web`

### Step 3: Install Dependencies
```bash
npm install
```

This will take 2-5 minutes and download all required packages.

**If you see warnings**, that's usually okay. **Errors** need to be fixed.

Common issues:
- "npm not found" → Node.js not installed correctly
- "EACCES permission denied" (Linux/Mac) → Use `sudo npm install`

---

## Part 4: Configuration

### Step 1: Create Environment File
1. In the project folder, find `.env.example`
2. Copy it and rename to `.env.local`

**Windows Command Prompt:**
```bash
copy .env.example .env.local
```

**Mac/Linux Terminal:**
```bash
cp .env.example .env.local
```

### Step 2: Edit Environment Variables
Open `.env.local` in a text editor (VS Code, Notepad, etc.)

Replace the values:

```env
# Replace with YOUR MongoDB connection string from Part 2, Step 5
DATABASE_URL="mongodb+srv://fireuser:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/fire-safety?retryWrites=true&w=majority"

# Generate a random secret or use this example (change for production!)
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production-minimum-64-characters"
```

**IMPORTANT:**
- Replace `YOUR_PASSWORD` with your actual MongoDB password
- Change `JWT_SECRET` to a random string (64+ characters)
- No spaces around the `=` sign
- Keep the quotes

### Step 3: Generate JWT Secret (Optional but Recommended)

**macOS/Linux:**
```bash
openssl rand -base64 64
```

**Windows (PowerShell):**
```powershell
[Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

Copy the output and use it as your `JWT_SECRET`.

---

## Part 5: Database Setup

Run these commands **in order**:

### Step 1: Generate Prisma Client
```bash
npm run prisma:generate
```
You should see: ✔ Generated Prisma Client

### Step 2: Push Database Schema
```bash
npm run prisma:push
```
This creates all the collections (tables) in MongoDB.

You should see:
```
Your database is now in sync with your Prisma schema.
```

### Step 3: Seed Test Data
```bash
npm run prisma:seed
```

You should see:
```
Starting seed...
✅ Users created
✅ Incidents created
✅ Reports created
✅ Equipment created
✅ Retardant products created
✅ Infrastructure created
✅ Truck deployments created
Seed completed successfully!
```

---

## Part 6: Run the Application

### Start Development Server
```bash
npm run dev
```

You should see:
```
✓ Ready in X seconds
○ Local:        http://localhost:3000
```

### Open in Browser
1. Open your web browser
2. Go to: **http://localhost:3000**
3. You should see the login page with the fire icon

---

## Part 7: Test the Application

### Test Civilian Account
1. On login page, enter:
   - CIN: `AB123456`
   - Password: `password123`
2. Click "تسجيل الدخول" (Sign In)
3. You should be redirected to the Weather page

### Test Official Account
1. Logout (top right button)
2. Login with:
   - CIN: `CD789012`
   - Password: `password123`
3. You should see an extra "المعدات" (Equipment) menu item

### Test All Features
- ✅ Weather page shows temperature and wind data
- ✅ Map page displays fire markers
- ✅ Analytics page shows charts
- ✅ Report page allows you to click on map and submit
- ✅ Reports list shows all reports
- ✅ Equipment page (officials only) shows trucks and inventory

---

## Success! Your Application is Running

You now have:
- ✅ MongoDB database connected
- ✅ Next.js application running
- ✅ Test data loaded
- ✅ Two user accounts ready to test

---

## Useful Commands

### Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Run production build
```

### Database
```bash
npm run prisma:generate  # Regenerate Prisma client
npm run prisma:push      # Update database schema
npm run prisma:seed      # Reload test data
```

### Other
```bash
npm run lint         # Check code quality
```

---

## Troubleshooting

### "Cannot connect to database"
**Problem:** MongoDB connection failed

**Solutions:**
1. Check `.env.local` file exists and has correct `DATABASE_URL`
2. Verify password in connection string (no `<` or `>` symbols)
3. Check MongoDB Atlas → Network Access → Your IP is listed
4. Try adding `0.0.0.0/0` to allow all IPs (for testing only)

### "Port 3000 is already in use"
**Problem:** Another app is using port 3000

**Solutions:**
1. Stop other development servers
2. Kill the process using port 3000:
   - Windows: `netstat -ano | findstr :3000` then `taskkill /PID <pid> /F`
   - Mac/Linux: `lsof -ti:3000 | xargs kill -9`
3. Or use a different port: `npm run dev -- -p 3001`

### "Module not found" errors
**Problem:** Dependencies not installed

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Map not showing
**Problem:** Leaflet requires client-side rendering

**Solution:** This is expected behavior on first load. The map uses `dynamic` imports and should load after a second. Check browser console for errors.

### Login redirects back to login
**Problem:** JWT cookie not being set

**Solutions:**
1. Clear browser cookies
2. Check `JWT_SECRET` in `.env.local`
3. Use http://localhost:3000 (not 127.0.0.1)

---

## Database Structure

Your MongoDB database now has these collections:
- `User` - 2 test users
- `Incident` - 12 fire incidents around Ifrane
- `Report` - 5 citizen reports
- `Equipment` - 15 equipment items (5 categories)
- `RetardantProduct` - 3 products (~16,500 liters total)
- `Infrastructure` - 17 items (water points, fire breaks, towers)
- `TruckDeployment` - 5 trucks with locations

---

## Accessing from Mobile/Other Devices

### Find Your Local IP
**Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" (something like 192.168.1.XXX)

**Mac/Linux:**
```bash
ifconfig | grep inet
```

### Access from Same Network
1. Make sure device is on same WiFi
2. Go to: `http://YOUR_IP:3000`
3. Example: `http://192.168.1.100:3000`

---

## Creating More Test Users

Use the signup page or Prisma Studio:

```bash
npx prisma studio
```

This opens a web interface to edit database directly.

---

## Next Steps

### Production Deployment
1. Push code to GitHub
2. Deploy to Vercel (free)
3. Add environment variables in Vercel dashboard
4. Your app will be live at: `your-app.vercel.app`

### Customization
- Add your own fire incidents
- Customize colors in `tailwind.config.ts`
- Modify Arabic text in components
- Add more equipment categories

---

## Need Help?

Common resources:
- Next.js Docs: https://nextjs.org/docs
- Prisma Docs: https://www.prisma.io/docs
- MongoDB Atlas: https://www.mongodb.com/docs/atlas/
- Leaflet Docs: https://leafletjs.com/

---

**Congratulations! Your RICER Ifrane platform is now running!**
