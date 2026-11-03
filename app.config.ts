import type { ConfigContext, ExpoConfig } from 'expo/config';

const DEFAULT_API_URL = 'http://localhost:8787';

/** True when the proxy URL is plain http (the v1 local proxy), so cleartext must be allowed. */
export function usesCleartext(apiUrl: string | undefined): boolean {
  return (apiUrl?.trim() || DEFAULT_API_URL).toLowerCase().startsWith('http://');
}

/**
 * Extends app.json. Cleartext is only enabled when EXPO_PUBLIC_API_URL is http://
 * (the env var must be set when the native app is built); https keeps it off.
 */
export default function config({ config: base }: ConfigContext): ExpoConfig {
  const cleartext = usesCleartext(process.env.EXPO_PUBLIC_API_URL);
  return {
    ...(base as ExpoConfig),
    ios: {
      ...base.ios,
      infoPlist: {
        ...base.ios?.infoPlist,
        // Local/LAN hosts only; not NSAllowsArbitraryLoads.
        NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
      },
    },
    plugins: [
      ...(base.plugins ?? []),
      ['expo-build-properties', { android: { usesCleartextTraffic: cleartext } }],
    ],
  };
}
