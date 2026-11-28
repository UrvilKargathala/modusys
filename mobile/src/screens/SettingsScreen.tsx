// Settings (every role, decided 21/11/2026): your profile. Edit your own name and email; the server allows anyone to
// edit themselves (roles stay with the super admin on the website). The email is what you sign in with.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { roles } from '@shared/constants/roles';
import { isEmail } from '@shared/customer-rules';
import { updateProfile } from '../api/auth';
import { useAuth, useUser } from '../auth/AuthProvider';
import { FormScreen } from '../components/form';
import { Avatar, Button, Card, Notice, TextField } from '../components/ui';
import { colors, radius, space, type } from '../theme/tokens';
import { BiometricCard } from './BiometricCard';
import { clearBiometricLogin } from '../auth/biometric';
import { saveLastEmail } from '../auth/lastEmail';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().min(1, 'Email is required').refine(isEmail, { message: 'Enter a valid email' }),
});
type Form = z.infer<typeof schema>;

export function SettingsScreen() {
  const user = useUser();
  const { setUser } = useAuth();
  const [saved, setSaved] = useState(false);
  const roleLabel = roles.find((r) => r.key === user.role)?.label ?? user.role;
  const { control, handleSubmit, formState, watch } = useForm<Form>({
    resolver: zodResolver(schema),
    values: { name: user.name, email: user.email },
  });
  const e = formState.errors;
  const changed = watch('name').trim() !== user.name || watch('email').trim().toLowerCase() !== user.email.toLowerCase();
  const emailChanged = watch('email').trim().toLowerCase() !== user.email.toLowerCase();

  const save = useMutation({
    mutationFn: (v: Form) => updateProfile(user.id, { name: v.name.trim(), email: v.email.trim().toLowerCase() }),
    onSuccess: async (u) => {
      if (u.email.toLowerCase() !== user.email.toLowerCase()) {
        // The saved biometric sign-in and the remembered email hold the old address.
        await clearBiometricLogin();
        await saveLastEmail(u.email);
      }
      setUser({ ...user, name: u.name, email: u.email });
      setSaved(true);
    },
  });

  return (
    <FormScreen
      footer={
        <Button
          label="Save changes"
          disabled={!changed}
          loading={save.isPending}
          onPress={handleSubmit((v) => {
            setSaved(false);
            save.mutate(v);
          })}
        />
      }
    >
      <Card style={styles.head}>
        <Avatar name={user.name} size={56} />
        <View style={styles.flex}>
          <Text style={type.heading} numberOfLines={1}>{user.name}</Text>
          <Text style={type.small} numberOfLines={1}>{user.email}</Text>
          <View style={styles.role}><Text style={styles.roleText}>{roleLabel}</Text></View>
        </View>
      </Card>
      {saved ? <Notice text="Profile saved." tone="info" /> : null}
      {save.error ? <Notice text={(save.error as Error).message} /> : null}
      <Card>
        <Text style={type.heading}>Profile</Text>
        <Controller control={control} name="name" render={({ field: f }) => (
          <TextField label="Name *" value={f.value} onChangeText={(t) => { setSaved(false); f.onChange(t); }} onBlur={f.onBlur} error={e.name?.message} autoCapitalize="words" />
        )} />
        <Controller control={control} name="email" render={({ field: f }) => (
          <TextField label="Email *" value={f.value} onChangeText={(t) => { setSaved(false); f.onChange(t); }} onBlur={f.onBlur} error={e.email?.message} keyboardType="email-address" autoCapitalize="none" />
        )} />
        {emailChanged ? <Text style={type.small}>You'll sign in with the new email from now on.</Text> : null}
        <Text style={type.small}>Your role ({roleLabel}) is set by the super admin on the website.</Text>
      </Card>
      <BiometricCard key={user.email} email={user.email} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  role: { alignSelf: 'flex-start', marginTop: space.xs, backgroundColor: colors.primaryTint, borderRadius: radius.pill, paddingHorizontal: space.sm + 2, paddingVertical: 3 },
  roleText: { ...type.small, color: colors.primary, fontWeight: '600' },
});
