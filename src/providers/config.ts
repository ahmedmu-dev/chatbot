/** Proxy base URL. Android emulator: http://10.0.2.2:8787. Phone: the Mac's LAN IP. */
export const DEFAULT_API_URL = 'http://localhost:8787';

export function getApiUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim() || DEFAULT_API_URL;
  return url.replace(/\/+$/, '');
}

/** The proxy gives up after 60 s; the app waits a little longer so the proxy's answer wins. */
export const CLIENT_TIMEOUT_MS = 70_000;
