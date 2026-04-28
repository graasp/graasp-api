import { ExtractJwt, Strategy } from 'passport-jose';

import { Authenticator } from '@fastify/passport';

import { SECRET_KEY } from '../../../../../crypto/jwt.js';
import { db } from '../../../../../drizzle/db.js';
import {
  MemberNotFound,
  UnauthorizedMember,
  buildError,
} from '../../../../../utils/errors.js';
import { MemberRepository } from '../../../../member/member.repository.js';
import { PassportStrategy } from '../strategies.js';
import type {
  CustomStrategyOptions,
  StrictVerifiedCallback,
} from '../types.js';

export default (
  passport: Authenticator,
  memberRepository: MemberRepository,
  options?: CustomStrategyOptions,
) => {
  passport.use(
    PassportStrategy.EmailChange,
    new Strategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        withSecretOrKey: SECRET_KEY,
        audience: 'change-email',
      },
      async (
        payload,

        done: StrictVerifiedCallback,
      ) => {
        try {
          const {
            uuid,
            oldEmail,
            newEmail: newEmailRaw,
          } = payload as { uuid: string; oldEmail: string; newEmail: string };
          const newEmail = newEmailRaw.toLowerCase();
          // We shouldn't fetch the member by email, so we keep track of the actual member.
          const member = await memberRepository.get(db, uuid);
          // We check the email, so we invalidate the token if the email has changed in the meantime.
          if (member && member.email === oldEmail) {
            // Token has been validated
            return done(null, {
              account: member.toMaybeUser(),
              emailChange: { newEmail },
            });
          } else {
            // Authentication refused
            return done(
              options?.propagateError
                ? new MemberNotFound({ id: uuid })
                : new UnauthorizedMember(),
              false,
            );
          }
        } catch (error: unknown) {
          // Exception occurred while fetching member
          return done(
            options?.propagateError
              ? buildError(error)
              : new UnauthorizedMember(),
            false,
          );
        }
      },
    ),
  );
};
