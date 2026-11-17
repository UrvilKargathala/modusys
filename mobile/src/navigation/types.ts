export type RootStackParamList = {
  Tabs: undefined;
  ChangePassword: undefined;
  CheckFlow: { side: 'checkIn' | 'checkOut' };
  Notifications: undefined;
  /** `name` titles the screen before the customer loads. */
  CustomerDetail: { id: string; name: string };
  Dashboard: undefined;
  Quotes: undefined;
  PurchaseOrders: undefined;
  /** Development builds only: every shared component in the v2 style. */
  StyleGuide: undefined;
  /** Development only: the signed-out screens, opened while signed in. */
  SignInPreview: undefined;
  ForcedPasswordPreview: undefined;
};

export type TabParamList = {
  Home: undefined;
  Attendance: undefined;
  Customers: undefined;
  Tasks: undefined;
  More: undefined;
};
