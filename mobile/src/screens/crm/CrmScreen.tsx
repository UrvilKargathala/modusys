// CRM tab (M5b step 5b): the website's CRM page on the phone. Title with + New customer, then Tickets (the pipeline)
// and Tasks, as the website's two CRM tabs. Opened on Tasks from Home's "Today's tasks", on Tickets otherwise.
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Plus } from 'lucide-react-native';
import { IconButton, Segmented, Title } from '../../components/ui';
import type { RootStackParamList, TabParamList } from '../../navigation/types';
import { colors, space } from '../../theme/tokens';
import { TasksPanel } from '../tasks/TasksPanel';
import { useCrmTasks } from '../tasks/taskParts';
import { TicketsPanel } from './TicketsPanel';

type CrmTab = 'tickets' | 'tasks';

export function CrmScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<TabParamList, 'Crm'>>();
  const [tab, setTab] = useState<CrmTab>(route.params?.tab ?? 'tickets');
  // Home's links set the tab each time they open CRM.
  useEffect(() => {
    if (route.params?.tab) setTab(route.params.tab);
  }, [route.params]);
  const tasks = useCrmTasks();
  const pending = useMemo(() => (tasks.data ?? []).filter((t) => !t.completed).length, [tasks.data]);

  return (
    <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
      <View style={styles.head}>
        {/* As the website: New Customer on Tickets, Create Task on Tasks. */}
        <Title
          right={
            tab === 'tickets'
              ? <IconButton icon={Plus} label="New customer" onPress={() => nav.navigate('CustomerForm')} />
              : <IconButton icon={Plus} label="Create task" onPress={() => nav.navigate('TaskForm')} />
          }
        >
          {tab === 'tickets' ? 'CRM · Tickets' : 'CRM · Tasks'}
        </Title>
        <Segmented<CrmTab>
          options={[
            { key: 'tickets', label: 'Tickets' },
            { key: 'tasks', label: pending ? `Tasks ${pending}` : 'Tasks' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>
      {tab === 'tickets' ? <TicketsPanel onOpenTasks={() => setTab('tasks')} /> : <TasksPanel />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  head: { paddingHorizontal: space.screen, paddingTop: space.lg, gap: space.md },
});
