module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // Digits and ₹ must be set in Manrope as on the website: use src/components/Text (it wraps React Native's).
    'no-restricted-imports': ['error', { paths: [{ name: 'react-native', importNames: ['Text'], message: "Import Text from src/components/Text (digits in Manrope, as the website)." }] }],
  },
  overrides: [{ files: ['src/components/Text.tsx'], rules: { 'no-restricted-imports': 'off' } }],
};
