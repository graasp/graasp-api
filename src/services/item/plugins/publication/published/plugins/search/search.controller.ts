import { Queue } from 'bullmq';
import { StatusCodes } from 'http-status-codes';

import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { ActionTriggers } from '@graasp/sdk';

import { REDIS_CONNECTION } from '../../../../../../../config/redis.js';
import { resolveDependency } from '../../../../../../../di/utils.js';
import { db } from '../../../../../../../drizzle/db.js';
import {
  GRAASPER_CREATOR_ID,
  MEILISEARCH_REBUILD_SECRET,
} from '../../../../../../../utils/config.js';
import { Queues } from '../../../../../../../workers/config.js';
import { ActionService } from '../../../../../../action/action.service.js';
import { optionalIsAuthenticated } from '../../../../../../auth/plugins/passport/preHandlers.js';
import {
  getFacets,
  getFeatured,
  getMostLiked,
  getMostRecent,
  search,
} from './search.schemas.js';
import { SearchService } from './search.service.js';

export type SearchFields = {
  keywords?: string;
  tags?: string[];
  parentId?: string;
  name?: string;
  creator?: string;
};

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const searchService = resolveDependency(SearchService);
  const actionService = resolveDependency(ActionService);

  // use post to allow complex body
  fastify.post(
    '/collections/search',
    { preHandler: optionalIsAuthenticated, schema: search },
    async (request) => {
      const { user, body } = request;
      const member = user?.account;
      const searchResults = await searchService.search(body);
      const action = {
        type: ActionTriggers.ItemSearch,
        extra: body,
      };
      await actionService.postMany(db, member, request, [action]);
      return searchResults;
    },
  );

  // use post to allow complex body
  fastify.post(
    '/collections/facets',
    { preHandler: optionalIsAuthenticated, schema: getFacets },
    async (request) => {
      const { body, query } = request;
      const searchResults = await searchService.getFacets(
        query.facetName,
        body,
      );
      return searchResults;
    },
  );

  fastify.get(
    '/collections/featured',
    { preHandler: optionalIsAuthenticated, schema: getFeatured },
    async ({ query }) => {
      const searchResults = await searchService.getFeatured(
        GRAASPER_CREATOR_ID,
        query.limit,
      );
      return searchResults;
    },
  );

  fastify.get(
    '/collections/liked',
    { preHandler: optionalIsAuthenticated, schema: getMostLiked },
    async ({ query }) => {
      const searchResults = await searchService.getMostLiked(query.limit);
      return searchResults;
    },
  );

  fastify.get(
    '/collections/recent',
    { preHandler: optionalIsAuthenticated, schema: getMostRecent },
    async ({ query }) => {
      const searchResults = await searchService.getMostRecent(query.limit);
      return searchResults;
    },
  );

  fastify.get('/collections/search/rebuild', async ({ headers }, reply) => {
    // TODO: in the future, lock this behind admin permission and maybe add a button to the frontend admin panel
    const headerRebuildSecret = headers['meilisearch-rebuild'];

    if (
      MEILISEARCH_REBUILD_SECRET &&
      MEILISEARCH_REBUILD_SECRET === headerRebuildSecret
    ) {
      const queue = new Queue(Queues.SearchIndex.queueName, {
        connection: { url: REDIS_CONNECTION },
      });
      queue.add(
        Queues.SearchIndex.jobs.buildIndex,
        {},
        { deduplication: { id: Queues.SearchIndex.jobs.buildIndex } },
      );
      reply.status(StatusCodes.ACCEPTED);
    } else {
      reply.status(StatusCodes.UNAUTHORIZED);
    }
  });
};

export default plugin;
