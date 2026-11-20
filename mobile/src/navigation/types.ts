export type RootStackParamList = {
  Tabs: undefined;
  ChangePassword: undefined;
  CheckFlow: { side: 'checkIn' | 'checkOut' };
  Notifications: undefined;
  /** `name` titles the screen before the customer loads. */
  CustomerDetail: { id: string; name: string };
  /** Add a customer (no id) or edit one. */
  CustomerForm: { id?: string } | undefined;
  /** Create a task; `customerId` links it to that customer (opened from the customer's page). */
  TaskForm: { customerId?: string } | undefined;
  /** My Leaves, Apply for leave, and Leave Approvals (super admin). */
  Leaves: undefined;
  LeaveApply: undefined;
  LeaveApprovals: undefined;
  Dashboard: undefined;
  /** Development builds only: every shared component in the v2 style. */
  StyleGuide: undefined;
  /** Development only: the signed-out screens, opened while signed in. */
  SignInPreview: undefined;
  ForcedPasswordPreview: undefined;
};

export type TabParamList = {
  Home: undefined;
  Attendance: undefined;
  /** CRM (the website's CRM page): Tickets (the pipeline) or Tasks. */
  Crm: { tab?: 'tickets' | 'tasks' } | undefined;
  More: undefined;
};
