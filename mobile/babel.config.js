module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Zod 4 uses `export * as x from`, which the React Native preset doesn't
  // convert. The plugin already ships with the template's @babel/preset-env.
  plugins: ['@babel/plugin-transform-export-namespace-from'],
};
