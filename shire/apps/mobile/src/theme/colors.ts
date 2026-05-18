// Shire Design System — Color Tokens
// "Calm software" — soft-cream, light-only. Arc / Craft / Raycast spirit.

type StatusPalette = {
  fill: string;
  border: string;
  text: string;
};

export type Colors = {
  background: string;
  backgroundDark: string;
  surface: {
    level1: string;
    level2: string;
    level3: string;
    level4: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
  };
  status: {
    available: StatusPalette;
    occupied: StatusPalette;
    dirty: StatusPalette;
    reserved: StatusPalette;
  };
  // Blocked is a top-level token (not a StatusKey) — applied via `isBlocked`.
  blocked: StatusPalette;
  accent: string;
  accentLight: string;
  glass: {
    tint: string;
    border: string;
    borderSubtle: string;
    shadow: string;
    innerHighlight: string;
  };
  border: {
    default: string;
    subtle: string;
    strong: string;
    warm: string;
  };
  white: string;
  black: string;
};

export const lightColors: Colors = {
  // Cool warm-neutral surfaces (greige — only a whisper of warmth)
  background: '#EBEBE9', // page
  backgroundDark: '#1F1E1C', // legacy field — unused in light-only

  surface: {
    level1: '#FFFFFF', // cards & table tiles
    level2: '#F4F4F2', // sidebar & side panels
    level3: '#FBFBFA', // floor canvas
    level4: '#F0F0EE', // inset wells / segmented-control track
  },

  // Ink
  text: {
    primary: '#1F1E1C',
    secondary: '#67655F',
    muted: '#9A988F',
    inverse: '#FFFFFF',
  },

  // Functional status spectrum — fill = faint tile tint, border = the
  // canonical hue (legend dots / rings), text = a readable darker variant.
  status: {
    available: {
      fill: '#ECF1E8',
      border: '#3F7A4E',
      text: '#2F6B40',
    },
    occupied: {
      fill: '#E9EFF4',
      border: '#3E6E9E',
      text: '#2E5C88',
    },
    dirty: {
      fill: '#F6E7E5',
      border: '#C24238',
      text: '#A5392F',
    },
    reserved: {
      fill: '#FBF1DF',
      border: '#BE8A2A',
      text: '#94681B',
    },
  },

  blocked: {
    fill: '#ECEAE6',
    border: '#9AA0A2',
    text: '#6F6A62',
  },

  // Brand accent — blue, rationed
  accent: '#2F6CAE',
  accentLight: '#E7EEF6',

  // Surface tokens (GlassSurface is now a solid surface)
  glass: {
    tint: '#FFFFFF',
    border: '#E5E4E1',
    borderSubtle: '#EDEDEA',
    shadow: 'rgba(28, 28, 26, 0.06)',
    innerHighlight: '#FFFFFF',
  },

  // Hairline borders
  border: {
    default: '#E5E4E1',
    subtle: '#EDEDEA',
    strong: '#D6D5D0',
    warm: '#E5E4E1',
  },

  white: '#FFFFFF',
  black: '#000000',
};

// Light-only: darkColors aliases lightColors so existing imports resolve.
export const darkColors: Colors = lightColors;

// Backward-compatible static export.
export const colors = lightColors;

export type StatusKey = keyof Colors['status'];
