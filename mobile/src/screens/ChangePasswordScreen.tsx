import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check } from 'lucide-react-native';
import { useAuth, useUser } from '../auth/AuthProvider';
import { Button, Card, Notice, Screen, TextField, Title } from '../components/ui';
import { passwordMeetsAllRequirements, passwordRequirements } from '../lib/password';
import { colors, radius, space, type } from '../theme/tokens';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().refine(passwordMeetsAllRequirements, "Password doesn't meet all requirements"),
    confirm: z.string(),
  })
  .refine(v => v.newPassword === v.confirm, { path: ['confirm'], message: "Passwords don't match" });
type Form = z.infer<typeof schema>;

/** Shown on its own (forced change) or pushed from Account (`onDone` goes back). */
export function ChangePasswordScreen({ onDone }: { onDone?: () => void }) {
  const { changePassword, signOut } = useAuth();
  const user = useUser();
  const forced = user.mustChangePassword;
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { control, handleSubmit, formState, watch } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });
  const newPassword = watch('newPassword');

  const onSubmit = handleSubmit(async values => {
    setError(null);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      setSaved(true);
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change the password.');
    }
  });

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={onDone ? ['left', 'right'] : undefined}>
        {!onDone ? (
          <Title sub={forced ? 'Your admin set a temporary password. Choose your own to continue.' : undefined}>
            Change Password
          </Title>
        ) : null}
        {error ? <Notice text={error} /> : null}
        {saved ? <Notice text="Password changed." tone="info" /> : null}

        <Card>
          <Controller
            control={control}
            name="currentPassword"
            render={({ field, fieldState }) => (
              <TextField
                label="Current password"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                secureTextEntry
                textContentType="password"
              />
            )}
          />
          <Controller
            control={control}
            name="newPassword"
            render={({ field, fieldState }) => (
              <TextField
                label="New password"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                secureTextEntry
                textContentType="newPassword"
              />
            )}
          />
          <View style={styles.rules}>
            {passwordRequirements.map(r => {
              const met = r.test(newPassword);
              return (
                <View key={r.label} style={styles.rule}>
                  <View style={[styles.tick, met && styles.tickOn]}>
                    {met ? <Check size={10} color={colors.white} strokeWidth={3} /> : null}
                  </View>
                  <Text style={[type.small, met && { color: colors.success }]}>{r.label}</Text>
                </View>
              );
            })}
          </View>
          <Controller
            control={control}
            name="confirm"
            render={({ field, fieldState }) => (
              <TextField
                label="Confirm new password"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                secureTextEntry
                textContentType="newPassword"
              />
            )}
          />
          <Button label="Change Password" onPress={onSubmit} loading={formState.isSubmitting} />
        </Card>
        {forced ? <Button label="Sign Out" variant="text" onPress={() => signOut()} /> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  rules: { gap: space.xs },
  rule: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tick: {
    width: 16,
    height: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickOn: { backgroundColor: colors.success, borderColor: colors.success },
});
