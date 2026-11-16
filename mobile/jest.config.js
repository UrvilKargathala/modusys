module.exports = {
  preset: '@react-native/jest-preset',
  // Same "@shared/..." path as metro.config.js and tsconfig.json.
  moduleNameMapper: { '^@shared/(.*)$': '<rootDir>/../shared/$1' },
};
