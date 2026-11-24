// "Please update" (M7 Part B): shown instead of the app when it is older than the website's minimum version
// (web/public/app-version.json). The button opens the app's Google Play page.
import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { Button, EmptyState, Screen } from '../components/ui';
import { APP_VERSION_NAME } from '../config';
import { space } from '../theme/tokens';

const PACKAGE = 'com.modusys.app';

function openPlayStore() {
  // The Play Store app first; the web page if the phone can't open it.
  Linking.openURL(`market://details?id=${PACKAGE}`).catch(() =>
    Linking.openURL(`https://play.google.com/store/apps/details?id=${PACKAGE}`).catch(() => undefined),
  );
}

export function UpdateRequiredScreen({ minVersion }: { minVersion: string }) {
  return (
    <Screen scroll={false}>
      <View style={styles.body}>
        <EmptyState
          icon={RefreshCw}
          title="Please update Modusys"
          text={`This version (${APP_VERSION_NAME}) is too old to use. Install version ${minVersion} or newer from Google Play, then open the app again.`}
        />
        <Button label="Open Google Play" onPress={openPlayStore} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', gap: space.lg },
});
