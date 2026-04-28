import { Strategy } from 'passport-jose';

import { Authenticator } from '@fastify/passport';

import { SECRET_KEY } from '../../../../../crypto/jwt.js';
import { db } from '../../../../../drizzle/db.js';
import {
  MemberNotFound,
  UnauthorizedMember,
} from '../../../../../utils/errors.js';
import { MemberRepository } from '../../../../member/member.repository.js';
import { PassportStrategy } from '../strategies.js';
import type {
  CustomStrategyOptions,
  StrictVerifiedCallback,
} from '../types.js';

const queryParamExtractor =
  (queryParameter: string) =>
  (req: any): string | null => {
    let token = null;
    if (req && req.query) {
      token = req.query[queryParameter];
    }
    return token;
  };

export default (
  passport: Authenticator,
  memberRepository: MemberRepository,
  strategy: PassportStrategy,
  tokenQueryParameter: string,
  audience: string,
  options?: CustomStrategyOptions,
) => {
  passport.use(
    strategy,
    new Strategy(
      {
        jwtFromRequest: queryParamExtractor(tokenQueryParameter),
        withSecretOrKey: SECRET_KEY,
        audience,
      },
      async (payload, done: StrictVerifiedCallback) => {
        try {
          const { sub, emailValidation } = payload as {
            sub: string;
            emailValidation?: boolean;
          };

          const member = await memberRepository.get(db, sub!);
          if (member) {
            // Token has been validated
            return done(
              null,
              { account: member.toMaybeUser() },
              { emailValidation },
            );
          } else {
            // Authentication refused
            return done(
              options?.propagateError ? new MemberNotFound() : new UnauthorizedMember(),
              false,
            );
          }
        } catch (err) {
          // Exception occurred while fetching member
          return done(
            options?.propagateError ? (err as Error) : new UnauthorizedMember(),
            false,
          );
        }
      },
    ),
  );
};
