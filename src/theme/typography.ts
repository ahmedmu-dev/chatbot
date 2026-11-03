import type { TextStyle } from 'react-native';

/** System font. Body 16/22, small 13/18. */
export const typography = {
  body: { fontSize: 16, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  mono: { fontSize: 14, lineHeight: 20, fontFamily: 'Menlo' },
} as const satisfies Record<string, TextStyle>;
