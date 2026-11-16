import "server-only";

const UNIFI_HOST = process.env.UNIFI_HOST!;
const UNIFI_TOKEN = process.env.UNIFI_API_TOKEN!;

interface UnifiUser {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  employee_number: string;
  status: string;
  user_email: string;
  onboard_time: number;
  nfc_cards: Array<{ token: string; card_id: string }>;
  touch_pass: { activated: boolean } | null;
}

interface UnifiUsersResponse {
  code: string;
  data: UnifiUser[];
  msg: string;
  pagination: { page_num: number; page_size: number; total: number };
}

interface DoorLogHit {
  _source: {
    actor: { id: string; display_name: string; type: string };
    event: { published: number; display_message?: string };
    target: Array<{ id: string; display_name: string; type: string }>;
    authentication?: { credential_provider: string };
  };
}

interface DoorLogsResponse {
  code: string;
  data: { hits: DoorLogHit[]; total: number };
  msg: string;
}

async function unifiRequest(path: string, options: RequestInit = {}) {
  const res = await fetch(`${UNIFI_HOST}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${UNIFI_TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`UniFi API error ${res.status}: ${text}`);
  }

  return res.json();
}

export async function fetchUnifiUsers(): Promise<UnifiUser[]> {
  const allUsers: UnifiUser[] = [];
  let page = 1;

  while (true) {
    const data: UnifiUsersResponse = await unifiRequest(
      `/api/v1/developer/users?page_num=${page}&page_size=25`
    );
    allUsers.push(...data.data);
    if (allUsers.length >= data.pagination.total) break;
    page++;
  }

  return allUsers;
}

export async function fetchDoorLogs(
  since?: number,
  until?: number,
  pageNum = 1,
  pageSize = 100
): Promise<DoorLogsResponse> {
  const body: Record<string, unknown> = { topic: "door_openings" };
  if (since) body.since = since;
  if (until) body.until = until;

  return unifiRequest(
    `/api/v1/developer/system/logs?page_num=${pageNum}&page_size=${pageSize}`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

export type { UnifiUser, DoorLogHit, DoorLogsResponse };
