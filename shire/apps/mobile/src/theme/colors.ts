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
  // Premium iOS / Airbnb Vibe
  background: '#F2F2F7', // iOS System Gray 6
  backgroundDark: '#1C1C1E', // Unused in light-only

  surface: {
    level1: '#FFFFFF', // Pure white cards
    level2: '#F9F9F9', // Very subtle off-white for sidebars/panels
    level3: '#F2F2F7', // Floor canvas
    level4: '#E5E5EA', // Inset wells
  },

  // Ink
  text: {
    primary: '#1C1C1E', // Absolute dark slate
    secondary: '#8E8E93', // Crisp medium-gray
    muted: '#C7C7CC', // Lighter gray
    inverse: '#FFFFFF',
  },

  // Functional status spectrum
  status: {
    available: {
      fill: '#E8F5E9',
      border: '#34C759',
      text: '#248A3D',
    },
    occupied: {
      fill: '#E3F2FD',
      border: '#007AFF',
      text: '#0055B3',
    },
    dirty: {
      fill: '#FFEBEE',
      border: '#FF3B30',
      text: '#B3261E',
    },
    reserved: {
      fill: '#FFF8E1',
      border: '#FF9500',
      text: '#B36800',
    },
  },

  blocked: {
    fill: '#F2F2F7',
    border: '#AEAEB2',
    text: '#8E8E93',
  },

  // Brand accent — vibrant Airbnb/Yelp red
  accent: '#FF385C',
  accentLight: '#FFF0F2',

  // Glass/surface tokens
  glass: {
    tint: '#FFFFFF',
    border: '#E5E5EA',
    borderSubtle: '#F2F2F7',
    shadow: 'rgba(0, 0, 0, 0.08)',
    innerHighlight: '#FFFFFF',
  },

  // Hairline borders
  border: {
    default: '#E5E5EA',
    subtle: '#F2F2F7',
    strong: '#C7C7CC',
    warm: '#E5E5EA',
  },

  white: '#FFFFFF',
  black: '#000000',
};

// Light-only: darkColors aliases lightColors so existing imports resolve.
export const darkColors: Colors = lightColors;

// Backward-compatible static export.
export const colors = lightColors;

export type StatusKey = keyof Colors['status'];
