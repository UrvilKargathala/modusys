const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// The app lives in mobile/ inside the modusys repo. It may also use plain code
// from ../shared (status map, types) through the "@shared/..." import path.
// Packages always come from mobile/node_modules: Metro only reads files inside
// this folder and shared/, never the web app's node_modules at the repo root.
const sharedDir = path.resolve(__dirname, '../shared');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [sharedDir],
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName.startsWith('@shared/')) {
        return context.resolveRequest(context, path.join(sharedDir, moduleName.slice('@shared/'.length)), platform);
      }
      // A package needed by a shared/ file (e.g. a Babel helper) is looked up
      // from mobile/, not from the repo root where the web app's packages live.
      const isPackage = !moduleName.startsWith('.') && !path.isAbsolute(moduleName);
      if (isPackage && context.originModulePath.startsWith(sharedDir + path.sep)) {
        return context.resolveRequest({ ...context, originModulePath: path.join(__dirname, 'index.js') }, moduleName, platform);
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
