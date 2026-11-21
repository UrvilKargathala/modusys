// Add / edit an architect (M6b, Architect Master): the website's Architect form fields (name, contact, address, birthday)
// with the same rules (name and surname required; Indian mobile / office numbers; numeric postcode). Partners and site
// engineers stay on the website. Delete is for the super admin (hidden, as the website's delete), with a confirm.
import React, { useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { months } from '@shared/constants/months';
import { CUSTOMER_RULE_MESSAGES, isIndianMobile, isPostcode } from '@shared/customer-rules';
import { createArchitect, deleteArchitect, listArchitects, listPlaces, updateArchitect, type Architect } from '../../api/customers';
import { useUser } from '../../auth/AuthProvider';
import { FormScreen, SelectField, type Option } from '../../components/form';
import { Button, Card, Notice, Sheet, TextField, type TextFieldHandle } from '../../components/ui';
import type { RootStackParamList } from '../../navigation/types';
import { space, type } from '../../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'ArchitectForm'>;

const schema = z.object({
  prefix: z.string(),
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  mobile: z.string().refine(isIndianMobile, { message: CUSTOMER_RULE_MESSAGES.mobile }),
  office: z.string().refine(isIndianMobile, { message: 'Enter a valid 10-digit Indian office number' }),
  company: z.string(),
  instagram: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  postcode: z.string().refine(isPostcode, { message: CUSTOMER_RULE_MESSAGES.postcode }),
  birthdayDay: z.string(),
  birthdayMonth: z.string(),
  birthdayYear: z.string(),
});
type Form = z.infer<typeof schema>;

const EMPTY: Form = {
  prefix: 'Ar', firstName: '', lastName: '', mobile: '', office: '', company: '', instagram: '', address: '', city: '', state: '',
  postcode: '', birthdayDay: '', birthdayMonth: '', birthdayYear: '',
};
const fromArchitect = (a: Architect): Form => ({
  prefix: a.prefix ?? '', firstName: a.firstName, lastName: a.lastName, mobile: a.mobile ?? '', office: a.office ?? '',
  company: a.company ?? '', instagram: a.instagram ?? '', address: a.address ?? '', city: a.city ?? '', state: a.state ?? '',
  postcode: a.postcode ?? '', birthdayDay: a.birthdayDay ?? '', birthdayMonth: a.birthdayMonth ?? '', birthdayYear: a.birthdayYear ?? '',
});

const DAYS: Option[] = Array.from({ length: 31 }, (_, i) => ({ key: String(i + 1), label: String(i + 1) }));
const MONTHS: Option[] = months.map((m) => ({ key: m, label: m }));
const thisYear = new Date().getFullYear();
const YEARS: Option[] = Array.from({ length: 70 }, (_, i) => String(thisYear - 18 - i)).map((y) => ({ key: y, label: y }));
const withCurrent = (names: string[], current: string): Option[] =>
  [...(current && !names.includes(current) ? [current] : []), ...names].map((n) => ({ key: n, label: n }));

export function ArchitectFormScreen({ route, navigation }: Props) {
  const id = route.params?.id;
  const user = useUser();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const architects = useQuery({ queryKey: ['architects'], queryFn: listArchitects });
  const places = useQuery({ queryKey: ['places'], queryFn: listPlaces, staleTime: 10 * 60_000 });
  const existing = id ? architects.data?.find((a) => a.id === id) : undefined;

  useLayoutEffect(() => navigation.setOptions({ title: id ? 'Edit architect' : 'Add architect' }), [navigation, id]);

  const { control, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema), values: existing ? fromArchitect(existing) : EMPTY });
  const lastRef = useRef<TextFieldHandle>(null);
  const e = formState.errors;

  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: ['architects'] });
    navigation.goBack();
  };
  const save = useMutation({
    mutationFn: (v: Form) => {
      const fields = { ...v, firstName: v.firstName.trim(), lastName: v.lastName.trim() };
      return id ? updateArchitect(id, fields) : createArchitect({ ...fields, createdById: user.id });
    },
    onSuccess: done,
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not save the architect.'),
  });
  const remove = useMutation({ mutationFn: () => deleteArchitect(id!), onSuccess: done });

  if (id && !existing) {
    return (
      <FormScreen footer={null}>
        {architects.error ? <Notice text={(architects.error as Error).message} /> : <Text style={type.small}>{architects.isLoading ? 'Loading…' : 'This architect was not found.'}</Text>}
      </FormScreen>
    );
  }

  const field = (name: keyof Form, label: string, extra: Partial<React.ComponentProps<typeof TextField>> = {}) => (
    <Controller control={control} name={name} render={({ field: f }) => (
      <TextField label={label} value={f.value} onChangeText={f.onChange} onBlur={f.onBlur} error={e[name]?.message} {...extra} />
    )} />
  );

  return (
    <FormScreen footer={<Button label={id ? 'Save changes' : 'Add architect'} onPress={handleSubmit((v) => { setError(null); save.mutate(v); })} loading={save.isPending} />}>
      {error ? <Notice text={error} /> : null}
      <Card>
        <Text style={type.heading}>Name</Text>
        {field('prefix', 'Prefix', { placeholder: 'e.g. Ar', autoCapitalize: 'words' })}
        {field('firstName', 'First name *', { autoCapitalize: 'words', returnKeyType: 'next', submitBehavior: 'submit', onSubmitEditing: () => lastRef.current?.focus() })}
        <Controller control={control} name="lastName" render={({ field: f }) => (
          <TextField ref={lastRef} label="Last name *" value={f.value} onChangeText={f.onChange} onBlur={f.onBlur} error={e.lastName?.message} autoCapitalize="words" />
        )} />
        {field('company', 'Company', { autoCapitalize: 'words' })}
      </Card>
      <Card>
        <Text style={type.heading}>Contact</Text>
        {field('mobile', 'Mobile', { keyboardType: 'phone-pad' })}
        {field('office', 'Office number', { keyboardType: 'phone-pad' })}
        {field('instagram', 'Instagram', { autoCapitalize: 'none' })}
      </Card>
      <Card>
        <Text style={type.heading}>Address</Text>
        {field('address', 'Address', { autoCapitalize: 'sentences' })}
        <Controller control={control} name="city" render={({ field: f }) => (
          <SelectField label="City" placeholder="Select a city" value={f.value} options={withCurrent(places.data?.cities ?? [], f.value)} onChange={f.onChange} />
        )} />
        <Controller control={control} name="state" render={({ field: f }) => (
          <SelectField label="State" placeholder="Select a state" value={f.value} options={withCurrent(places.data?.states ?? [], f.value)} onChange={f.onChange} />
        )} />
        {field('postcode', 'Postcode', { keyboardType: 'number-pad' })}
      </Card>
      <Card>
        <Text style={type.heading}>Birthday</Text>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Controller control={control} name="birthdayDay" render={({ field: f }) => (
              <SelectField label="Day" placeholder="Day" value={f.value} options={DAYS} onChange={f.onChange} />
            )} />
          </View>
          <View style={styles.flex}>
            <Controller control={control} name="birthdayMonth" render={({ field: f }) => (
              <SelectField label="Month" placeholder="Month" value={f.value} options={MONTHS} onChange={f.onChange} />
            )} />
          </View>
        </View>
        <Controller control={control} name="birthdayYear" render={({ field: f }) => (
          <SelectField label="Year" placeholder="Year" value={f.value} options={YEARS} onChange={f.onChange} />
        )} />
        <Text style={type.small}>Partners and site engineers are edited on the website.</Text>
      </Card>
      {id && user.role === 'super-admin' ? <Button label="Delete architect" variant="text" onPress={() => setAsking(true)} /> : null}

      <Sheet visible={asking} onClose={() => setAsking(false)}>
        <View style={styles.confirm}>
          <Text style={type.heading}>Delete this architect?</Text>
          <Text style={type.body}>They disappear from the website and the app for everyone. Customers keep their other details.</Text>
          {remove.error ? <Notice text={(remove.error as Error).message} /> : null}
          <View style={styles.row}>
            <View style={styles.flex}><Button label="Cancel" variant="secondary" onPress={() => setAsking(false)} /></View>
            <View style={styles.flex}><Button label="Delete" variant="danger" onPress={() => remove.mutate()} loading={remove.isPending} /></View>
          </View>
        </View>
      </Sheet>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: space.md },
  confirm: { gap: space.md, paddingHorizontal: space.screen, paddingBottom: space.lg },
});
