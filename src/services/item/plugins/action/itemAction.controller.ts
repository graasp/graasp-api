import { StatusCodes } from 'http-status-codes';

import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import fp from 'fastify-plugin';

import { resolveDependency } from '../../../../di/utils.js';
import { db } from '../../../../drizzle/db.js';
import { asDefined } from '../../../../utils/assertions.js';
import { ALLOWED_ORIGINS } from '../../../../utils/config.js';
import { ActionService } from '../../../action/action.service.js';
import {
  isAuthenticated,
  matchOne,
  optionalIsAuthenticated,
} from '../../../auth/plugins/passport/preHandlers.js';
import { assertIsMember } from '../../../authentication.js';
import { AuthorizedItemService } from '../../../authorizedItem.service.js';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole.js';
import {
  ItemOpFeedbackErrorEvent,
  ItemOpFeedbackEvent,
  memberItemsTopic,
} from '../../ws/item.events.js';
import { CannotPostAction } from './errors.js';
import {
  exportActions,
  getItemActionsByDay,
  getItemActionsByHour,
  getItemActionsByWeekday,
  postAction,
} from './itemAction.schemas.js';
import { ItemActionService } from './itemAction.service.js';
import { ActionRequestExportService } from './requestExport/itemAction.requestExport.service.js';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { websockets } = fastify;

  const authorizedItemService = resolveDependency(AuthorizedItemService);
  const actionService = resolveDependency(ActionService);
  const itemActionService = resolveDependency(ItemActionService);
  const requestExportService = resolveDependency(ActionRequestExportService);

  fastify.post(
    '/:id/actions',
    {
      schema: postAction,
      preHandler: optionalIsAuthenticated,
    },
    async (request, reply) => {
      const {
        user,
        params: { id: itemId },
        body: { type, extra = {} },
      } = request;
      const maybeUser = user?.account;

      // allow only from known hosts
      if (!request.headers.origin) {
        throw new CannotPostAction();
      }
      if (!ALLOWED_ORIGINS.includes(request.headers.origin)) {
        throw new CannotPostAction(request.headers.origin);
      }

      await db.transaction(async (tx) => {
        const item = await authorizedItemService.getItemById(tx, {
          accountId: maybeUser?.id,
          itemId,
        });
        await actionService.postMany(tx, maybeUser, request, [
          {
            item,
            type,
            extra: JSON.stringify(extra),
            // FIX: define the view !
            // view: ??
          },
        ]);
      });
      reply.status(StatusCodes.NO_CONTENT);
    },
  );

  // export actions matching the given `id`
  fastify.post(
    '/:id/actions/export',
    {
      schema: exportActions,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request, reply) => {
      const {
        user,
        params: { id: itemId },
        query: { format = 'json' },
        log,
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);

      // reply no content and let the server create the archive and send the mail
      reply.status(StatusCodes.NO_CONTENT);

      // TODO: add in queue
      await db
        .transaction(async (tx) => {
          const item = await requestExportService.request(tx, member, itemId, format);
          if (item) {
            websockets.publish(
              memberItemsTopic,
              member.id,
              ItemOpFeedbackEvent('export', [itemId], { [item.id]: item }),
            );
          }
        })
        .catch((e: Error) => {
          log.error(e);
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackErrorEvent('export', [itemId], e),
          );
        });
    },
  );

  fastify.get(
    '/:id/actions/actions-by-day',
    {
      schema: getItemActionsByDay,
      preHandler: [optionalIsAuthenticated],
    },
    async (request) => {
      const {
        user,
        params: { id: itemId },
        query: { startDate, endDate },
      } = request;

      return await itemActionService.getActionsByDay(db, itemId, user?.account, {
        startDate,
        endDate,
      });
    },
  );

  fastify.get(
    '/:id/actions/actions-by-hour',
    {
      schema: getItemActionsByHour,
      preHandler: [optionalIsAuthenticated],
    },
    async (request) => {
      const {
        user,
        params: { id: itemId },
        query: { startDate, endDate },
      } = request;

      return await itemActionService.getActionsByHour(db, itemId, user?.account, {
        startDate,
        endDate,
      });
    },
  );

  fastify.get(
    '/:id/actions/actions-by-weekday',
    {
      schema: getItemActionsByWeekday,
      preHandler: [optionalIsAuthenticated],
    },
    async (request) => {
      const {
        user,
        params: { id: itemId },
        query: { startDate, endDate },
      } = request;

      return await itemActionService.getActionsByWeekday(db, itemId, user?.account, {
        startDate,
        endDate,
      });
    },
  );
};

export default fp(plugin);
