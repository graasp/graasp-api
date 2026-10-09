import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';

const learningWorkspaceSchema = customType.StrictObject({
  id: customType.UUID(),
  itemId: customType.UUID(),
  notes: Type.String({ maxLength: 20000 }),
  createdAt: customType.DateTime(),
  updatedAt: customType.DateTime(),
});

const learningWorkspaceSettingsSchema = customType.StrictObject({
  itemId: customType.UUID(),
  instructions: Type.String({ maxLength: 5000 }),
  createdAt: customType.DateTime(),
  updatedAt: customType.DateTime(),
});

export const learningWorkspaceSchemaRef = registerSchemaAsRef(
  'learningWorkspace',
  'Learning Workspace',
  learningWorkspaceSchema,
);

export const learningWorkspaceSettingsSchemaRef = registerSchemaAsRef(
  'learningWorkspaceSettings',
  'Learning Workspace Settings',
  learningWorkspaceSettingsSchema,
);

const params = customType.StrictObject({ itemId: customType.UUID() });

export const getLearningWorkspaceSettings = {
  operationId: 'getLearningWorkspaceSettings',
  tags: ['learning-workspace'],
  summary: 'Get the shared learning workspace settings for an item',
  params,
  response: {
    [StatusCodes.OK]: Type.Union([learningWorkspaceSettingsSchemaRef, Type.Null()]),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const updateLearningWorkspaceSettings = {
  operationId: 'updateLearningWorkspaceSettings',
  tags: ['learning-workspace'],
  summary: 'Update the shared learning workspace settings for an item',
  params,
  body: customType.StrictObject({
    instructions: Type.String({ maxLength: 5000 }),
  }),
  response: {
    [StatusCodes.OK]: learningWorkspaceSettingsSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getOwnLearningWorkspace = {
  operationId: 'getOwnLearningWorkspace',
  tags: ['learning-workspace'],
  summary: "Get the authenticated account's private learning workspace for an item",
  params,
  response: {
    [StatusCodes.OK]: Type.Union([learningWorkspaceSchemaRef, Type.Null()]),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const updateOwnLearningWorkspace = {
  operationId: 'updateOwnLearningWorkspace',
  tags: ['learning-workspace'],
  summary: "Update the authenticated account's private learning workspace for an item",
  params,
  body: Type.Partial(
    customType.StrictObject({
      notes: Type.String({ maxLength: 20000 }),
    }),
    {
      minProperties: 1,
      propertyNames: Type.Literal('notes'),
    },
  ),
  response: {
    [StatusCodes.OK]: learningWorkspaceSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
