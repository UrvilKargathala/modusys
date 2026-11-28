// Settings → Sign-in: turn sign-in with Face ID / Touch ID / fingerprint on or off. Turning it on asks for the
// password once (checked with the server) and keeps it in the Keychain / Keystore behind the phone's biometrics.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { Lock } from 'lucide-react-native';
import { Text } from '../components/Text';
import { Button, Card, Notice, PasswordField } from '../components/ui';
import * as authApi from '../api/auth';
import { ApiError } from '../api/client';
import { type Biometry, clearBiometricLogin, getBiometry, hasBiometricLogin, saveBiometricLogin } from '../auth/biometric';
import { colors, space, type } from '../theme/tokens';

export function BiometricCard({ email }: { email: string }) {
  const [biometry, setBiometry] = useState<Biometry>(null);
  const [on, setOn] = useState(false);
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getBiometry(), hasBiometricLogin()]).then(([bio, saved]) => {
      setBiometry(bio);
      setOn(!!bio && saved);
    });
  }, []);

  if (!biometry) return null; // no Face ID / fingerprint set up on this phone

  const turnOn = async () => {
    if (!password) return setError('Enter your password');
    setBusy(true);
    setError(null);
    try {
      await authApi.signIn(email, password); // checks the password; the extra session is simply not used
      if (!(await saveBiometricLogin(email, password))) throw new Error(`Couldn't turn on ${biometry.label}. Try again.`);
      setOn(true);
      setAsking(false);
      setPassword('');
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? 'Incorrect password.' : e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const onToggle = async (next: boolean) => {
    setError(null);
    if (next) return setAsking(true);
    await clearBiometricLogin();
    setOn(false);
    setAsking(false);
  };

  const label = biometry.label;
  return (
    <Card>
      <Text style={type.heading}>Sign-in</Text>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={type.body}>Sign in with {label}</Text>
          <Text style={type.small}>Skip typing your password on this phone.</Text>
        </View>
        <Switch
          value={on || asking}
          onValueChange={onToggle}
          accessibilityLabel={`Sign in with ${label}`}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor={colors.white}
          ios_backgroundColor={colors.border}
        />
      </View>
      {asking && !on ? (
        <>
          <PasswordField label="Your password" icon={Lock} value={password} onChangeText={setPassword} onSubmitEditing={turnOn} returnKeyType="done" />
          {error ? <Notice text={error} /> : null}
          <Button label={`Turn on ${label}`} onPress={turnOn} loading={busy} />
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, gap: 2 },
});
