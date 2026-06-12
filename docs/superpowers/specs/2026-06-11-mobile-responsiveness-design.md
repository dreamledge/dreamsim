# Mobile Responsiveness Improvements

## Goal
Ensure the DreamLedge basketball sim app works seamlessly from 320px (small phones) through 768px+ (tablets/desktops) with padding, font, and grid adjustments while keeping the single-column mobile-first layout.

## Scope: Phone-First
- No complex multi-column desktop redesign
- Focus on preventing overflow, adjusting whitespace, and making grids/typography adapt gracefully

## Changes

### 1. Layout (`Layout.jsx`)
- Widen container: `max-w-lg` → `max-w-3xl`
- Responsive padding: `px-3 sm:px-6 lg:px-8`
- Bottom nav: `gap-1` on small screens, `gap-4` on larger

### 2. Responsive Grids (all pages)
- Add `sm:grid-cols-*` variants where grids are hardcoded
- Collapse multi-column to single-column on very small screens where content is dense
- LeagueDetail quick actions: `grid-cols-3 sm:grid-cols-6`

### 3. Typography
- Responsive heading sizes: `text-2xl sm:text-3xl` patterns
- Ensure no text truncation/overflow on 320px screens

### 4. Cards, Tables & Forms
- Tables: `overflow-x-auto` wrapper for horizontal scroll on small screens
- Cards: consistent internal padding across breakpoints
- Forms: inputs full-width, internal padding adjusts responsively
- Buttons: minimum 44px touch targets

### 5. Global Styles (`style.css`)
- Media queries at 360px (small phone tweaks) and 768px+ (more generous spacing)
- No major restructuring of existing CSS variables

## Files to Modify
- `frontend/src/style.css`
- `frontend/src/components/Layout.jsx`
- All pages with hardcoded grids (approx 10-12 pages)

## Verification
- `npm run build` succeeds
- Manual check: no horizontal scrollbar on 320px viewport
