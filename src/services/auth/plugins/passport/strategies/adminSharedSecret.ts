import { Strategy } from 'passport-custom';

import { Authenticator } from '@fastify/passport';

import { ADMIN_SHARED_SECRET } from '../../../../../utils/config';
import { UnauthorizedMember } from '../../../../../utils/errors';
import { PassportStrategy } from '../strategies';
import type { StrictVerifiedCallback } from '../types';

export default (passport: Authenticator) => {
  passport.use(
    PassportStrategy.AdminSharedSecret,
    new Strategy((req, done: StrictVerifiedCallback) => {
      const authHeader = req.headers.authorization;
      if (ADMIN_SHARED_SECRET && authHeader === `Bearer ${ADMIN_SHARED_SECRET}`) {
        return done(null, {});
      }
      return done(new UnauthorizedMember(), false);
    }),
  );
};
