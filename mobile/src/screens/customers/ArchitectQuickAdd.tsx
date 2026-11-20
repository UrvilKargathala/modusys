// Quick-add an architect from the customer form (M5b step 5): the website's required fields only (name and surname),
// plus mobile and company. The full architect record (partners, site engineers, office...) stays on the website.
import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CUSTOMER_RULE_MESSAGES, isIndianMobile } from '@shared/customer-rules';
import { createArchitect, type Architect } from '../../api/customers';
import { useUser } from '../../auth/AuthProvider';
import { Button, Notice, Sheet, TextField, type TextFieldHandle } from '../../components/ui';
import { space, type } from '../../theme/tokens';

// As the website's Architect form: first and last name are required.
const schema = z.object({
  prefix: z.string(),
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  mobile: z.string().refine(isIndianMobile, { message: CUSTOMER_RULE_MESSAGES.mobile }),
  company: z.string(),
});
type Form = z.infer<typeof schema>;

/** `typed` is what was in the architect search box; it starts the name. `onAdded` gets the new architect. */
export function ArchitectQuickAdd({ visible, typed, onClose, onAdded }: {
  visible: boolean;
  typed: string;
  onClose: () => void;
  onAdded: (architect: Architect) => void;
}) {
  const user = useUser();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [first, ...rest] = typed.trim().split(/\s+/);
  const { control, handleSubmit, reset, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    values: { prefix: 'Ar', firstName: first ?? '', lastName: rest.join(' '), mobile: '', company: '' },
  });
  const close = () => {
    setError(null);
    reset();
    onClose();
  };
  const save = useMutation({
    mutationFn: (v: Form) => createArchitect({ ...v, firstName: v.firstName.trim(), lastName: v.lastName.trim(), createdById: user.id }),
    onSuccess: async (architect) => {
      await queryClient.invalidateQueries({ queryKey: ['architects'] });
      onAdded(architect);
      close();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not add the architect.'),
  });
  const lastRef = useRef<TextFieldHandle>(null);
  const mobileRef = useRef<TextFieldHandle>(null);
  const e = formState.errors;

  return (
    <Sheet visible={visible} onClose={close}>
      {/* Scrolls when the keyboard is open, so Add architect can always be reached. */}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        <Text style={type.heading} accessibilityRole="header">Add new architect</Text>
        <Text style={type.small}>Partners, site engineers and the office details can be added on the website.</Text>
        {error ? <Notice text={error} /> : null}
        <View style={styles.row}>
          <View style={styles.prefix}>
            <Controller control={control} name="prefix" render={({ field }) => (
              <TextField label="Prefix" value={field.value} onChangeText={field.onChange} autoCapitalize="words" />
            )} />
          </View>
          <View style={styles.flex}>
            <Controller control={control} name="firstName" render={({ field }) => (
              <TextField label="Name *" value={field.value} onChangeText={field.onChange} error={e.firstName?.message} autoCapitalize="words"
                returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => lastRef.current?.focus()} />
            )} />
          </View>
        </View>
        <Controller control={control} name="lastName" render={({ field }) => (
          <TextField ref={lastRef} label="Surname *" value={field.value} onChangeText={field.onChange} error={e.lastName?.message} autoCapitalize="words"
            returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => mobileRef.current?.focus()} />
        )} />
        <Controller control={control} name="mobile" render={({ field }) => (
          <TextField ref={mobileRef} label="Mobile number" placeholder="+91 98765 43210" value={field.value} onChangeText={field.onChange} error={e.mobile?.message} keyboardType="phone-pad" />
        )} />
        <Controller control={control} name="company" render={({ field }) => (
          <TextField label="Company" placeholder="Firm name" value={field.value} onChangeText={field.onChange} autoCapitalize="words" />
        )} />
        <Button label="Add architect" onPress={handleSubmit((v) => { setError(null); save.mutate(v); })} loading={save.isPending} />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.screen, paddingBottom: space.lg, gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
  prefix: { width: 88 },
  flex: { flex: 1 },
});
