import { fastifySecureSession } from '@fastify/secure-session';
import type {
  FastifyInstance,
  FastifyPluginAsync,
  PassportUser,
} from 'fastify';

import { PROD, STAGING } from '../../../../config/env.js';
import {
  JWT_SECRET,
  MAX_SECURE_SESSION_EXPIRATION_IN_SECONDS,
  SECURE_SESSION_EXPIRATION_IN_SECONDS,
  SECURE_SESSION_SECRET_KEY,
} from '../../../../config/secrets.js';
import { resolveDependency } from '../../../../di/utils.js';
import { db } from '../../../../drizzle/db.js';
import { assertIsDefined } from '../../../../utils/assertions.js';
import { COOKIE_DOMAIN } from '../../../../utils/config.js';
import { AccountRepository } from '../../../account/account.repository.js';
import { ItemRepository } from '../../../item/item.repository.js';
import { MemberRepository } from '../../../member/member.repository.js';
import { MemberPasswordService } from '../password/password.service.js';
import { SHORT_TOKEN_PARAM } from './constants.js';
import { fastifyPassportInstance } from './preHandlers.js';
import { PassportStrategy } from './strategies.js';
import emailChangeStrategy from './strategies/emailChange.js';
import jwtAppsStrategy from './strategies/jwtApps.js';
import jwtChallengeVerifierStrategy from './strategies/jwtChallengeVerifier.js';
import magicLinkStrategy from './strategies/magicLink.js';
import passwordStrategy from './strategies/password.js';
import passwordResetStrategy from './strategies/passwordReset.js';
import strictSessionStrategy from './strategies/strictSession.js';

// This plugin needs to be globally register before using the prehandlers.
export const plugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const memberPasswordService = resolveDependency(MemberPasswordService);
  const memberRepository = resolveDependency(MemberRepository);
  const accountRepository = resolveDependency(AccountRepository);
  const itemRepository = resolveDependency(ItemRepository);

  // Mandatory registration for @fastify/passport
  await fastify
    .register(fastifySecureSession, {
      key: Buffer.from(SECURE_SESSION_SECRET_KEY, 'hex'),
      cookie: {
        domain: COOKIE_DOMAIN,
        path: '/',
        secure: PROD || STAGING,
        httpOnly: true,
        // Timeout before the session is invalidated. The user can renew the session since the timeout is not reached.
        // The session will be automatically renewed on each request.
        maxAge: SECURE_SESSION_EXPIRATION_IN_SECONDS,
      },
      // Max timeout for the session. After this time, the session is invalidated and cannot be renewed.
      // The user must re-authenticate.
      expiry: MAX_SECURE_SESSION_EXPIRATION_IN_SECONDS,
    })
    .register(fastifyPassportInstance.initialize())
    .register(fastifyPassportInstance.secureSession());

  //-- Sessions Strategies --//
  strictSessionStrategy(fastifyPassportInstance);

  //-- Password Strategies --//
  passwordStrategy(fastifyPassportInstance, memberPasswordService, {
    propagateError: true,
  });

  magicLinkStrategy(
    fastifyPassportInstance,
    memberRepository,
    PassportStrategy.WebMagicLink,
    SHORT_TOKEN_PARAM,
    JWT_SECRET,
    { propagateError: true },
  );

  //-- JWT Strategies --//
  passwordResetStrategy(fastifyPassportInstance, memberPasswordService);
  emailChangeStrategy(fastifyPassportInstance, memberRepository);
  jwtChallengeVerifierStrategy(fastifyPassportInstance, accountRepository, {
    propagateError: true,
  });

  jwtAppsStrategy(
    fastifyPassportInstance,
    accountRepository,
    itemRepository,
    PassportStrategy.AppsJwt,
    true,
  );
  jwtAppsStrategy(
    fastifyPassportInstance,
    accountRepository,
    itemRepository,
    PassportStrategy.OptionalAppsJwt,
    false,
  );

  // Serialize and Deserialize user
  fastifyPassportInstance.registerUserSerializer(
    async (user: PassportUser, _req) => {
      assertIsDefined(user.account);
      return user.account.id;
    },
  );
  fastifyPassportInstance.registerUserDeserializer(
    async (uuid: string, _req): Promise<PassportUser> => {
      const account = await accountRepository.get(db, uuid);

      return { account: account.toMaybeUser() };
    },
  );
};
