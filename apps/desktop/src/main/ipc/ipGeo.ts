import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import type { IpGeoInfo } from '../../shared/apiTypes';

// Uses geojs.io's free JSON endpoint (no API key, no rate-limit signup) to
// resolve the machine's public IP and country — same "no setup required"
// tradeoff as the translate handler; treat failures as recoverable.
async function lookupIpGeo(): Promise<IpGeoInfo> {
  const response = await fetch('https://get.geojs.io/v1/ip/geo.json');
  if (!response.ok) {
    throw new Error(`IP lookup failed with status ${response.status}`);
  }

  const data: unknown = await response.json();
  if (typeof data !== 'object' || data === null) {
    throw new Error('Unexpected IP lookup response shape.');
  }

  const record = data as Record<string, unknown>;
  return {
    ip: typeof record.ip === 'string' ? record.ip : '',
    country: typeof record.country === 'string' ? record.country : 'Unknown',
    countryCode: typeof record.country_code === 'string' ? record.country_code : '',
  };
}

export function registerIpGeoHandlers(): void {
  ipcMain.handle(IPC.ipGeo.lookup, (): Promise<IpGeoInfo> => lookupIpGeo());
}
