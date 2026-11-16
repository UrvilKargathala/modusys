const USE_MOCKS = true;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (USE_MOCKS) {
    throw new Error(
      `api.${path}: no backend wired up yet — use mock data in the feature module instead`
    );
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
};
