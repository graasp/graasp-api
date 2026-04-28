import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils.js';
import { db } from '../../../../drizzle/db.js';
import { asDefined } from '../../../../utils/assertions.js';
import { isAuthenticated } from '../../../auth/plugins/passport/preHandlers.js';
import {
  deleteAllById,
  getMemberFilteredActions,
} from './memberAction.schemas.js';
import { ActionMemberService } from './memberAction.service.js';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const actionMemberService = resolveDependency(ActionMemberService);

  fastify.get(
    '/actions',
    { schema: getMemberFilteredActions, preHandler: isAuthenticated },
    async ({ user, query }) => {
      const account = asDefined(user?.account);
      return actionMemberService.getFilteredActions(db, account, query);
    },
  );

  // todo: delete self data
  // delete all the actions matching the given `memberId`
  fastify.delete(
    '/members/:id/delete',
    { schema: deleteAllById, preHandler: isAuthenticated },
    async ({ user, params: { id } }) => {
      const account = asDefined(user?.account);
      return db.transaction(async (tx) => {
        return actionMemberService.deleteAllForMember(tx, account, id);
      });
    },
  );
};

export default plugin;
