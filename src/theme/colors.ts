/** Colour tokens (light mode only in S01; dark mode arrives in S03, so never hard-code colours). */
export const colors = {
  background: '#FFFFFF',
  surface: '#F4F4F6',
  text: '#1A1A1E',
  textSecondary: '#6B6B76',
  accent: '#4F46E5',
  onAccent: '#FFFFFF',
  error: '#D93636',
  disabled: '#C7C7CF',
  codeBackground: '#E6E6EB',
  border: '#E6E6EB',
} as const;

export type ColorToken = keyof typeof colors;
