// Change password (design v2, Prompt 1, screen B).
// Forced (the admin set a temporary password): the signed-out header + card,
// "Set a new password", and Sign out as the only way back.
// Pushed from More (`onDone` goes back): a normal screen under the nav header.
import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Lock } from 'lucide-react-native';
import { useAuth, useUser } from '../auth/AuthProvider';
import { AuthLayout } from '../components/AuthLayout';
import { Button, Card, Notice, PasswordField, Screen, type TextFieldHandle } from '../components/ui';
import { passwordMeetsAllRequirements, passwordRequirements } from '../lib/password';
import { colors, radius, space, type } from '../theme/tokens';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().refine(passwordMeetsAllRequirements, "Password doesn't meet all requirements"),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: "Passwords don't match" });
type Form = z.infer<typeof schema>;

function Rule({ label, met }: { label: string; met: boolean }) {
  return (
    <View style={styles.rule} accessible accessibilityLabel={`${label}${met ? ', done' : ''}`}>
      <View style={[styles.tick, met && styles.tickOn]}>
        {met ? <Check size={10} color={colors.white} strokeWidth={3} /> : null}
      </View>
      <Text style={[type.small, met && styles.ruleMet]}>{label}</Text>
    </View>
  );
}

export function ChangePasswordScreen({ onDone, forcedPreview }: {
  onDone?: () => void;
  /** Development only (Style guide): show the forced layout for a signed-in user. */
  forcedPreview?: boolean;
}) {
  const { changePassword, signOut } = useAuth();
  const user = useUser();
  const forced = forcedPreview || (user.mustChangePassword && !onDone);
  const [error, setError] = useState<string | null>(null);
  // Next on the keyboard moves through the three fields; Done on the last one saves.
  const currentRef = useRef<TextFieldHandle>(null);
  const newRef = useRef<TextFieldHandle>(null);
  const confirmRef = useRef<TextFieldHandle>(null);
  const [saved, setSaved] = useState(false);
  const { control, handleSubmit, formState, watch } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });
  const newPassword = watch('newPassword');
  const confirm = watch('confirm');

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      setSaved(true);
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change the password.');
    }
  });

  const form = (
    <>
      {forced ? (
        <View style={styles.heading}>
          <Text style={styles.title} accessibilityRole="header">Set a new password</Text>
          <Text style={[type.body, styles.muted]}>
            Your admin gave you a temporary password. Choose your own to continue.
          </Text>
        </View>
      ) : null}
      {saved ? <Notice text="Password changed." tone="info" /> : null}

      <Controller
        control={control}
        name="currentPassword"
        render={({ field, fieldState }) => (
          <PasswordField
            icon={Lock}
            ref={currentRef}
            label={forced ? 'Temporary password' : 'Current password'}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            textContentType="password"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => newRef.current?.focus()}
          />
        )}
      />
      <Controller
        control={control}
        name="newPassword"
        render={({ field, fieldState }) => (
          <PasswordField
            icon={Lock}
            ref={newRef}
            label="New password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            textContentType="newPassword"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => confirmRef.current?.focus()}
          />
        )}
      />
      <Controller
        control={control}
        name="confirm"
        render={({ field, fieldState }) => (
          <PasswordField
            icon={Lock}
            ref={confirmRef}
            label="Confirm new password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={() => onSubmit()}
          />
        )}
      />

      {/* Live checklist: the web's rules, plus the match check. The server checks again. */}
      <View style={styles.rules}>
        {passwordRequirements.map((r) => (
          <Rule key={r.label} label={r.label} met={r.test(newPassword)} />
        ))}
        <Rule label="Passwords match" met={confirm.length > 0 && confirm === newPassword} />
      </View>

      {error ? <Notice text={error} /> : null}
      <Button label={forced ? 'Save and continue' : 'Change password'} onPress={onSubmit} loading={formState.isSubmitting} />
      {forced ? <Button label="Sign out" variant="text" onPress={() => signOut()} /> : null}
    </>
  );

  if (forced) return <AuthLayout>{form}</AuthLayout>;

  return (
    <KeyboardAvoidingView style={styles.fill} behavior="padding">
      <Screen edges={['left', 'right']}>
        <Card>{form}</Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  heading: { gap: space.xs, marginBottom: space.xs },
  title: { ...type.title, fontSize: 26 },
  muted: { color: colors.textSecondary },
  rules: { gap: space.sm, backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: space.md },
  rule: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  ruleMet: { color: colors.success },
  tick: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.placeholder,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickOn: { backgroundColor: colors.success, borderColor: colors.success },
});
