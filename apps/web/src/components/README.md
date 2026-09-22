# Components Directory

## Overview

This directory contains all React components organized by functionality and reusability.

## Structure

```
components/
├── ui/               # Pure, reusable UI primitives
├── map/              # Map visualization components
├── reports/          # Report creation & management
├── analytics/        # Analytics visualizations
├── equipment/        # Equipment management UI
├── layout/           # Layout & navigation components
├── shell/            # Shell/container components
└── auth/             # Authentication UI
```

---

## ui/ - UI Primitives

Reusable, atomic UI components following design system principles.

### Button.tsx
Generic button component with variants and sizes.

**Props:**
- `variant`: 'primary' | 'secondary' | 'danger' | 'ghost'
- `size`: 'sm' | 'md' | 'lg'
- `disabled`: boolean
- `onClick`: () => void

**Example:**
```tsx
<Button variant="primary" size="lg" onClick={handleSubmit}>
  Submit Report
</Button>
```

### IconButton.tsx
Button with icon, no text.

**Props:**
- `icon`: LucideIcon
- `label`: string (aria-label)
- `onClick`: () => void

### TextField.tsx
Text input with label and error states.

**Props:**
- `label`: string
- `value`: string
- `onChange`: (value: string) => void
- `error`: string | undefined
- `required`: boolean

### SelectField.tsx
Dropdown select with label.

**Props:**
- `label`: string
- `value`: string
- `options`: Array<{ value: string; label: string }>
- `onChange`: (value: string) => void

### Badge.tsx
Status badge with color variants.

**Props:**
- `variant`: 'success' | 'warning' | 'danger' | 'info'
- `children`: ReactNode

### Icon.tsx
Wrapper for Lucide icons with consistent sizing.

### SearchInput.tsx
Search input with debouncing.

---

## map/ - Map Components

### RicerMap.tsx (747 lines)
Main interactive map component.

**Features:**
- Incident clustering and visualization
- Resource tracking (trucks, aircraft, personnel)
- Infrastructure display (watchtowers, water points, firebreaks)
- Risk basin polygons
- 3D terrain mode
- Heatmap overlay
- Fullscreen mode
- Real-time data polling (10s interval)

**Dependencies:**
- `react-map-gl` - MapLibre wrapper
- `@deck.gl` - 3D layer rendering
- `useMapStore` - Map state management

**Layers:**
- Incident points (clustered)
- Resources (deck.gl IconLayer)
- Infrastructure (deck.gl IconLayer + PathLayer)
- Risk basins (polygon layer)
- Heatmap (optional)

### MapControls.tsx
Map control panel for toggling layers, basemap, 3D mode.

**Props:**
- `onToggleFullscreen`: () => void

### MapLegend.tsx
Collapsible legend showing color codes for incidents, resources, risk levels.

### LocationPicker.tsx
Interactive location selector for report submission.

**Props:**
- `onLocationSelect`: (coords: [number, number]) => void
- `initialLocation`: [number, number] | undefined

---

## reports/ - Report Components

### ReportForm.tsx
Fire report submission form.

**Fields:**
- Location (LocationPicker)
- Description (textarea)
- Fire size (select)
- Reporter phone (tel input)

**Validation:**
- Required fields
- Phone number format
- Location within bounds

### ReportCard.tsx
Display report summary in list view.

**Props:**
- `report`: Report
- `onClick`: () => void

---

## analytics/ - Analytics Components

### IncidentChart.tsx
Bar chart showing incidents by status/severity.

**Uses:** Recharts

### TrendChart.tsx
Line chart showing incident trends over time.

---

## equipment/ - Equipment Components

### TruckMap.tsx
Simplified map showing truck locations and status.

**Features:**
- Truck markers with status colors
- Click for details popup
- Status legend

### EquipmentCard.tsx
Equipment details card.

---

## layout/ - Layout Components

### Navbar.tsx
Top navigation bar with:
- Logo
- Page navigation
- Language switcher
- User menu (auth status)
- Logout button

### AuthProvider.tsx
Auth context provider wrapping protected routes.

**Features:**
- JWT validation
- Automatic logout on expiry
- Loading states

### LanguageSwitcher.tsx
Dropdown for switching UI language (AR/FR/EN).

**Uses:** `useLanguageStore`

### NotificationsPanel.tsx
Side panel for viewing notifications (future feature).

### LocaleSync.tsx
Syncs Zustand language store with browser locale.

---

## shell/ - Shell Components

### RightDrawer.tsx
Collapsible right-side drawer for displaying incident details.

**Props:**
- `incident`: Incident | null
- `onClose`: () => void

**Features:**
- Slide-in animation
- Incident details display
- Status badge
- Close button

### SidebarRail.tsx
Left sidebar navigation rail.

**Features:**
- Icon-based navigation
- Active route highlighting
- Tooltips

---

## auth/ - Authentication Components

### AuthShell.tsx
Container for signin/signup pages.

**Features:**
- Centered layout
- Logo header
- Language switcher
- Form container with styling

---

## Naming Conventions

### Files
- **PascalCase** for component files: `Button.tsx`, `ReportForm.tsx`
- One component per file
- Named exports: `export const Button = ...`

### Props
- **Interface suffix**: `ButtonProps`, `MapControlsProps`
- Always define prop types explicitly

### Styling
- **Tailwind classes** for all styling
- Avoid inline styles unless dynamic
- Use `cn()` utility for conditional classes

### State
- **Local state**: `useState` for component-specific state
- **Global state**: Zustand stores for shared state
- **Server state**: Direct API calls (no React Query yet)

---

## Testing

### Unit Tests
Location: `tests/unit/`

- **Button.test.tsx** - Button variants and interactions
- **IconButton.test.tsx** - Icon button accessibility
- **TextField.test.tsx** - Input validation and errors
- **SelectField.test.tsx** - Dropdown functionality
- **Badge.test.tsx** - Badge variants

### Integration Tests
Location: `tests/integration/`

- **RightDrawer.test.tsx** - Drawer open/close behavior

### E2E Tests
Location: `tests/e2e/`

- **map.spec.ts** - Map interactions, layer toggles
- **auth.spec.ts** - Login/logout flows
- **report.spec.ts** - Report submission workflow

---

## Best Practices

### Component Design
1. **Single Responsibility**: Each component does one thing well
2. **Composability**: Prefer composition over complex props
3. **Accessibility**: Always include ARIA labels, keyboard navigation
4. **Performance**: Use `memo` for expensive renders, `useCallback` for callbacks

### Props
1. **Required props first**, optional last
2. **Destructure in parameter**: `({ label, onClick }: ButtonProps)`
3. **Default values**: Use parameter defaults or destructuring defaults

### State Management
1. **Lift state up** only when needed
2. **Avoid prop drilling**: Use Zustand for deeply nested data
3. **Derive state**: Compute from existing state instead of duplicating

### Styling
1. **Mobile-first**: Start with mobile styles, add `md:` `lg:` breakpoints
2. **Consistent spacing**: Use Tailwind's spacing scale (p-4, gap-2)
3. **Dark mode ready**: Use semantic color classes where possible

### Code Organization
```tsx
// 1. Imports (React, libraries, types, components, utils)
// 2. Types/interfaces
// 3. Component definition
// 4. Early returns (guards)
// 5. Hooks (useState, useEffect, custom hooks)
// 6. Handlers
// 7. Computed values (useMemo, derived state)
// 8. Render
```

---

## Future Improvements

- [ ] Extract more shared patterns into ui/ primitives
- [ ] Add Storybook for component documentation
- [ ] Implement React Server Components where beneficial
- [ ] Add component performance monitoring
- [ ] Create design tokens file for consistent theming
