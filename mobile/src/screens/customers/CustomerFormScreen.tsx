// Add or edit a customer: the website's Customer form on the phone (M5b steps 3 and 4).
// Same fields, same rules (shared/customer-rules.ts), same customer code; saved through /api/customers.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Controller, useForm, useWatch, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CUSTOMER_RULE_MESSAGES, isEmail, isIndianMobile, isPostcode } from '@shared/customer-rules';
import { customerCodeFrom } from '@shared/purchase-order';
import { fullName } from '@shared/mock/architects';
import { months } from '@shared/constants/months';
import { createCustomer, getCustomer, listArchitects, listPlaces, updateCustomer, type Customer, type CustomerInput } from '../../api/customers';
import { useUser } from '../../auth/AuthProvider';
import { FormScreen, SelectField, type Option } from '../../components/form';
import { ArchitectQuickAdd } from './ArchitectQuickAdd';
import { Button, Card, Notice, TextField, type TextFieldHandle } from '../../components/ui';
import type { RootStackParamList } from '../../navigation/types';
import { space, type } from '../../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerForm'>;

const schema = z.object({
  prefix: z.string(),
  firstName: z.string().trim().min(1, CUSTOMER_RULE_MESSAGES.name),
  lastName: z.string(),
  mobile: z.string().refine(isIndianMobile, { message: CUSTOMER_RULE_MESSAGES.mobile }),
  email: z.string().trim().refine(isEmail, { message: CUSTOMER_RULE_MESSAGES.email }),
  gst: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  postcode: z.string().refine(isPostcode, { message: CUSTOMER_RULE_MESSAGES.postcode }),
  birthdayDay: z.string(),
  birthdayMonth: z.string(),
  birthdayYear: z.string(),
  architectId: z.string(),
});
type Form = z.infer<typeof schema>;

const EMPTY: Form = {
  prefix: '', firstName: '', lastName: '', mobile: '', email: '', gst: '', address: '', city: '', state: '', postcode: '',
  birthdayDay: '', birthdayMonth: '', birthdayYear: '', architectId: '',
};
const fromCustomer = (c: Customer): Form => ({
  prefix: c.prefix, firstName: c.firstName, lastName: c.lastName, mobile: c.mobile, email: c.email, gst: c.gst,
  address: c.address, city: c.city, state: c.state, postcode: c.postcode, birthdayDay: c.birthdayDay,
  birthdayMonth: c.birthdayMonth, birthdayYear: c.birthdayYear, architectId: c.architectId ?? '',
});

// As the website: days 1-31, the 12 months by name, and years from 18 to 87 years ago.
const DAYS: Option[] = Array.from({ length: 31 }, (_, i) => ({ key: String(i + 1), label: String(i + 1) }));
const MONTHS: Option[] = months.map((m) => ({ key: m, label: m }));
const thisYear = new Date().getFullYear();
const YEARS: Option[] = Array.from({ length: 70 }, (_, i) => String(thisYear - 18 - i)).map((y) => ({ key: y, label: y }));

/** The row that keeps a name not in the list (saved on this customer only, not added to the website's list). */
const keepTypedLabel = (typed: string) => (typed ? `Use "${typed}"` : 'Type a name in Search to use one not listed');

/** A list that also keeps the current value when it isn't in the list (e.g. a city typed before). */
const withCurrent = (names: string[], current: string): Option[] =>
  [...(current && !names.includes(current) ? [current] : []), ...names].map((n) => ({ key: n, label: n }));

/**
 * The customer code as you type the name. Only this line follows the name fields, so typing doesn't redraw the whole
 * form (a full redraw on every key made fast typing drop letters).
 */
function CodePreview({ control, editing }: { control: Control<Form>; editing: boolean }) {
  const [first, last] = useWatch({ control, name: ['firstName', 'lastName'] });
  return (
    <Text style={type.small}>
      Customer code: {customerCodeFrom(first, last) || '—'}{editing ? '' : ' (the SR No is added on save)'}
    </Text>
  );
}

export function CustomerFormScreen({ route, navigation }: Props) {
  const id = route.params?.id;
  const editing = !!id;
  const user = useUser();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  // Quick-add architect: opened from the Architect list's "Add new architect" row with whatever was typed in its search.
  const [newArchitect, setNewArchitect] = useState<string | null>(null);

  useLayoutEffect(() => navigation.setOptions({ title: editing ? 'Edit customer' : 'Add customer' }), [navigation, editing]);

  const existing = useQuery({ queryKey: ['customer', id], queryFn: () => getCustomer(id!), enabled: editing });
  const architects = useQuery({ queryKey: ['architects'], queryFn: listArchitects, staleTime: 5 * 60_000 });
  const places = useQuery({ queryKey: ['places'], queryFn: listPlaces, staleTime: 10 * 60_000 });

  const { control, handleSubmit, reset, setValue, formState } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  // Fill the form once the customer being edited has loaded.
  const filled = useRef(false);
  useEffect(() => {
    if (existing.data && !filled.current) {
      filled.current = true;
      reset(fromCustomer(existing.data));
    }
  }, [existing.data, reset]);

  const architectOptions = useMemo<Option[]>(
    () => (architects.data ?? []).map((a) => ({ key: a.id, label: fullName(a), hint: a.company || undefined })),
    [architects.data],
  );

  const save = useMutation({
    mutationFn: (v: Form) => {
      const input: CustomerInput = { ...v, firstName: v.firstName.trim(), lastName: v.lastName.trim(), email: v.email.trim(), customerCode: customerCodeFrom(v.firstName, v.lastName) };
      return editing ? updateCustomer(id!, input) : createCustomer({ ...input, createdById: user.id });
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData(['customer', saved.id], saved);
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      // A new customer opens straight away; an edit goes back to the customer it came from.
      if (editing) navigation.goBack();
      else navigation.replace('CustomerDetail', { id: saved.id, name: saved.name });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not save the customer.'),
  });
  const submit = handleSubmit((v) => {
    setError(null);
    save.mutate(v);
  });

  const surnameRef = useRef<TextFieldHandle>(null);
  const mobileRef = useRef<TextFieldHandle>(null);
  const emailRef = useRef<TextFieldHandle>(null);
  const e = formState.errors;

  if (editing && existing.isLoading) {
    return (
      <FormScreen footer={<Button label="Save changes" onPress={() => undefined} disabled />}>
        <Text style={type.body}>Loading…</Text>
      </FormScreen>
    );
  }

  return (
    <FormScreen footer={<Button label={editing ? 'Save changes' : 'Add customer'} onPress={submit} loading={save.isPending} />}>
      {error ? <Notice text={error} /> : null}
      {existing.error ? <Notice text={(existing.error as Error).message} /> : null}

      <Card>
        <Text style={type.heading}>Name</Text>
        <Controller control={control} name="prefix" render={({ field }) => (
          <TextField label="Prefix" placeholder="e.g. Mr" value={field.value} onChangeText={field.onChange} autoCapitalize="words" returnKeyType="next" />
        )} />
        <Controller control={control} name="firstName" render={({ field }) => (
          <TextField label="Name *" placeholder="Rahul" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={e.firstName?.message}
            autoCapitalize="words" returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => surnameRef.current?.focus()} />
        )} />
        <Controller control={control} name="lastName" render={({ field }) => (
          <TextField ref={surnameRef} label="Surname" placeholder="Verma" value={field.value} onChangeText={field.onChange}
            autoCapitalize="words" returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => mobileRef.current?.focus()} />
        )} />
        <CodePreview control={control} editing={editing} />
      </Card>

      <Card>
        <Text style={type.heading}>Contact</Text>
        <Controller control={control} name="mobile" render={({ field }) => (
          <TextField ref={mobileRef} label="Mobile number" placeholder="+91 98765 43210" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur}
            error={e.mobile?.message} keyboardType="phone-pad" returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => emailRef.current?.focus()} />
        )} />
        <Controller control={control} name="email" render={({ field }) => (
          <TextField ref={emailRef} label="Email" placeholder="name@email.com" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur}
            error={e.email?.message} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        )} />
        <Controller control={control} name="architectId" render={({ field }) => (
          <SelectField label="Architect" placeholder={architects.isLoading ? 'Loading…' : 'Select an architect'} value={field.value}
            options={architectOptions} onChange={field.onChange} addLabel="Add new architect" onAdd={(typed) => setNewArchitect(typed)} />
        )} />
        <Controller control={control} name="gst" render={({ field }) => (
          <TextField label="GST No" placeholder="22AAAAA0000A1Z5" value={field.value} onChangeText={field.onChange} autoCapitalize="characters" autoCorrect={false} />
        )} />
      </Card>

      <Card>
        <Text style={type.heading}>Address</Text>
        <Controller control={control} name="address" render={({ field }) => (
          <TextField label="Address" placeholder="Street, area" value={field.value} onChangeText={field.onChange} />
        )} />
        <Controller control={control} name="city" render={({ field }) => (
          <SelectField label="City" placeholder="Select a city" value={field.value} options={withCurrent(places.data?.cities ?? [], field.value)}
            onChange={field.onChange} addLabel={keepTypedLabel} onAdd={(typed) => typed && field.onChange(typed)} />
        )} />
        <Controller control={control} name="state" render={({ field }) => (
          <SelectField label="State" placeholder="Select a state" value={field.value} options={withCurrent(places.data?.states ?? [], field.value)}
            onChange={field.onChange} addLabel={keepTypedLabel} onAdd={(typed) => typed && field.onChange(typed)} />
        )} />
        <Controller control={control} name="postcode" render={({ field }) => (
          <TextField label="Postcode" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={e.postcode?.message} keyboardType="number-pad" />
        )} />
      </Card>

      <Card>
        <Text style={type.heading}>Birthday</Text>
        <View style={styles.row}>
          <View style={styles.day}>
            <Controller control={control} name="birthdayDay" render={({ field }) => (
              <SelectField label="Day" placeholder="Day" value={field.value} options={DAYS} onChange={field.onChange} />
            )} />
          </View>
          <View style={styles.month}>
            <Controller control={control} name="birthdayMonth" render={({ field }) => (
              <SelectField label="Month" placeholder="Month" value={field.value} options={MONTHS} onChange={field.onChange} />
            )} />
          </View>
        </View>
        <Controller control={control} name="birthdayYear" render={({ field }) => (
          <SelectField label="Year" placeholder="Year" value={field.value} options={YEARS} onChange={field.onChange} />
        )} />
      </Card>
      <ArchitectQuickAdd
        visible={newArchitect !== null}
        typed={newArchitect ?? ''}
        onClose={() => setNewArchitect(null)}
        onAdded={(a) => setValue('architectId', a.id, { shouldDirty: true })}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  day: { flex: 2 },
  month: { flex: 3 },
});
