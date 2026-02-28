# Shire iOS — Project Guidelines

## Critical: No expo-blur / BlurView

**NEVER use `BlurView` from `expo-blur`** in this project. It causes "Unimplemented component: \<ViewManagerAdapter_ExpoBlurView\>" errors in Expo Go and new-architecture builds.

Instead, use **plain `View` components with `rgba()` backgrounds** for glass-morphism effects. The `GlassSurface` component already handles this — use it for all translucent surface needs.

```tsx
// BAD — causes red "Unimplemented component" errors
import { BlurView } from 'expo-blur';
<BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />

// GOOD — works everywhere
<View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.85)' }]} />
// Or better, use the shared component:
<GlassSurface intensity={40} tint="light">...</GlassSurface>
```

## Dark Mode

The app supports system dark mode via `ThemeProvider` + `useTheme()` hook.

- **ThemeProvider** wraps the app in `_layout.tsx` and reads `useColorScheme()`
- **useTheme()** returns `{ colors, isDark }` — use this in all components
- Color tokens are defined in `src/theme/colors.ts` (`lightColors` / `darkColors`)
- Static `colors` export = `lightColors` (backward compat for module-level styles)
- For dynamic theming: use `useTheme()` and apply colors inline

```tsx
const { colors, isDark } = useTheme();
<View style={[styles.container, { backgroundColor: colors.background }]}>
```

## Project Structure

```
shire/apps/mobile/src/
├── app/              # Expo Router screens
│   ├── (auth)/       # Login flow
│   └── (host)/       # Main host dashboard (Floor Plan, Waitlist, Seat Party)
├── components/       # Shared UI components
│   ├── GlassSurface  # Translucent glass container (NO BlurView)
│   ├── Table         # Floor plan table element
│   ├── TablePopover  # Table detail modal
│   ├── FilterPill    # Category filter chip
│   ├── QuickSeatCard # Quick seat suggestion card
│   └── WaitlistCard  # Waitlist party row
└── theme/            # Design tokens
    ├── colors.ts     # Light + dark color palettes
    ├── ThemeContext   # ThemeProvider + useTheme hook
    ├── typography.ts  # Font sizes, weights, text styles
    ├── spacing.ts    # 4px-based spacing scale
    ├── shadows.ts    # Shadow definitions
    └── borders.ts    # Border radius tokens
```

## Design System

- All colors come from `@/theme` — never hardcode colors in components
- Spacing uses a 4px base: xs(4) sm(8) md(12) lg(16) xl(20) 2xl(24) 3xl(32)
- Use `textStyles` presets (headline, title, subtitle, body, caption, etc.)
- Status colors: available (green), occupied (blue), dirty (red), reserved (orange)
