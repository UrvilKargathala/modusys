/**
 * @format
 */

import 'react-native-gesture-handler'; // must load first (swipe-to-complete on tasks)
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { setBackgroundHandler } from './src/lib/push';

// Push notifications in the background are shown by Android (M6e); registering a handler keeps Firebase quiet.
setBackgroundHandler();

AppRegistry.registerComponent(appName, () => App);
