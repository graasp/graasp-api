import { StatusCodes } from 'http-status-codes';

import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils.js';
import { db } from '../../../../drizzle/db.js';
import { asDefined } from '../../../../utils/assertions.js';
import {
  isAuthenticated,
  matchOne,
  optionalIsAuthenticated,
} from '../../../auth/plugins/passport/preHandlers.js';
import { assertIsMember } from '../../../authentication.js';
import { AuthorizedItemService } from '../../../authorizedItem.service.js';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole.js';
import { WrongItemTypeError } from '../../errors.js';
import { isPageItem } from '../../item.js';
import { ItemService } from '../../item.service.js';
import { createPage, pageWebsocketsSchema } from './page.schemas.js';
import { PageItemService } from './page.service.js';
import {
  setupWSConnectionForRead,
  setupWSConnectionForWriters,
} from './setupWSConnection.js';

export const pageItemPlugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const itemService = resolveDependency(ItemService);
  const pageItemService = resolveDependency(PageItemService);
  const authorizedItemService = resolveDependency(AuthorizedItemService);

  // register post copy handler to copy the updates for page
  itemService.hooks.setPostHook(
    'copy',
    async (_actor, thisDb, { original: item, copy }) => {
      if (isPageItem(item)) {
        await pageItemService.copy(thisDb, item.id, copy.id);
      }
    },
  );

  fastify.post(
    '/pages',
    {
      schema: createPage,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request, reply) => {
      const {
        user,
        query: { parentId, previousItemId },
        body: data,
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);

      const item = await db.transaction(async (tx) => {
        return await pageItemService.create(tx, member, {
          item: data,
          previousItemId,
          parentId,
          geolocation: data.geolocation,
        });
      });

      reply.code(StatusCodes.CREATED);
      reply.send(item);
    },
  );

  fastify.get(
    '/pages/:id/ws/read',
    {
      websocket: true,
      schema: pageWebsocketsSchema,
      preHandler: [
        optionalIsAuthenticated,
        async ({ user, params }) => {
          // check access to item
          const item = await authorizedItemService.getItemById(db, {
            itemId: params.id,
            accountId: user?.account?.id,
          });
          // item should be a page
          if (item.type !== 'page') {
            throw new WrongItemTypeError(item.type);
          }
        },
      ],
    },
    async (client, req) => {
      client.on('error', fastify.log.error);
      setupWSConnectionForRead(
        client,
        req.params.id,
        pageItemService,
        fastify.log,
      );
    },
  );

  fastify.get(
    '/pages/:id/ws',
    {
      websocket: true,
      schema: pageWebsocketsSchema,
      preHandler: [
        isAuthenticated,
        matchOne(validatedMemberAccountRole),
        async ({ user, params }) => {
          const account = asDefined(user?.account);
          // check write permission
          const item = await authorizedItemService.getItemById(db, {
            permission: 'write',
            itemId: params.id,
            accountId: account.id,
          });

          // item should be a page
          if (item.type !== 'page') {
            throw new WrongItemTypeError(item.type);
          }
        },
      ],
    },
    async (client, req) => {
      client.on('error', fastify.log.error);
      setupWSConnectionForWriters(
        client,
        req.params.id,
        pageItemService,
        fastify.log,
      );
    },
  );
};
