import { StatusCodes } from 'http-status-codes';

import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils.js';
import { db } from '../../../../drizzle/db.js';
import { asDefined } from '../../../../utils/assertions.js';
import {
  isAuthenticated,
  matchOne,
} from '../../../auth/plugins/passport/preHandlers.js';
import { guestAccountRole } from '../../../itemLogin/strategies/guestAccountRole.js';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole.js';
import { create, getFlagTypes } from './itemFlag.schemas.js';
import { ItemFlagService } from './itemFlag.service.js';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const itemFlagService = resolveDependency(ItemFlagService);

  // Get all flag types that can be assigned to an ItemFlag entity.
  fastify.get('/flags', { schema: getFlagTypes }, async () => {
    return itemFlagService.getAllFlagTypes();
  });

  // create item flag
  fastify.post(
    '/:itemId/flags',
    {
      schema: create,
      preHandler: [
        isAuthenticated,
        matchOne(validatedMemberAccountRole, guestAccountRole),
      ],
    },
    async ({ user, params: { itemId }, body: { type } }, reply) => {
      const account = asDefined(user?.account);
      await db.transaction(async (tx) => {
        await itemFlagService.post(tx, account, itemId, type);
      });
      reply.status(StatusCodes.NO_CONTENT);
    },
  );
};

export default plugin;
