import { SignJWT, jwtVerify } from 'jose';

import { JWT_SECRET } from '../config/secrets.js';

export const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

export async function signAccessToken(
  payload: object,
  audience: string,
  duration: string,
): Promise<string> {
  return await new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(duration)
    .setAudience(audience)
    .sign(SECRET_KEY);
}

export async function verifyAccessToken<T extends object = any>(token: string): Promise<T> {
  const { payload } = await jwtVerify(token, SECRET_KEY, {
    algorithms: ['HS256'],
  });

  return payload as T;
}
