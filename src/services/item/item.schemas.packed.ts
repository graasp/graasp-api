import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../plugins/typebox.js';
import { errorSchemaRef, itemTypeSchemaRef } from '../../schemas/global.js';
import { permissionLevelSchemaRef } from '../../types.js';
import { nullableMemberSchemaRef } from '../member/member.schemas.js';
import { ITEMS_PAGE_SIZE } from './constants.js';
import { appItemSchemaRef } from './plugins/app/app.schemas.js';
import { documentItemSchemaRef } from './plugins/document/document.schemas.js';
import { embeddedLinkItemSchemaRef } from './plugins/embeddedLink/link.schemas.js';
import { etherpadItemSchemaRef } from './plugins/etherpad/etherpad.schemas.js';
import { fileItemSchemaRef } from './plugins/file/itemFile.schema.js';
import { folderItemSchemaRef } from './plugins/folder/folder.schemas.js';
import { h5pItemSchemaRef } from './plugins/html/h5p/h5p.schemas.js';
import { itemVisibilitySchemaRef } from './plugins/itemVisibility/itemVisibility.schemas.js';
import { pageItemSchemaRef } from './plugins/page/page.schemas.js';
import { shortcutItemSchemaRef } from './plugins/shortcut/shortcut.schemas.js';
import { Ordering, SortBy } from './types.js';

export const itemSchema = Type.Union([
  appItemSchemaRef,
  documentItemSchemaRef,
  embeddedLinkItemSchemaRef,
  etherpadItemSchemaRef,
  fileItemSchemaRef,
  folderItemSchemaRef,
  h5pItemSchemaRef,
  pageItemSchemaRef,
  shortcutItemSchemaRef,
]);
export const itemSchemaRef = registerSchemaAsRef('item', 'Item', itemSchema);

const packedSchema = customType.StrictObject({
  creator: nullableMemberSchemaRef,
  permission: Type.Union([permissionLevelSchemaRef, Type.Null()]),
  hidden: Type.Optional(itemVisibilitySchemaRef),
  public: Type.Optional(itemVisibilitySchemaRef),
  thumbnails: Type.Optional(
    customType.StrictObject(
      {
        small: Type.String({ format: 'uri' }),
        medium: Type.String({ format: 'uri' }),
      },
      { additionalProperties: true },
    ),
  ),
});

export const packedItemSchemaRef = registerSchemaAsRef(
  'packedItem',
  'Packed Item',
  Type.Intersect(
    [
      Type.Union([
        appItemSchemaRef,
        documentItemSchemaRef,
        embeddedLinkItemSchemaRef,
        etherpadItemSchemaRef,
        fileItemSchemaRef,
        folderItemSchemaRef,
        h5pItemSchemaRef,
        pageItemSchemaRef,
        shortcutItemSchemaRef,
      ]),
      packedSchema,
    ],
    {
      discriminator: 'type',
      description: 'Item with additional information for simple display',
    },
  ),
);

export const getOne = {
  operationId: 'getItem',
  tags: ['item'],
  summary: 'Get item',
  description: 'Get item by its id.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  response: { [StatusCodes.OK]: packedItemSchemaRef, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;

export const getAccessible = {
  operationId: 'getAccessibleItems',
  tags: ['item'],
  summary: 'Get accessible items',
  description: 'Get items the user has access to',

  querystring: Type.Composite(
    [
      customType.Pagination({ page: { default: 1 }, pageSize: { default: ITEMS_PAGE_SIZE } }),
      Type.Partial(
        customType.StrictObject({
          creatorId: Type.String(),
          permissions: Type.Array(permissionLevelSchemaRef),
          types: Type.Array(itemTypeSchemaRef),
          keywords: Type.Array(Type.String()),
          sortBy: Type.Enum(SortBy),
          ordering: Type.Enum(Ordering),
        }),
      ),
    ],
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.OK]: Type.Object({
      data: Type.Array(packedItemSchemaRef),
      pagination: customType.Pagination({
        page: {
          minimum: 0,
          default: 1,
        },
        pageSize: { minimum: 1, default: ITEMS_PAGE_SIZE },
      }),
    }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getChildren = {
  operationId: 'getChildren',
  tags: ['item'],
  summary: 'Get children of item',
  description: 'Get children of item given its id.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  querystring: Type.Partial(
    customType.StrictObject({
      keywords: Type.Array(Type.String()),
      types: Type.Array(itemTypeSchemaRef),
    }),
  ),
  response: {
    [StatusCodes.OK]: Type.Array(packedItemSchemaRef),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getDescendantItems = {
  operationId: 'getDescendantItems',
  tags: ['item'],
  summary: 'Get descendant items of item',
  description: 'Get descendant items of item given its id.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  querystring: Type.Partial(
    customType.StrictObject({
      // showHidden default value is true so it handles the legacy behavior.
      showHidden: Type.Boolean({ default: true }),
      types: Type.Array(itemTypeSchemaRef),
    }),
  ),
  response: {
    [StatusCodes.OK]: Type.Array(packedItemSchemaRef),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
