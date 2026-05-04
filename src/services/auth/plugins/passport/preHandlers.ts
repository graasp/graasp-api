import { Authenticator } from '@fastify/passport';
import type { FastifyRequest, RouteGenericInterface } from 'fastify';
import type { preHandlerHookHandler } from 'fastify/types/hooks.js';
import type { RouteShorthandHook } from 'fastify/types/route.js';

import { InsufficientPermission } from '../../../../utils/errors.js';
import { PassportStrategy } from './strategies.js';

/**
 * Passport Authenticate function will accept the authenticaction if at least one of the strategies is successful.
 * So we can use multiple strategies to authenticate the user and the first one that succeeds will be used.
 *
 * All prehandlers in Fastify has to be successfull to continue the request.
 * So if we want the client to validate a captcha AND being authenticated, we have to use :
 * preHandler: [captchaPreHandler(...), authenticated]
 */
export const fastifyPassportInstance = new Authenticator();

/**
 * Validate authentication. Allows public authentication, can't fail.
 * Will set the user to `request.user.member` if possible.
 */
export const optionalIsAuthenticated = fastifyPassportInstance.authenticate(
  // PassportStrategy.MobileJwt,
  PassportStrategy.Session,
) as RouteShorthandHook<preHandlerHookHandler>;

/**
 * Validate authentication.
 * Will set the user to `request.user.member`.
 */
export const isAuthenticated = fastifyPassportInstance.authenticate(
  // PassportStrategy.MobileJwt,
  PassportStrategy.StrictSession,
) as RouteShorthandHook<preHandlerHookHandler>;

//-- Password Strategies --//
/**
 * Classic password authentication to create a session.
 */
export const authenticatePassword = fastifyPassportInstance.authenticate(
  PassportStrategy.Password,
) as RouteShorthandHook<preHandlerHookHandler>;

//-- JWT Strategies --//
/**
 * JWT authentication for password reset operation.
 */
export const authenticatePasswordReset = fastifyPassportInstance.authenticate(
  PassportStrategy.PasswordReset,
  { session: false },
) as RouteShorthandHook<preHandlerHookHandler>;

/**
 * JWT authentication for email change operation.
 */
export const authenticateEmailChange = fastifyPassportInstance.authenticate(
  PassportStrategy.EmailChange,
  {
    session: false,
  },
) as RouteShorthandHook<preHandlerHookHandler>;

/**
 * Items app authentication
 */
export const authenticateAppsJWT = fastifyPassportInstance.authenticate(PassportStrategy.AppsJwt, {
  session: false,
}) as RouteShorthandHook<preHandlerHookHandler>;

/**
 *  Items app authentication. Allows authentication without member, can fail if item is not found.
 */
export const guestAuthenticateAppsJWT = fastifyPassportInstance.authenticate(
  PassportStrategy.OptionalAppsJwt,
  {
    session: false,
  },
) as RouteShorthandHook<preHandlerHookHandler>;

/**
 * Pre-handler function that checks if the user meets at least one of the specified access preconditions.
 * @param strategies The array of role strategies to check for access.
 * @throws {InsufficientPermission} If user does not satisfy any of the preconditions.
 * @throws {GraaspAuthError} If only one role strategy is provided and it failed with a provided error.
 */
export function matchOne<R extends RouteGenericInterface>(
  ...strategies: RessourceAuthorizationStrategy<R>[]
): RouteShorthandHook<preHandlerHookHandler> {
  return async (req: FastifyRequest<R>) => {
    if (!strategies.some((strategy) => strategy.test(req))) {
      // If none of the strategies pass, throw an error.

      // If only one strategy is provided, throw that error. Otherwise, throw a generic error.
      if (strategies.length === 1 && strategies[0].error) {
        throw new strategies[0].error();
      } else {
        throw new InsufficientPermission();
      }
    }
  };
}

export type RessourceAuthorizationStrategy<
  R extends RouteGenericInterface = RouteGenericInterface,
> = {
  test: (req: FastifyRequest<R>) => boolean;
  error?: new () => Error;
};
