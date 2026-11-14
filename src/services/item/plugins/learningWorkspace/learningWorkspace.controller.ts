import { StatusCodes } from 'http-status-codes';

import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { asDefined } from '../../../../utils/assertions';
import { isAuthenticated, matchOne, optionalIsAuthenticated } from '../../../auth/plugins/passport';
import { assertIsMember, assertIsMemberOrGuest } from '../../../authentication';
import { guestAccountRole } from '../../../itemLogin/strategies/guestAccountRole';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { ItemService } from '../../item.service';
import {
  completeLearningGoal,
  createLearningGoal,
  deleteLearningGoal,
  getLearningGoals,
  getOwnLearningGoalCompletions,
  reorderLearningGoals,
  uncompleteLearningGoal,
  updateLearningGoal,
} from './learningGoal.schemas';
import { LearningGoalService } from './learningGoal.service';
import {
  getLearningWorkspaceSettings,
  getOwnLearningWorkspace,
  updateLearningWorkspaceSettings,
  updateOwnLearningWorkspace,
} from './learningWorkspace.schemas';
import { LearningWorkspaceService } from './learningWorkspace.service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const learningWorkspaceService = resolveDependency(LearningWorkspaceService);
  const learningGoalService = resolveDependency(LearningGoalService);
  const itemService = resolveDependency(ItemService);
  const learnerPreHandler = [
    isAuthenticated,
    matchOne(validatedMemberAccountRole, guestAccountRole),
  ];
  const teacherPreHandler = [isAuthenticated, matchOne(validatedMemberAccountRole)];

  itemService.hooks.setPostHook('copy', async (_actor, thisDb, { original, copy }) => {
    await learningWorkspaceService.copySettingsForItem(thisDb, original.id, copy.id);
    await learningGoalService.copyForItem(thisDb, original.id, copy.id);
  });

  fastify.get(
    '/:itemId/learning-workspace-settings',
    { schema: getLearningWorkspaceSettings, preHandler: optionalIsAuthenticated },
    async ({ user, params: { itemId } }) =>
      learningWorkspaceService.getSettings(db, user?.account, itemId),
  );

  fastify.patch(
    '/:itemId/learning-workspace-settings',
    { schema: updateLearningWorkspaceSettings, preHandler: teacherPreHandler },
    async ({ user, params: { itemId }, body }) => {
      const account = asDefined(user?.account);
      assertIsMember(account);
      return db.transaction((tx) =>
        learningWorkspaceService.updateSettings(tx, account, itemId, body),
      );
    },
  );

  fastify.get(
    '/:itemId/learning-workspace',
    { schema: getOwnLearningWorkspace, preHandler: learnerPreHandler },
    async ({ user, params: { itemId } }) => {
      const account = asDefined(user?.account);
      assertIsMemberOrGuest(account);
      return learningWorkspaceService.getOwn(db, account, itemId);
    },
  );

  fastify.patch(
    '/:itemId/learning-workspace',
    { schema: updateOwnLearningWorkspace, preHandler: learnerPreHandler },
    async ({ user, params: { itemId }, body }) => {
      const account = asDefined(user?.account);
      assertIsMemberOrGuest(account);
      return db.transaction((tx) => learningWorkspaceService.patchOwn(tx, account, itemId, body));
    },
  );

  fastify.get(
    '/:itemId/learning-goals',
    { schema: getLearningGoals, preHandler: optionalIsAuthenticated },
    async ({ user, params: { itemId } }) =>
      learningGoalService.getForItem(db, user?.account, itemId),
  );

  fastify.post(
    '/:itemId/learning-goals',
    { schema: createLearningGoal, preHandler: teacherPreHandler },
    async ({ user, params: { itemId }, body }, reply) => {
      const account = asDefined(user?.account);
      assertIsMember(account);
      const goal = await db.transaction((tx) =>
        learningGoalService.create(tx, account, itemId, body),
      );
      return reply.status(StatusCodes.CREATED).send(goal);
    },
  );

  fastify.put(
    '/:itemId/learning-goals/order',
    { schema: reorderLearningGoals, preHandler: teacherPreHandler },
    async ({ user, params: { itemId }, body: { goalIds } }) => {
      const account = asDefined(user?.account);
      assertIsMember(account);
      return db.transaction((tx) => learningGoalService.reorder(tx, account, itemId, goalIds));
    },
  );

  fastify.patch(
    '/:itemId/learning-goals/:goalId',
    { schema: updateLearningGoal, preHandler: teacherPreHandler },
    async ({ user, params: { itemId, goalId }, body }) => {
      const account = asDefined(user?.account);
      assertIsMember(account);
      return db.transaction((tx) => learningGoalService.update(tx, account, itemId, goalId, body));
    },
  );

  fastify.delete(
    '/:itemId/learning-goals/:goalId',
    { schema: deleteLearningGoal, preHandler: teacherPreHandler },
    async ({ user, params: { itemId, goalId } }, reply) => {
      const account = asDefined(user?.account);
      assertIsMember(account);
      await db.transaction((tx) => learningGoalService.delete(tx, account, itemId, goalId));
      return reply.status(StatusCodes.NO_CONTENT).send(null);
    },
  );

  fastify.get(
    '/:itemId/learning-goal-completions',
    { schema: getOwnLearningGoalCompletions, preHandler: learnerPreHandler },
    async ({ user, params: { itemId } }) => {
      const account = asDefined(user?.account);
      assertIsMemberOrGuest(account);
      return learningGoalService.getOwnCompletions(db, account, itemId);
    },
  );

  fastify.put(
    '/:itemId/learning-goals/:goalId/completion',
    { schema: completeLearningGoal, preHandler: learnerPreHandler },
    async ({ user, params: { itemId, goalId } }, reply) => {
      const account = asDefined(user?.account);
      assertIsMemberOrGuest(account);
      await db.transaction((tx) =>
        learningGoalService.setCompletion(tx, account, itemId, goalId, true),
      );
      return reply.status(StatusCodes.NO_CONTENT).send(null);
    },
  );

  fastify.delete(
    '/:itemId/learning-goals/:goalId/completion',
    { schema: uncompleteLearningGoal, preHandler: learnerPreHandler },
    async ({ user, params: { itemId, goalId } }, reply) => {
      const account = asDefined(user?.account);
      assertIsMemberOrGuest(account);
      await db.transaction((tx) =>
        learningGoalService.setCompletion(tx, account, itemId, goalId, false),
      );
      return reply.status(StatusCodes.NO_CONTENT).send(null);
    },
  );
};

export default plugin;
