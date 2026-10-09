import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';

export const learningGoalSchemaRef = registerSchemaAsRef(
  'learningGoal',
  'Learning Goal',
  customType.StrictObject({
    id: customType.UUID(),
    itemId: customType.UUID(),
    text: Type.String({ minLength: 1, maxLength: 200 }),
    position: Type.Integer({ minimum: 0 }),
    createdAt: customType.DateTime(),
    updatedAt: customType.DateTime(),
  }),
);

export const learningGoalCompletionSchemaRef = registerSchemaAsRef(
  'learningGoalCompletion',
  'Learning Goal Completion',
  customType.StrictObject({
    goalId: customType.UUID(),
    completedAt: customType.DateTime(),
  }),
);

const itemParams = customType.StrictObject({ itemId: customType.UUID() });
const goalParams = customType.StrictObject({
  itemId: customType.UUID(),
  goalId: customType.UUID(),
});
const textBody = customType.StrictObject({
  text: Type.String({ minLength: 1, maxLength: 200 }),
});

export const getLearningGoals = {
  operationId: 'getLearningGoals',
  tags: ['learning-goal'],
  summary: 'Get the ordered learning goals for an item',
  params: itemParams,
  response: {
    [StatusCodes.OK]: Type.Array(learningGoalSchemaRef),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const createLearningGoal = {
  operationId: 'createLearningGoal',
  tags: ['learning-goal'],
  summary: 'Create a learning goal for an item',
  params: itemParams,
  body: textBody,
  response: {
    [StatusCodes.CREATED]: learningGoalSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const updateLearningGoal = {
  operationId: 'updateLearningGoal',
  tags: ['learning-goal'],
  summary: 'Update a learning goal',
  params: goalParams,
  body: textBody,
  response: {
    [StatusCodes.OK]: learningGoalSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const deleteLearningGoal = {
  operationId: 'deleteLearningGoal',
  tags: ['learning-goal'],
  summary: 'Delete a learning goal',
  params: goalParams,
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null(),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const reorderLearningGoals = {
  operationId: 'reorderLearningGoals',
  tags: ['learning-goal'],
  summary: 'Replace the order of all learning goals for an item',
  params: itemParams,
  body: customType.StrictObject({
    goalIds: Type.Array(customType.UUID(), { maxItems: 20 }),
  }),
  response: {
    [StatusCodes.OK]: Type.Array(learningGoalSchemaRef),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getOwnLearningGoalCompletions = {
  operationId: 'getOwnLearningGoalCompletions',
  tags: ['learning-goal'],
  summary: "Get the authenticated account's private learning goal completions",
  params: itemParams,
  response: {
    [StatusCodes.OK]: Type.Array(learningGoalCompletionSchemaRef),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const completeLearningGoal = {
  operationId: 'completeLearningGoal',
  tags: ['learning-goal'],
  summary: 'Mark a learning goal complete for the authenticated account',
  params: goalParams,
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null(),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const uncompleteLearningGoal = {
  operationId: 'uncompleteLearningGoal',
  tags: ['learning-goal'],
  summary: 'Mark a learning goal incomplete for the authenticated account',
  params: goalParams,
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null(),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
