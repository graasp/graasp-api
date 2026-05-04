import { StatusCodes } from 'http-status-codes';

import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { MembershipRequestStatus } from '@graasp/sdk';

import { resolveDependency } from '../../../../di/utils.js';
import { db } from '../../../../drizzle/db.js';
import { asDefined } from '../../../../utils/assertions.js';
import { ItemNotFound } from '../../../../utils/errors.js';
import { isAuthenticated, matchOne } from '../../../auth/plugins/passport/preHandlers.js';
import { assertIsMember } from '../../../authentication.js';
import { AuthorizedItemService } from '../../../authorizedItem.service.js';
import { ItemRepository } from '../../../item/item.repository.js';
import { ItemLoginSchemaExists } from '../../../itemLogin/errors.js';
import { ItemLoginService } from '../../../itemLogin/itemLogin.service.js';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole.js';
import { ItemMembershipService } from '../../membership.service.js';
import {
  ItemMembershipAlreadyExists,
  MembershipRequestAlreadyExists,
  MembershipRequestNotFound,
} from './error.js';
import { createOne, deleteOne, getAllByItem, getOwn } from './membershipRequest.schemas.js';
import { MembershipRequestService } from './membershipRequest.service.js';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const membershipRequestService = resolveDependency(MembershipRequestService);
  const itemMembershipService = resolveDependency(ItemMembershipService);
  const itemRepository = resolveDependency(ItemRepository);
  const itemLoginService = resolveDependency(ItemLoginService);
  const authorizedItemService = resolveDependency(AuthorizedItemService);

  fastify.get(
    '',
    {
      schema: getAllByItem,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, params }, reply) => {
      const member = asDefined(user?.account);
      const { itemId } = params;

      await db.transaction(async (tx) => {
        // Check if the Item exists and the member has the required permission.
        await authorizedItemService.assertAccessForItemId(tx, {
          accountId: member.id,
          itemId,
          permission: 'admin',
        });

        const requests = await membershipRequestService.getAllByItem(tx, itemId);
        reply.send(requests);
      });
    },
  );

  fastify.get(
    '/own',
    {
      schema: getOwn,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, params }, reply) => {
      const member = asDefined(user?.account);
      const { itemId } = params;

      await db.transaction(async (tx) => {
        const membershipRequest = await membershipRequestService.get(tx, member.id, itemId);
        if (membershipRequest) {
          return reply.send({ status: MembershipRequestStatus.Pending });
        }

        const itemMembership = await itemMembershipService.hasMembershipOnItem(
          tx,
          member.id,
          itemId,
        );
        if (itemMembership) {
          return reply.send({ status: MembershipRequestStatus.Approved });
        }

        const item = await itemRepository.getOneOrThrow(tx, itemId);
        if (item) {
          return reply.send({
            status: MembershipRequestStatus.NotSubmittedOrDeleted,
          });
        }

        throw new ItemNotFound(itemId);
      });
    },
  );

  fastify.post(
    '',
    {
      schema: createOne,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, params }, reply) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      const { itemId } = params;

      await db.transaction(async (tx) => {
        const membershipRequest = await membershipRequestService.get(tx, member.id, itemId);
        if (membershipRequest) {
          throw new MembershipRequestAlreadyExists();
        }
        const item = await itemRepository.getOneOrThrow(tx, itemId);

        const itemLoginSchema = await itemLoginService.getByItemPath(tx, item.path);
        if (itemLoginSchema) {
          throw new ItemLoginSchemaExists();
        }

        // Check if the member already has an access to the item (from membership), if so, throw an error
        if (
          await authorizedItemService.hasPermission(tx, {
            permission: 'read',
            accountId: member.id,
            item,
          })
        ) {
          throw new ItemMembershipAlreadyExists();
        }

        await membershipRequestService.post(tx, member.id, itemId);
        await membershipRequestService.notifyAdmins(tx, member, item);
      });
      reply.status(StatusCodes.NO_CONTENT);
    },
  );

  fastify.delete(
    '/:memberId',
    {
      schema: deleteOne,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, params }, reply) => {
      const member = asDefined(user?.account);
      const { itemId, memberId } = params;

      await db.transaction(async (tx) => {
        // Check if the item exists and the member has the required permission
        await authorizedItemService.assertAccessForItemId(tx, {
          accountId: member.id,
          itemId,
          permission: 'admin',
        });

        const result = await membershipRequestService.deleteOne(tx, memberId, itemId);

        // throw if the operation didn't delete anything
        if (!result) {
          throw new MembershipRequestNotFound(result);
        }
      });
      reply.status(StatusCodes.NO_CONTENT);
    },
  );
};
export default plugin;
