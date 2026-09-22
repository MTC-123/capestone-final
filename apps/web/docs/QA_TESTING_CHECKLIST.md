# RICER Mapping Feature - Manual QA Testing Checklist

**Version:** 1.0
**Date:** 2026-02-06
**Features:** Security fixes, type safety, refresh intervals, error handling, UI components, hover popups

---

## Overview

This checklist covers manual QA testing for the 6 major improvements to the RICER mapping feature:
1. RBAC security fix
2. Type safety with GeoJSON validation
3. Optimized refresh intervals
4. Error handling with user feedback
5. New UI components (NavigationControl, ScaleControl, MapLegend)
6. Hover popup previews

---

## Test Environment Setup

### Prerequisites
- [ ] Test database seeded with sample data
- [ ] Two test accounts created:
  - CIVILIAN user (e.g., `civilian@test.com` / `Test1234`)
  - OFFICIAL user (e.g., `official@test.com` / `Test1234`)
- [ ] Dev server running (`npm run dev`)
- [ ] Browser DevTools open (Network tab + Console)

### Test Browsers
Test on at least 3 browsers:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest, Mac only) OR Mobile Safari (iOS)

### Test Viewports
- [ ] Desktop (1920x1080)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

---

## 🔒 Security Testing (Issue #1: RBAC)

### Test Case 1.1: CIVILIAN User - Resources Access Denied
**Prerequisites:** Logged in as CIVILIAN user

**Steps:**
1. Navigate to `/map`
2. Open Browser DevTools > Network tab
3. Filter for `geo/resources`
4. Wait for API calls to complete
5. Check the response status

**Expected Results:**
- [ ] `/api/geo/resources` returns **403 Forbidden**
- [ ] No resources layer data visible on map
- [ ] Console shows: `"Resources not available for current user role"` (info, not error)
- [ ] No error banner displayed (403 is expected for CIVILIAN)
- [ ] Map still loads and functions normally
- [ ] Incidents, infrastructure, and risk basins layers work

**Status:** ☐ Pass ☐ Fail ☐ N/A
**Notes:**

---

### Test Case 1.2: OFFICIAL User - Resources Access Granted
**Prerequisites:** Logged in as OFFICIAL user

**Steps:**
1. Navigate to `/map`
2. Open Browser DevTools > Network tab
3. Filter for `geo/resources`
4. Wait for API calls to complete
5. Check the response status and data

**Expected Results:**
- [ ] `/api/geo/resources` returns **200 OK**
- [ ] Response contains valid GeoJSON FeatureCollection
- [ ] Resources layer visible on map (colored markers)
- [ ] Console shows: `"✓ Resources refreshed"`
- [ ] No error messages
- [ ] Resources refresh every **10 seconds**

**Status:** ☐ Pass ☐ Fail ☐ N/A
**Notes:**

---

## ✅ Type Safety Testing (Issue #4: GeoJSON Validation)

### Test Case 2.1: Valid GeoJSON Handling
**Prerequisites:** Logged in as any user, database has valid incident data

**Steps:**
1. Navigate to `/map`
2. Open Browser DevTools > Console
3. Wait for map to load
4. Check for any validation warnings

**Expected Results:**
- [ ] No console warnings about "Invalid location" or "Invalid geometry"
- [ ] All incidents render on map as markers
- [ ] All infrastructure/risk basins render as expected
- [ ] No TypeScript errors in console

**Status:** ☐ Pass ☐ Fail ☐ N/A
**Notes:**

---

### Test Case 2.2: Invalid GeoJSON Handling (Requires DB Manipulation)
**Prerequisites:** Logged in as OFFICIAL, inject invalid data into DB

**Setup:**
```sql
-- Example: Insert incident with invalid coordinates
INSERT INTO "Incident" (id, cause, severity, status, location, "createdAt", "updatedAt")
VALUES ('test-invalid-1', 'TEST', 5, 'ALERTE',
  '{"type":"Point","coordinates":[999, 999]}', -- Invalid coordinates
  NOW(), NOW());
```

**Steps:**
1. Navigate to `/map` (after DB manipulation)
2. Open Browser DevTools > Console
3. Wait for map data to load
4. Check console for validation warnings

**Expected Results:**
- [ ] Console shows: `"Invalid location for incident test-invalid-1, skipping"`
- [ ] Map does NOT crash
- [ ] Valid incidents still render correctly
- [ ] Invalid incident is silently skipped (not rendered)

**Cleanup:**
```sql
DELETE FROM "Incident" WHERE id = 'test-invalid-1';
```

**Status:** ☐ Pass ☐ Fail ☐ N/A
**Notes:**

---

## ⏱️ Refresh Interval Testing (Issue #2: Data Fetching)

### Test Case 3.1: Incidents Refresh Timing
**Prerequisites:** Logged in as any user

**Steps:**
1. Navigate to `/map`
2. Open Browser DevTools > Network tab
3. Filter for `geo/incidents`
4. Clear network log
5. Wait and observe timing between requests
6. Record timestamps of at least 5 consecutive requests

**Expected Results:**
- [ ] First request happens immediately on page load
- [ ] Subsequent requests occur approximately every **15 seconds**
- [ ] Timing pattern: 0s → 15s → 30s → 45s → 60s
- [ ] Console logs show: `"✓ Incidents refreshed"` every 15s
- [ ] No duplicate/overlapping requests

**Actual Timings:**
- Request 1: _____s
- Request 2: _____s (Δ ~15s)
- Request 3: _____s (Δ ~15s)
- Request 4: _____s (Δ ~15s)
- Request 5: _____s (Δ ~15s)

**Status:** ☐ Pass ☐ Fail ☐ N/A
**Notes:**

---

### Test Case 3.2: Resources Refresh Timing (OFFICIAL Only)
**Prerequisites:** Logged in as OFFICIAL user

**Steps:**
1. Navigate to `/map`
2. Open Browser DevTools > Network tab
3. Filter for `geo/resources`
4. Clear network log
5. Wait and observe timing between requests
6. Record timestamps of at least 5 consecutive requests

**Expected Results:**
- [ ] First request happens immediately on page load
- [ ] Subsequent requests occur approximately every **10 seconds**
- [ ] Timing pattern: 0s → 10s → 20s → 30s → 40s → 50s → 60s
- [ ] Console logs show: `"✓ Resources refreshed"` every 10s
- [ ] No duplicate/overlapping requests

**Actual Timings:**
- Request 1: _____s
- Request 2: _____s (Δ ~10s)
- Request 3: _____s (Δ ~10s)
- Request 4: _____s (Δ ~10s)
- Request 5: _____s (Δ ~10s)
- Request 6: _____s (Δ ~10s)
- Request 7: _____s (Δ ~10s)

**Status:** ☐ Pass ☐ Fail ☐ N/A
**Notes:**

---

### Test Case 3.3: Static Data Fetches Once Only
**Prerequisites:** Logged in as any user

**Steps:**
1. Navigate to `/map`
2. Open Browser DevTools > Network tab
3. Filter for `geo/infrastructure` and `geo/risk-basins`
4. Wait 60 seconds
5. Count the number of requests to each endpoint

**Expected Results:**
- [ ] `/api/geo/infrastructure` called **exactly 1 time**
- [ ] `/api/geo/risk-basins` called **exactly 1 time**
- [ ] No refresh/polling for these endpoints
- [ ] Console logs show: `"✓ Infrastructure loaded"` and `"✓ Risk basins loaded"` once only
- [ ] Data persists on map without re-fetching

**Actual Counts (after 60s):**
- Infrastructure: _____ request(s)
- Risk basins: _____ request(s)

**Status:** ☐ Pass ☐ Fail ☐ N/A
**Notes:**

---

### Test Case 3.4: No Duplicate Fetching from map/page.tsx
**Prerequisites:** Logged in as any user

**Steps:**
1. Navigate to `/map`
2. Open Browser DevTools > Network tab
3. Filter for `geo/incidents`
4. Wait 35 seconds
5. Analyze request patterns

**Expected Results:**
- [ ] Incidents requested at 0s, ~15s, ~30s (exactly 3 times in 35s)
- [ ] No "double fetching" at same timestamp
- [ ] No requests at 30s intervals (old behavior was 30s from page.tsx)
- [ ] Only RicerMap component is making data requests

**Status:** ☐ Pass ☐ Fail ☐ N/A
**Notes:**

---

## 🚨 Error Handling Testing (Issue #5: User Feedback)

### Test Case 4.1: Network Disconnection - Error Banner Appears
**Prerequisites:** Logged in as any user, map loaded successfully

**Steps:**
1. Navigate to `/map`
2. Wait for map to load completely
3. Open Browser DevTools > Network tab
4. Enable "Offline" mode in DevTools
5. Wait 20 seconds for next data fetch attempt
6. Observe UI for error feedback

**Expected Results:**
- [ ] Error banner appears with yellow/orange warning styling
- [ ] Banner text: "Some map data could not be loaded"
- [ ] Specific error listed: "• Incidents: Failed to fetch incidents: Network error"
- [ ] Map base layer still visible and interactive
- [ ] Previously loaded data remains on map
- [ ] No app crash or white screen

**Status:** ☐ Pass ☐ Fail ☐ N/A
**Notes:**

---

### Test Case 4.2: Network Reconnection - Error Banner Clears
**Prerequisites:** Following Test Case 4.1 (error banner visible)

**Steps:**
1. Disable "Offline" mode in DevTools
2. Wait for next automatic refresh attempt (~15s for incidents)
3. Observe error banner and console

**Expected Results:**
- [ ] Error banner automatically disappears
- [ ] Console shows: `"✓ Incidents refreshed"`
- [ ] New/updated data appears on map
- [ ] Map functions normally again

**Status:** ☐ Pass ☐ Fail ☐ N/A
**Notes:**

---

### Test Case 4.3: API Error (500) - User-Friendly Message
**Prerequisites:** Access to modify API responses (use browser extension or proxy)

**Setup:** Mock `/api/geo/incidents` to return 500 error

**Steps:**
1. Configure API to return 500 error for incidents endpoint
2. Navigate to `/map`
3. Wait for map to load
4. Check error banner

**Expected Results:**
- [ ] Error banner appears
- [ ] Message: "• Incidents: Failed to load incidents: HTTP 500"
- [ ] Console error logged for debugging
- [ ] Other layers (resources, infrastructure) still load if available
- [ ] App remains functional

**Status:** ☐ Pass ☐ Fail ☐ N/A
**Notes:**

---

### Test Case 4.4: CIVILIAN 403 - No Error Display (Expected Behavior)
**Prerequisites:** Logged in as CIVILIAN user

**Steps:**
1. Navigate to `/map`
2. Open Browser DevTools > Console
3. Wait for all API calls to complete
4. Check for error banner

**Expected Results:**
- [ ] No error banner displayed for resources 403
- [ ] Console info (not error): `"Resources not available for current user role"`
- [ ] Other layers load successfully
- [ ] Map fully functional for CIVILIAN user

**Status:** ☐ Pass ☐ Fail ☐ N/A
**Notes:**

---

## 🎨 UI Components Testing (Issue #3: Navigation/Scale/Legend)

### Test Case 5.1: NavigationControl Rendering and Functionality
**Prerequisites:** Logged in as any user

**Steps:**
1. Navigate to `/map`
2. Wait for map to load
3. Locate NavigationControl in **top-right corner** of map
4. Test zoom buttons
5. Test compass/bearing reset
6. Test pitch visualizer (in 3D mode)

**Expected Results:**
- [ ] NavigationControl visible in top-right
- [ ] Contains zoom in (+) button
- [ ] Contains zoom out (-) button
- [ ] Contains compass button
- [ ] Zoom in button increases zoom level
- [ ] Zoom out button decreases zoom level
- [ ] Compass button resets bearing to north
- [ ] Pitch visualizer shown when 3D mode enabled
- [ ] All controls responsive (hover states work)

**Status:** ☐ Pass ☐ Fail ☐ N/A
**Notes:**

---

### Test Case 5.2: ScaleControl Rendering and Updates
**Prerequisites:** Logged in as any user

**Steps:**
1. Navigate to `/map`
2. Wait for map to load
3. Locate ScaleControl in **bottom-left corner** of map
4. Note scale value
5. Zoom in significantly
6. Observe scale change
7. Zoom out
8. Observe scale change again

**Expected Results:**
- [ ] ScaleControl visible in bottom-left
- [ ] Shows metric units (meters/kilometers)
- [ ] Scale bar is horizontal black line with distance label
- [ ] Scale updates dynamically when zooming in (smaller distance)
- [ ] Scale updates dynamically when zooming out (larger distance)
- [ ] Scale is accurate for map zoom level

**Status:** ☐ Pass ☐ Fail ☐ N/A
**Notes:**

---

### Test Case 5.3: MapLegend - Initial State and Visibility
**Prerequisites:** Logged in as any user

**Steps:**
1. Navigate to `/map`
2. Wait for map to load
3. Locate MapLegend in **bottom-right corner** of map
4. Verify all legend sections

**Expected Results:**
- [ ] Legend visible in bottom-right corner
- [ ] White/light background with border and shadow
- [ ] Header button shows "Legend" text
- [ ] Legend is **expanded by default** (content visible)
- [ ] Three main sections visible:
  - **Incident Status** section
  - **Resources** section
  - **Risk Levels** section

**Status:** ☐ Pass ☐ Fail ☐ N/A
**Notes:**

---

### Test Case 5.4: MapLegend - Incident Status Colors
**Prerequisites:** Legend is expanded

**Steps:**
1. Locate "Incident Status" section in legend
2. Verify all 5 status types are listed
3. Check color indicators

**Expected Results:**
- [ ] Section header: "INCIDENT STATUS" (uppercase)
- [ ] 5 status items listed:
  1. **Vigilance** - Yellow/amber circle (#f59e0b)
  2. **Alert** - Orange circle (#f97316)
  3. **Intervention** - Red circle (#ef4444)
  4. **Under Control** - Purple circle (#8b5cf6)
  5. **Extinguished** - Gray circle (#6b7280)
- [ ] Each item has colored circle + label
- [ ] Circles have white border (2px)
- [ ] Text is readable and properly spaced

**Status:** ☐ Pass ☐ Fail ☐ N/A
**Notes:**

---

### Test Case 5.5: MapLegend - Resource Types
**Prerequisites:** Legend is expanded

**Steps:**
1. Locate "Resources" section in legend
2. Verify all 4 resource types are listed
3. Check color indicators

**Expected Results:**
- [ ] Section header: "RESOURCES" (uppercase)
- [ ] 4 resource items listed:
  1. **Truck** - Green circle (#22c55e)
  2. **Aircraft** - Blue circle (#3b82f6)
  3. **Personnel** - Orange circle (#f59e0b)
  4. **Equipment** - Pink circle (#ec4899)
- [ ] Each item has colored circle + label
- [ ] Circles have white border (2px)

**Status:** ☐ Pass ☐ Fail ☐ N/A
**Notes:**

---

### Test Case 5.6: MapLegend - Risk Levels
**Prerequisites:** Legend is expanded

**Steps:**
1. Locate "Risk Levels" section in legend
2. Verify all 5 levels are listed
3. Check color gradient

**Expected Results:**
- [ ] Section header: "RISK LEVELS" (uppercase)
- [ ] 5 risk levels listed:
  1. **Very Low** - Light green (#22c55e, 60% opacity)
  2. **Low** - Yellow (#f59e0b, 60% opacity)
  3. **Moderate** - Orange (#f97316, 60% opacity)
  4. **High** - Red (#ef4444, 60% opacity)
  5. **Extreme** - Dark red (#991b1b, 60% opacity)
- [ ] Color indicators are rectangles (not circles)
- [ ] Each rectangle is 8px wide
- [ ] Semi-transparent appearance (60% opacity)

**Status:** ☐ Pass ☐ Fail ☐ N/A
**Notes:**

---

### Test Case 5.7: MapLegend - Collapse/Expand Functionality
**Prerequisites:** Legend is visible

**Steps:**
1. Click the "Legend" header button
2. Observe animation
3. Click again to expand
4. Repeat 2-3 times

**Expected Results:**
- [ ] First click collapses legend (hides all sections)
- [ ] Arrow icon rotates -90° when collapsed
- [ ] Only "Legend" button remains visible
- [ ] Second click expands legend (shows all sections)
- [ ] Arrow icon rotates back to 0° when expanded
- [ ] Smooth animation (0.2s transition)
- [ ] Toggle works reliably multiple times
- [ ] No layout shifts or jumps

**Status:** ☐ Pass ☐ Fail ☐ N/A
**Notes:**

---

### Test Case 5.8: MapLegend - Internationalization (i18n)
**Prerequisites:** Logged in as any user

**Steps:**
1. Navigate to `/map` (English selected)
2. Verify English legend labels
3. Switch to French (FR)
4. Verify French legend labels
5. Switch to Arabic (AR)
6. Verify Arabic legend labels (RTL layout)

**Expected Results:**

**English:**
- [ ] "Legend", "Incident Status", "Resources", "Risk Levels"
- [ ] "Vigilance", "Alert", "Intervention", "Under Control", "Extinguished"
- [ ] "Truck", "Aircraft", "Personnel", "Equipment"
- [ ] "Very Low", "Low", "Moderate", "High", "Extreme"

**French:**
- [ ] "Légende", "État des incidents", "Ressources", "Niveaux de risque"
- [ ] "Vigilance", "Alerte", "Intervention", "Maîtrisé", "Éteint"
- [ ] "Camion", "Avion", "Personnel", "Équipement"
- [ ] "Très faible", "Faible", "Modéré", "Élevé", "Extrême"

**Arabic:**
- [ ] "وسيلة الإيضاح", "حالة الحادثة", "الموارد", "مستويات المخاطر"
- [ ] "يقظة", "تنبيه", "تدخل", "تحت السيطرة", "مطفأ"
- [ ] "شاحنة", "طائرة", "أفراد", "معدات"
- [ ] "منخفض جداً", "منخفض", "متوسط", "مرتفع", "شديد"
- [ ] Text aligned right (RTL)

**Status:** ☐ Pass ☐ Fail ☐ N/A
**Notes:**

---

## 🖱️ Hover Popup Testing (Issue #6: Quick Preview)

### Test Case 6.1: Hover Popup Appears on Incident Marker
**Prerequisites:** Logged in as any user, map has incident markers visible

**Steps:**
1. Navigate to `/map`
2. Wait for incidents to load
3. Locate a single incident marker (not a cluster)
4. Hover mouse over the incident marker
5. Hold hover for 1 second

**Expected Results:**
- [ ] Popup appears below the marker (anchor: bottom)
- [ ] Popup has white background with shadow
- [ ] Popup displays:
  - Incident ID (first 8 characters)
  - Status with colored circle indicator
  - Severity level (X/5)
  - Cause (if available)
  - "Click for details" hint text at bottom
- [ ] Popup styled with custom CSS (`.incident-popup` class)
- [ ] No close button (closeButton: false)
- [ ] Popup positioned 10px below marker (offset)

**Status:** ☐ Pass ☐ Fail ☐ N/A
**Notes:**

---

### Test Case 6.2: Hover Popup Disappears on Mouse Leave
**Prerequisites:** Following Test Case 6.1 (popup visible)

**Steps:**
1. Move mouse away from incident marker
2. Observe popup behavior

**Expected Results:**
- [ ] Popup disappears immediately when mouse leaves marker
- [ ] No delay in popup hiding
- [ ] Clean removal (no flickering)

**Status:** ☐ Pass ☐ Fail ☐ N/A
**Notes:**

---

### Test Case 6.3: Click Opens Full Drawer (Hover Popup Closes)
**Prerequisites:** Hover popup is visible over an incident

**Steps:**
1. While hovering over incident (popup visible)
2. Click on the incident marker
3. Observe both popup and drawer behavior

**Expected Results:**
- [ ] Hover popup disappears on click
- [ ] Right drawer opens with full incident details
- [ ] Drawer shows complete information (not just preview)
- [ ] No duplicate information displayed
- [ ] Drawer remains open after click

**Status:** ☐ Pass ☐ Fail ☐ N/A
**Notes:**

---

### Test Case 6.4: No Popup on Cluster Hover
**Prerequisites:** Map zoomed out enough to show incident clusters

**Steps:**
1. Navigate to `/map`
2. Zoom out until incidents cluster together
3. Hover over a cluster icon (circle with number)
4. Observe behavior

**Expected Results:**
- [ ] No hover popup appears on clusters
- [ ] Only individual incidents trigger popups
- [ ] Cluster hover doesn't cause errors
- [ ] Click on cluster still zooms in (normal behavior)

**Status:** ☐ Pass ☐ Fail ☐ N/A
**Notes:**

---

### Test Case 6.5: Hover Popup on Mobile/Touch Devices
**Prerequisites:** Testing on mobile device or mobile emulation

**Steps:**
1. Navigate to `/map` on mobile
2. Tap once on an incident marker
3. Observe behavior
4. Tap again on same marker

**Expected Results:**
- [ ] First tap shows hover popup (mobile hover simulation)
- [ ] Popup displays same information as desktop
- [ ] Second tap opens full drawer
- [ ] Touch interaction feels natural
- [ ] No accidental zoom/pan when tapping

**Status:** ☐ Pass ☐ Fail ☐ N/A
**Notes:**

---

### Test Case 6.6: Popup Content Accuracy
**Prerequisites:** Logged in, hover popup visible

**Steps:**
1. Hover over an incident to show popup
2. Click to open drawer
3. Compare popup information with drawer information

**Expected Results:**
- [ ] Incident ID matches
- [ ] Status matches
- [ ] Status color matches
- [ ] Severity number matches
- [ ] Cause matches (if present)
- [ ] All information is accurate and up-to-date

**Status:** ☐ Pass ☐ Fail ☐ N/A
**Notes:**

---

## 🌍 Cross-Browser Testing

### Browser: Chrome/Edge
**Version:** ________

| Test Area | Status | Notes |
|-----------|--------|-------|
| RBAC (1.1-1.2) | ☐ Pass ☐ Fail | |
| Type Safety (2.1-2.2) | ☐ Pass ☐ Fail | |
| Refresh Timing (3.1-3.4) | ☐ Pass ☐ Fail | |
| Error Handling (4.1-4.4) | ☐ Pass ☐ Fail | |
| UI Components (5.1-5.8) | ☐ Pass ☐ Fail | |
| Hover Popups (6.1-6.6) | ☐ Pass ☐ Fail | |

---

### Browser: Firefox
**Version:** ________

| Test Area | Status | Notes |
|-----------|--------|-------|
| RBAC (1.1-1.2) | ☐ Pass ☐ Fail | |
| Type Safety (2.1-2.2) | ☐ Pass ☐ Fail | |
| Refresh Timing (3.1-3.4) | ☐ Pass ☐ Fail | |
| Error Handling (4.1-4.4) | ☐ Pass ☐ Fail | |
| UI Components (5.1-5.8) | ☐ Pass ☐ Fail | |
| Hover Popups (6.1-6.6) | ☐ Pass ☐ Fail | |

---

### Browser: Safari (Desktop or Mobile)
**Version:** ________

| Test Area | Status | Notes |
|-----------|--------|-------|
| RBAC (1.1-1.2) | ☐ Pass ☐ Fail | |
| Type Safety (2.1-2.2) | ☐ Pass ☐ Fail | |
| Refresh Timing (3.1-3.4) | ☐ Pass ☐ Fail | |
| Error Handling (4.1-4.4) | ☐ Pass ☐ Fail | |
| UI Components (5.1-5.8) | ☐ Pass ☐ Fail | |
| Hover Popups (6.1-6.6) | ☐ Pass ☐ Fail | |

---

## 📱 Responsive Testing

### Desktop (1920x1080)
- [ ] All UI elements visible and properly sized
- [ ] Legend doesn't overlap map content
- [ ] Navigation controls accessible
- [ ] Hover popups positioned correctly
- [ ] No horizontal scrolling

---

### Tablet (768x1024)
- [ ] Layout adjusts appropriately
- [ ] Touch targets sufficiently large (min 44x44px)
- [ ] Legend repositions if needed
- [ ] Controls remain accessible
- [ ] Text remains readable

---

### Mobile (375x667)
- [ ] Map fills viewport properly
- [ ] Legend collapsible to save space
- [ ] Controls don't overlap
- [ ] Tap targets large enough
- [ ] Zoom/pan gestures work smoothly
- [ ] Popup doesn't overflow screen

---

## ♿ Accessibility Testing

### Keyboard Navigation
- [ ] All interactive elements reachable via Tab key
- [ ] Focus indicators visible
- [ ] Legend can be toggled with keyboard
- [ ] Map controls accessible with keyboard
- [ ] Escape key closes drawer

### Screen Reader Testing
- [ ] Legend sections have proper headings
- [ ] ARIA labels present on icon buttons
- [ ] Error messages announced
- [ ] Map canvas has alt text
- [ ] Color not sole means of conveying information

### Color Contrast
- [ ] Legend text meets WCAG AA (4.5:1)
- [ ] Button text readable
- [ ] Error messages have sufficient contrast
- [ ] Status colors distinguishable

---

## 🐛 Regression Testing

Verify that existing functionality still works:

- [ ] Login/logout functions correctly
- [ ] Report fire form works
- [ ] Weather widget displays
- [ ] Analytics page loads
- [ ] Reports list page loads
- [ ] Equipment page works
- [ ] Language switching (EN/FR/AR)
- [ ] Dark mode (if implemented)
- [ ] Drawer opens/closes smoothly
- [ ] Layer toggles work (Incidents, Infrastructure, Resources, Risk zones)
- [ ] 3D mode toggle works
- [ ] Base map toggle (Streets/Satellite)

---

## 📊 Performance Testing

### Page Load Performance
- [ ] Map loads in < 3 seconds
- [ ] Time to Interactive (TTI) < 5 seconds
- [ ] First Contentful Paint (FCP) < 2 seconds
- [ ] No console errors during load

### Runtime Performance
- [ ] Smooth panning (60 FPS)
- [ ] Smooth zooming (60 FPS)
- [ ] Layer toggle instant (< 100ms)
- [ ] Popup appears instantly on hover
- [ ] No memory leaks after 5 minutes
- [ ] Memory usage < 500MB

### Network Performance
- [ ] GeoJSON responses < 200KB each
- [ ] Total page weight < 3MB
- [ ] Refresh requests efficient (minimal payload)
- [ ] No unnecessary requests

---

## ✅ Sign-Off

### Tester Information
- **Name:** ___________________________
- **Date:** ___________________________
- **Build Version:** ___________________________

### Overall Status
- [ ] ✅ All critical tests passed - **APPROVED FOR RELEASE**
- [ ] ⚠️ Minor issues found - **APPROVED WITH NOTES**
- [ ] ❌ Critical issues found - **REQUIRES FIXES**

### Critical Issues Found
_List any blocking issues:_

1. _________________________________________
2. _________________________________________
3. _________________________________________

### Notes
_Additional comments or observations:_

---

## 📎 Attachments

- Screenshots of failed tests: ___________________________
- Screen recordings: ___________________________
- Console logs: ___________________________
- Network HAR files: ___________________________

---

**END OF CHECKLIST**
