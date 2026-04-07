// Shire Design System — Color Tokens

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
  // Backgrounds
  background: '#F7F5F0',
  backgroundDark: '#1a1a2e',

  // Surface levels (glass layering)
  surface: {
    level1: 'rgba(255, 255, 255, 0.72)',
    level2: 'rgba(255, 255, 255, 0.55)',
    level3: 'rgba(255, 255, 255, 0.35)',
    level4: 'rgba(255, 255, 255, 0.18)',
  },

  // Text
  text: {
    primary: '#1a1a1a',
    secondary: '#666666',
    muted: '#8A847A',
    inverse: '#FFFFFF',
  },

  // Status palette — fill + border pairs
  status: {
    available: {
      fill: 'rgba(52, 199, 89, 0.08)',
      border: '#34C759',
      text: '#2DA44E',
    },
    occupied: {
      fill: 'rgba(0, 122, 255, 0.08)',
      border: '#007AFF',
      text: '#0066DD',
    },
    dirty: {
      fill: 'rgba(255, 59, 48, 0.08)',
      border: '#FF3B30',
      text: '#DD3328',
    },
    reserved: {
      fill: 'rgba(255, 149, 0, 0.08)',
      border: '#FF9500',
      text: '#E88B12',
    },
  },

  // Brand accent — warm emerald
  accent: '#2D8B55',
  accentLight: 'rgba(45, 139, 85, 0.12)',

  // Glass tokens
  glass: {
    tint: 'rgba(255, 255, 255, 0.4)',
    border: 'rgba(255, 255, 255, 0.5)',
    borderSubtle: 'rgba(255, 255, 255, 0.3)',
    shadow: 'rgba(0, 0, 0, 0.08)',
    innerHighlight: 'rgba(255, 255, 255, 0.6)',
  },

  // UI borders
  border: {
    default: 'rgba(0, 0, 0, 0.06)',
    subtle: 'rgba(0, 0, 0, 0.04)',
    strong: 'rgba(0, 0, 0, 0.12)',
    warm: '#E8DED1',
  },

  // Semantic
  white: '#FFFFFF',
  black: '#000000',
};

export const darkColors: Colors = {
  background: '#121214',
  backgroundDark: '#0A0A0C',

  surface: {
    level1: 'rgba(255, 255, 255, 0.10)',
    level2: 'rgba(255, 255, 255, 0.07)',
    level3: 'rgba(255, 255, 255, 0.05)',
    level4: 'rgba(255, 255, 255, 0.03)',
  },

  text: {
    primary: '#F0EEEB',
    secondary: '#A0A0A0',
    muted: '#6A6660',
    inverse: '#1a1a1a',
  },

  status: {
    available: {
      fill: 'rgba(52, 199, 89, 0.18)',
      border: '#34C759',
      text: '#4ADE80',
    },
    occupied: {
      fill: 'rgba(0, 122, 255, 0.18)',
      border: '#007AFF',
      text: '#60A5FA',
    },
    dirty: {
      fill: 'rgba(255, 59, 48, 0.18)',
      border: '#FF3B30',
      text: '#F87171',
    },
    reserved: {
      fill: 'rgba(255, 149, 0, 0.18)',
      border: '#FF9500',
      text: '#FBBF24',
    },
  },

  accent: '#34D399',
  accentLight: 'rgba(52, 211, 153, 0.15)',

  glass: {
    tint: 'rgba(255, 255, 255, 0.06)',
    border: 'rgba(255, 255, 255, 0.12)',
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
    shadow: 'rgba(0, 0, 0, 0.4)',
    innerHighlight: 'rgba(255, 255, 255, 0.08)',
  },

  border: {
    default: 'rgba(255, 255, 255, 0.08)',
    subtle: 'rgba(255, 255, 255, 0.05)',
    strong: 'rgba(255, 255, 255, 0.15)',
    warm: '#2A2520',
  },

  white: '#FFFFFF',
  black: '#000000',
};

// Backward-compatible static export (light theme default)
export const colors = lightColors;

export type StatusKey = keyof Colors['status'];
