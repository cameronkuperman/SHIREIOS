// Shire Design System — Color Tokens
// Ported verbatim from SHIRE-FRONTEND `src/host/index.css` `.light` theme
// (the "cream" host palette). RGB triplets from that file → hex/rgba here.

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
  // Extra states, top-level so StatusKey stays the 4 data statuses.
  needsServer: StatusPalette;
  blocked: StatusPalette;
  accent: string;
  accentLight: string;
  gold: string;
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
  background: '#F8F5EE', // bg-base 248 245 238

  backgroundDark: '#181612',

  surface: {
    level1: '#FFFEFA', // bg-elevated — cards
    level2: '#FDFAF4', // bg-surface — panels
    level3: '#F8F5EE', // bg-base — canvas
    level4: '#F2EEE4', // bg-hover — wells
  },

  text: {
    primary: '#181612', // 24 22 18
    secondary: '#4B463C', // 75 70 60
    muted: '#827D6E', // 130 125 110
    inverse: '#FFFFFF',
  },

  // Table states — accent fills over a colored border + readable text.
  status: {
    available: {
      fill: 'rgba(75, 160, 90, 0.15)',
      border: 'rgba(75, 160, 90, 0.55)',
      text: '#3C8150',
    },
    occupied: {
      fill: 'rgba(80, 135, 190, 0.13)',
      border: 'rgba(80, 135, 190, 0.45)',
      text: '#3D6A99',
    },
    dirty: {
      fill: 'rgba(140, 110, 75, 0.13)',
      border: 'rgba(140, 110, 75, 0.45)',
      text: '#7A5F40',
    },
    reserved: {
      fill: 'rgba(130, 105, 185, 0.14)',
      border: 'rgba(130, 105, 185, 0.45)',
      text: '#6E5A9C',
    },
  },

  needsServer: {
    fill: 'rgba(190, 155, 40, 0.16)',
    border: 'rgba(190, 155, 40, 0.55)',
    text: '#8A7019',
  },

  blocked: {
    fill: 'rgba(175, 170, 160, 0.18)',
    border: 'rgba(175, 170, 160, 0.6)',
    text: '#827D6E',
  },

  // accent-primary 50 45 35 (warm near-black); gold 150 130 85
  accent: '#322D23',
  accentLight: 'rgba(50, 45, 35, 0.06)',
  gold: '#968255',

  glass: {
    tint: '#FFFEFA',
    border: 'rgba(30, 28, 24, 0.06)',
    borderSubtle: 'rgba(30, 28, 24, 0.04)',
    shadow: 'rgba(30, 28, 24, 0.08)',
    innerHighlight: 'rgba(255, 255, 255, 0.8)',
  },

  border: {
    default: 'rgba(30, 28, 24, 0.08)',
    subtle: 'rgba(30, 28, 24, 0.05)',
    strong: 'rgba(30, 28, 24, 0.14)',
    warm: 'rgba(30, 28, 24, 0.08)',
  },

  white: '#FFFFFF',
  black: '#000000',
};

// Light-only — darkColors aliases lightColors so existing imports resolve.
export const darkColors: Colors = lightColors;
export const colors = lightColors;

export type StatusKey = keyof Colors['status'];
