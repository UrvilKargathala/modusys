// The app's navigation, for code that runs outside a screen (a tapped push notification, src/navigation/PushSetup.tsx).
import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
