export type RootStackParamList = {
  Tabs: undefined;
  ChangePassword: undefined;
  /** Settings (every role): your profile. */
  Settings: undefined;
  CheckFlow: { side: 'checkIn' | 'checkOut' };
  Notifications: undefined;
  /** The website's Ctrl/Cmd+K search: customers, architects, quotes. */
  Search: undefined;
  /** `name` titles the screen before the customer loads. */
  CustomerDetail: { id: string; name: string };
  /** Add a customer (no id) or edit one. */
  CustomerForm: { id?: string } | undefined;
  /** Create a task (`customerId` links it to that customer, opened from the customer's page), or edit one (`taskId`, super admin). */
  TaskForm: { customerId?: string; taskId?: string } | undefined;
  /** My Leaves, Apply for leave, and Leave Approvals (super admin). */
  Leaves: undefined;
  LeaveApply: undefined;
  LeaveApprovals: undefined;
  Dashboard: undefined;
  /** Architect Master: the list, and add (no id) / edit an architect. */
  /** Attendance calendar (super admin): one employee's month; opened from Team. */
  AttendanceCalendar: { employeeId?: string; name?: string } | undefined;
  /** More > Payroll (super admin): Salary per month, Employees and holidays. */
  Salary: undefined;
  Employees: undefined;
  EmployeeForm: { id?: string } | undefined;
  Architects: undefined;
  ArchitectForm: { id?: string } | undefined;
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
