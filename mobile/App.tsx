/**
 * Modusys mobile app. Providers: safe area, server data (TanStack Query),
 * sign-in state, navigation.
 *
 * @format
 */
import React from 'react';
import { AppState, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { ApiError } from './src/api/client';
import { AuthProvider } from './src/auth/AuthProvider';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/ref';
import { colors } from './src/theme/tokens';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retry network blips, not "signed out" / "no access" answers.
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
});

// Coming back to the app counts as "focus", so data older than staleTime
// (tasks, customers, stages) reloads instead of waiting for a pull-to-refresh.
focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener('change', (state) => setFocused(state === 'active'));
  return () => sub.remove();
});

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: colors.primary, background: colors.background, card: colors.card, text: colors.text, border: colors.border },
};

function App() {
  return (
    <GestureHandlerRootView style={rootStyle}>
      <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NavigationContainer ref={navigationRef} theme={navTheme}>
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const rootStyle = { flex: 1 };

export default App;
