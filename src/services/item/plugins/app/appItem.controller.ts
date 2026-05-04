import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils.js';
import { db } from '../../../../drizzle/db.js';
import { asDefined } from '../../../../utils/assertions.js';
import { isAuthenticated, matchOne } from '../../../auth/plugins/passport/preHandlers.js';
import { assertIsMember } from '../../../authentication.js';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole.js';
import { ItemActionService } from '../action/itemAction.service.js';
import { createApp, updateApp } from './app.schemas.js';
import { AppItemService } from './appItemService.js';

export const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  // service for item app api
  const appItemService = resolveDependency(AppItemService);
  const itemActionService = resolveDependency(ItemActionService);

  fastify.post(
    '/apps',
    {
      schema: createApp,
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
        const item = await appItemService.postWithOptions(tx, member, {
          ...data,
          previousItemId,
          parentId,
        });
        return item;
      });

      reply.send(item);

      // background operations
      await itemActionService.postPostAction(db, request, item);
      await db.transaction(async (tx) => {
        await appItemService.rescaleOrderForParent(tx, member, item);
      });
    },
  );

  fastify.patch(
    '/apps/:id',
    {
      schema: updateApp,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request) => {
      const {
        user,
        params: { id },
        body,
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);
      return await db.transaction(async (tx) => {
        const item = await appItemService.patch(tx, member, id, body);
        await itemActionService.postPatchAction(tx, request, item);
        return item;
      });
    },
  );
};
