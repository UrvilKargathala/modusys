// Phone push tokens (M6e): the server sends this phone your bell notifications as push.
import { api } from './client';

export function registerPushToken(token: string, platform: 'android' | 'ios') {
  return api<{ ok: true }>('/api/mobile/push-token', { method: 'POST', body: { token, platform } });
}

export function unregisterPushToken(token: string) {
  return api<{ ok: true }>('/api/mobile/push-token', { method: 'DELETE', body: { token } });
}
