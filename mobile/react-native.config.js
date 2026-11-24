// Fonts in assets/fonts are linked into the iOS and Android projects with
// `npx react-native-asset`. Run it again after adding or removing a font.
module.exports = {
  assets: ['./assets/fonts'],
  // Push notifications are Android only for now (M6e): iPhone push needs an Apple developer account. Keeping Firebase
  // out of the iOS build means no GoogleService-Info.plist and no pod changes until then. src/lib/push.ts never calls
  // Firebase on iOS.
  dependencies: {
    '@react-native-firebase/app': { platforms: { ios: null } },
    '@react-native-firebase/messaging': { platforms: { ios: null } },
  },
};
