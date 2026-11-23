// Create Task (M5b step 6) and Edit Task (M6b): the website's task form on the phone. Title, description, due date,
// priority, assignee (only a super admin can give a task to someone else, as on the website) and a linked customer.
// Editing is for the super admin only (the server refuses others); the task comes from the CRM's task list.
import React, { useLayoutEffect, useMemo, useState } from 'react';
import { Text } from '../../components/Text';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { priorities } from '@shared/constants/priority';
import { listCustomers, listUsers } from '../../api/customers';
import { createTask, updateTask, type Task, type TaskPriority } from '../../api/tasks';
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
  const taskId = route.params?.taskId;
  // The task being edited, from any task list already loaded (All Tasks or yours).
  const editing = taskId
    ? queryClient.getQueriesData<Task[]>({ queryKey: ['tasks'] }).flatMap(([, list]) => list ?? []).find((t) => t.id === taskId)
    : undefined;
  useLayoutEffect(() => navigation.setOptions({ title: editing ? 'Edit task' : 'Create task' }), [navigation, editing]);

  const customers = useQuery({ queryKey: ['customers'], queryFn: listCustomers, staleTime: 5 * 60_000 });
  const users = useQuery({ queryKey: ['users'], queryFn: listUsers, staleTime: 5 * 60_000, enabled: canAssignOthers });

  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? {
          title: editing.title,
          description: editing.description,
          dueDate: editing.dueDate,
          priority: (['low', 'normal', 'high', 'urgent'].includes(editing.priority) ? editing.priority : 'normal') as TaskPriority,
          assigneeId: editing.assigneeId,
          customerId: editing.customerId ?? '',
        }
      : { title: '', description: '', dueDate: '', priority: 'normal', assigneeId: me.id, customerId: route.params?.customerId ?? '' },
  });

  const customerOptions = useMemo<Option[]>(
    () => [{ key: '', label: 'None' }, ...(customers.data ?? []).map((c) => ({ key: c.id, label: c.name, hint: [c.customerCode, c.city].filter(Boolean).join(' · ') || undefined }))],
    [customers.data],
  );
  // Active team members; you first.
  const userOptions = useMemo<Option[]>(() => {
    // An edited task keeps its assignee in the list even if they are no longer active.
    const active = (users.data ?? []).filter((u) => (u.status !== 'inactive' || u.id === editing?.assigneeId) && u.id !== me.id);
    return [{ key: me.id, label: `${me.name} (you)` }, ...active.map((u) => ({ key: u.id, label: u.name }))];
  }, [users.data, me.id, me.name, editing?.assigneeId]);

  const save = useMutation({
    mutationFn: (v: Form) => {
      const input = {
        title: v.title.trim(),
        description: v.description.trim(),
        dueDate: v.dueDate,
        priority: v.priority as TaskPriority,
        linkedCustomerId: v.customerId,
        // Everyone but a super admin makes their own tasks; the server checks it too.
        assigneeId: canAssignOthers ? v.assigneeId : me.id,
      };
      return editing ? updateTask(editing.id, input) : createTask(input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      navigation.goBack();
    },
    onError: (err) => setError(err instanceof Error ? err.message : editing ? 'Could not save the task.' : 'Could not create the task.'),
  });
  const e = formState.errors;

  return (
    <FormScreen footer={<Button label={editing ? 'Save changes' : 'Create task'} onPress={handleSubmit((v) => { setError(null); save.mutate(v); })} loading={save.isPending} />}>
      {error ? <Notice text={error} /> : null}
      <Card>
        <Controller control={control} name="title" render={({ field }) => (
          <TextField label="Title *" placeholder="e.g. Call back about the kitchen design" value={field.value} onChangeText={field.onChange} error={e.title?.message} autoCapitalize="sentences" />
        )} />
        <Controller control={control} name="description" render={({ field }) => (
          <TextArea label="Description (optional)" value={field.value} onChangeText={field.onChange} autoCapitalize="sentences" />
        )} />
        <Controller control={control} name="dueDate" render={({ field }) => (
          <DateField label="Due date (optional)" value={field.value} onChange={field.onChange} min={editing && editing.dueDate && editing.dueDate < istToday() ? editing.dueDate : istToday()} clearable placeholder="No due date" />
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
