// Create Task (M5b step 6): the website's Create Task form on the phone. Title, description, due date, priority,
// assignee (only a super admin can give a task to someone else, as on the website) and a linked customer.
import React, { useLayoutEffect, useMemo, useState } from 'react';
import { Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { priorities } from '@shared/constants/priority';
import { listCustomers, listUsers } from '../../api/customers';
import { createTask, type TaskPriority } from '../../api/tasks';
import { useUser } from '../../auth/AuthProvider';
import { DateField, FormScreen, SelectField, TextArea, type Option } from '../../components/form';
import { Button, Card, Notice, TextField } from '../../components/ui';
import { istToday } from '../../lib/format';
import type { RootStackParamList } from '../../navigation/types';
import { type } from '../../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'TaskForm'>;

// As the website: a title is required, everything else is optional; priority starts at Normal.
const schema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string(),
  dueDate: z.string(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  assigneeId: z.string().min(1, 'Assignee is required'),
  customerId: z.string(),
});
type Form = z.infer<typeof schema>;

export function TaskFormScreen({ route, navigation }: Props) {
  const me = useUser();
  const canAssignOthers = me.role === 'super-admin';
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => navigation.setOptions({ title: 'Create task' }), [navigation]);

  const customers = useQuery({ queryKey: ['customers'], queryFn: listCustomers, staleTime: 5 * 60_000 });
  const users = useQuery({ queryKey: ['users'], queryFn: listUsers, staleTime: 5 * 60_000, enabled: canAssignOthers });

  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', description: '', dueDate: '', priority: 'normal', assigneeId: me.id, customerId: route.params?.customerId ?? '' },
  });

  const customerOptions = useMemo<Option[]>(
    () => [{ key: '', label: 'None' }, ...(customers.data ?? []).map((c) => ({ key: c.id, label: c.name, hint: [c.customerCode, c.city].filter(Boolean).join(' · ') || undefined }))],
    [customers.data],
  );
  // Active team members; you first.
  const userOptions = useMemo<Option[]>(() => {
    const active = (users.data ?? []).filter((u) => u.status !== 'inactive' && u.id !== me.id);
    return [{ key: me.id, label: `${me.name} (you)` }, ...active.map((u) => ({ key: u.id, label: u.name }))];
  }, [users.data, me.id, me.name]);

  const save = useMutation({
    mutationFn: (v: Form) =>
      createTask({
        title: v.title.trim(),
        description: v.description.trim(),
        dueDate: v.dueDate,
        priority: v.priority as TaskPriority,
        linkedCustomerId: v.customerId,
        // Everyone but a super admin makes their own tasks; the server checks it too.
        assigneeId: canAssignOthers ? v.assigneeId : me.id,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      navigation.goBack();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not create the task.'),
  });
  const e = formState.errors;

  return (
    <FormScreen footer={<Button label="Create task" onPress={handleSubmit((v) => { setError(null); save.mutate(v); })} loading={save.isPending} />}>
      {error ? <Notice text={error} /> : null}
      <Card>
        <Controller control={control} name="title" render={({ field }) => (
          <TextField label="Title *" placeholder="e.g. Call back about the kitchen design" value={field.value} onChangeText={field.onChange} error={e.title?.message} autoCapitalize="sentences" />
        )} />
        <Controller control={control} name="description" render={({ field }) => (
          <TextArea label="Description (optional)" value={field.value} onChangeText={field.onChange} autoCapitalize="sentences" />
        )} />
        <Controller control={control} name="dueDate" render={({ field }) => (
          <DateField label="Due date (optional)" value={field.value} onChange={field.onChange} min={istToday()} clearable placeholder="No due date" />
        )} />
        <Controller control={control} name="priority" render={({ field }) => (
          <SelectField label="Priority" value={field.value} options={priorities.map((p) => ({ key: p.key, label: p.label }))} onChange={field.onChange} />
        )} />
      </Card>
      <Card>
        {canAssignOthers ? (
          <Controller control={control} name="assigneeId" render={({ field }) => (
            <SelectField label="Assignee" value={field.value} options={userOptions} onChange={field.onChange} error={e.assigneeId?.message} />
          )} />
        ) : (
          <TextField label="Assignee" value={`${me.name} (you)`} editable={false} />
        )}
        <Controller control={control} name="customerId" render={({ field }) => (
          <SelectField label="Linked customer (optional)" placeholder="None" value={field.value} options={customerOptions} onChange={field.onChange} />
        )} />
        {!canAssignOthers ? <Text style={type.small}>Only a super admin can give a task to someone else.</Text> : null}
      </Card>
    </FormScreen>
  );
}
