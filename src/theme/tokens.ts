// Colours and fonts for the whole app. Values come from the web app
// (~/modusys/app/globals.css) and docs/MOBILE_DESIGN_PROMPTS.md (Prompt 0).
// Screens use these names only, never hex values.

export const colors = {
  primary: '#288AB8', // primary-900 on the web
  primaryPressed: '#2D9CCF',
  primaryTint: '#EAF7FC', // field backgrounds, info strips
  primarySoft: '#D6EFFA', // soft cards
  primaryChip: '#ADDEF5', // selected chips, section headers

  text: '#262626',
  textSecondary: '#5D6772',
  placeholder: '#AAB0B6',
  border: '#E2E4E8',

  background: '#F7F8F9',
  card: '#FFFFFF',
  white: '#FFFFFF',

  success: '#27AE60',
  successTint: '#F4F8F7',
  error: '#EF1E1E',
  errorTint: '#FEF4F4',
  warningText: '#B8901F',
  warningTint: '#FEF3F5',
  indigo: '#3538C0',
  indigoTint: '#EDEDF8',
  orange: '#E04F16',
  orangeTint: '#FDF8F3',
  cyan: '#06AED4',
  cyanTint: '#E9F8FB',
  teal: '#0E9384',
  tealTint: '#E9F5F4',
  grey: '#45505C',
  greyTint: '#F4F4F4',
} as const;

// Raleway (text) + Manrope (numbers), the same .ttf files as the web, are in
// assets/fonts/ but not linked into the iOS/Android projects yet. Until they
// are, `undefined` = the system font (an unlinked family name errors on iOS).
const FONTS_LINKED = false;

export const fonts = {
  body: FONTS_LINKED ? 'Raleway-Regular' : undefined,
  light: FONTS_LINKED ? 'Raleway-Light' : undefined,
  number: FONTS_LINKED ? 'Manrope' : undefined,
} as const;

export const radius = { sm: 8, md: 12, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const touch = 44; // minimum touch target (points)

export const type = {
  title: { fontSize: 24, fontWeight: '600' as const, color: colors.text, fontFamily: fonts.body },
  heading: { fontSize: 18, fontWeight: '600' as const, color: colors.text, fontFamily: fonts.body },
  body: { fontSize: 15, color: colors.text, fontFamily: fonts.body },
  label: { fontSize: 13, fontWeight: '500' as const, color: colors.textSecondary, fontFamily: fonts.body },
  small: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.body },
};

export const shadow = {
  shadowColor: '#051021',
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;
