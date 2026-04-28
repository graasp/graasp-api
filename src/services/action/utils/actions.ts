import geoip, { type Lookup } from 'geoip-lite';

export const getGeolocationIp = (ip: string | number): Lookup | null =>
  geoip.lookup(ip);
