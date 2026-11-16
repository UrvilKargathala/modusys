import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../auth/AuthProvider';
import { Button, Card, Notice, Screen, TextField, type TextFieldHandle } from '../components/ui';
import { colors, radius, space, type } from '../theme/tokens';

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

  const notice = state.status === 'signed-out' ? state.notice : undefined;

  const onSubmit = handleSubmit(async values => {
    setError(null);
    try {
      await signIn(values.email, values.password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed.');
    }
  });

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>M</Text>
          </View>
          <Text style={type.title} accessibilityRole="header">Modusys</Text>
          <Text style={[type.body, styles.sub]}>Sign in to your account</Text>
        </View>

        {notice && !error ? <Notice text={notice} tone="info" /> : null}
        {error ? <Notice text={error} /> : null}

        <Card>
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
                placeholder="you@company.com"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="username"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <TextField
                ref={passwordRef}
                label="Password"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                secureTextEntry
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => onSubmit()}
              />
            )}
          />
          <Button label="Sign In" onPress={onSubmit} loading={formState.isSubmitting} />
        </Card>
        <Text style={[type.small, styles.center]}>Forgot your password? Ask your admin to reset it.</Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  brand: { alignItems: 'center', gap: space.xs, marginTop: space.xxl, marginBottom: space.sm },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  logoText: { color: colors.white, fontSize: 30, fontWeight: '700' },
  sub: { color: colors.textSecondary },
  center: { textAlign: 'center' },
});
