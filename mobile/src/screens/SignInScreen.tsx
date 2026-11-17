// Sign In (design v2, Prompt 1). No sign-up: accounts are created by the admin.
import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../auth/AuthProvider';
import { AuthLayout } from '../components/AuthLayout';
import { Button, Notice, PasswordField, TextField, type TextFieldHandle } from '../components/ui';
import { colors, space, type } from '../theme/tokens';

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});
type Form = z.infer<typeof schema>;

export function SignInScreen() {
  const { state, signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextFieldHandle>(null);
  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  // "Your session ended…" or a no-network message from the session check at launch.
  const notice = state.status === 'signed-out' ? state.notice : undefined;

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await signIn(values.email, values.password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed.');
    }
  });

  return (
    <AuthLayout>
      <View style={styles.heading}>
        <Text style={styles.title} accessibilityRole="header">Welcome back</Text>
        <Text style={[type.body, styles.muted]}>Sign in with your work email</Text>
      </View>

      {notice && !error ? <Notice text={notice} tone="info" /> : null}

      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <TextField
            label="Email"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            placeholder="you@thefurn.in"
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

      <Text style={[type.small, styles.footer]}>Forgot your password or need an account? Ask your admin.</Text>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  heading: { gap: space.xs, marginBottom: space.xs },
  title: { ...type.title, fontSize: 26 },
  muted: { color: colors.textSecondary },
  footer: { textAlign: 'center', marginTop: 'auto', paddingTop: space.lg },
});
