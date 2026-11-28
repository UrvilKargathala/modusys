// Sign In (redesign 28/11/2026). No sign-up: accounts are created by the admin.
// Fills in the last email used; offers Face ID / fingerprint once the user has turned it on (src/auth/biometric.ts).
import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, Mail } from 'lucide-react-native';
import { useAuth } from '../auth/AuthProvider';
import { ApiError } from '../api/client';
import { loadLastEmail } from '../auth/lastEmail';
import {
  type Biometry,
  clearBiometricLogin,
  getBiometry,
  hasBiometricLogin,
  loadBiometricLogin,
  saveBiometricLogin,
} from '../auth/biometric';
import { AuthLayout } from '../components/AuthLayout';
import { Button, Notice, PasswordField, TextField, type TextFieldHandle } from '../components/ui';
import { APP_VERSION } from '../config';
import { colors, space, type } from '../theme/tokens';

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});
type Form = z.infer<typeof schema>;

/** A short, plain message for each way sign-in can fail. */
function signInError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return 'Incorrect email or password. Check both and try again.';
    if (e.status === 0) return "No internet connection. Check your Wi-Fi or mobile data and try again.";
    if (e.status === 408) return 'The server is taking too long to answer. Try again in a moment.';
    if (e.status === 429) return 'Too many tries. Wait a minute, then try again.';
    if (e.status >= 500) return 'The server had a problem. Try again in a minute.';
    return e.message;
  }
  return 'Sign in failed. Try again.';
}

export function SignInScreen() {
  const { state, signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [biometry, setBiometry] = useState<Biometry>(null);
  const [hasSaved, setHasSaved] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const passwordRef = useRef<TextFieldHandle>(null);
  const { control, handleSubmit, formState, setValue, getValues } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    let live = true;
    (async () => {
      const [email, bio, saved] = await Promise.all([loadLastEmail(), getBiometry(), hasBiometricLogin()]);
      if (!live) return;
      if (email && !getValues('email')) setValue('email', email);
      setBiometry(bio);
      setHasSaved(!!bio && saved);
    })();
    return () => {
      live = false;
    };
  }, [getValues, setValue]);

  // "Your session ended…" or a no-network message from the session check at launch.
  const notice = state.status === 'signed-out' ? state.notice : undefined;

  /** After a password sign-in on a phone with biometrics: offer to use them next time. */
  const offerBiometric = (email: string, password: string) => {
    if (!biometry || hasSaved) return;
    Alert.alert(
      `Use ${biometry.label} next time?`,
      `Sign in to Modusys with ${biometry.label} instead of typing your password.`,
      [
        { text: 'Not now', style: 'cancel' },
        { text: `Use ${biometry.label}`, onPress: () => { saveBiometricLogin(email, password); } },
      ],
    );
  };

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await signIn(values.email, values.password);
      offerBiometric(values.email.trim(), values.password);
    } catch (e) {
      setError(signInError(e));
    }
  });

  const onBiometric = async () => {
    setError(null);
    setBioBusy(true);
    try {
      const saved = await loadBiometricLogin();
      if (!saved) return; // cancelled: the password form is right there
      try {
        await signIn(saved.email, saved.password);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          // The password was changed (on the website or another phone): the saved one no longer works.
          await clearBiometricLogin();
          setHasSaved(false);
          setValue('email', saved.email);
          setError(`Your password has changed. Sign in with your new password, then turn on ${biometry?.label ?? 'biometrics'} again.`);
        } else {
          setError(signInError(e));
        }
      }
    } finally {
      setBioBusy(false);
    }
  };

  return (
    <AuthLayout>
      <View style={styles.heading}>
        <Text style={styles.title} accessibilityRole="header">Welcome back</Text>
        <Text style={[type.body, styles.muted]}>Sign in to continue to Modusys</Text>
      </View>

      {notice && !error ? <Notice text={notice} tone="info" /> : null}

      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <TextField
            label="Email"
            icon={Mail}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            placeholder="Enter your work email"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <PasswordField
            ref={passwordRef}
            label="Password"
            icon={Lock}
            placeholder="Enter your password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => onSubmit()}
          />
        )}
      />

      {error ? <Notice text={error} /> : null}
      <Button label="Sign in" onPress={onSubmit} loading={formState.isSubmitting} />
      {hasSaved && biometry ? (
        <Button label={`Sign in with ${biometry.label}`} variant="secondary" onPress={onBiometric} loading={bioBusy} />
      ) : null}

      <Text style={[type.small, styles.footer]}>Forgot your password or need an account? Ask your admin.</Text>
      <Text style={[type.small, styles.version]}>Version {APP_VERSION}</Text>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  heading: { gap: space.xs, marginBottom: space.sm },
  title: { ...type.title, fontSize: 30 },
  muted: { color: colors.textSecondary },
  footer: { textAlign: 'center', marginTop: space.sm },
  version: { textAlign: 'center', color: colors.placeholder },
});
