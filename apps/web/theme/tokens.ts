export const yaraTokens = {
  color: {
    accent: '#ff4f17',
    background: '#ffffff',
    surfaceWarm: '#f5ede3',
    surfaceInverse: '#241c17',
    text: '#1f1c17',
    textSecondary: '#756e63',
    textInverse: '#ffffff',
    textInverseSecondary: '#d1c7b8',
    border: '#e7ded2',
  },
  typography: {
    family:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    lineHeight: 1.35,
    weight: {
      regular: 400,
      medium: 500,
      semibold: 600,
    },
  },
  radius: {
    control: 12,
    card: 16,
    feature: 20,
    pill: 999,
  },
  space: {
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
  },
} as const;
