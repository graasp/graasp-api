import { fastifyCors } from '@fastify/cors';
import type { FastifyPluginAsync } from 'fastify';

import { MEMBER_PROFILE_ROUTE_PREFIX } from '../../utils/config.js';
import memberController from './member.controller.js';
import actionMemberPlugin from './plugins/action/memberAction.controller.js';
import memberExportDataPlugin from './plugins/export-data/memberExportData.controller.js';
import memberProfilePlugin from './plugins/profile/memberProfile.controller.js';
import memberThumbnailPlugin from './plugins/thumbnail/memberThumbnail.controller.js';

const ROUTES_PREFIX = '/members';

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.register(
    async function (fastify) {
      // add CORS support
      if (fastify.corsPluginOptions) {
        await fastify.register(fastifyCors, fastify.corsPluginOptions);
      }

      fastify.register(actionMemberPlugin);

      // routes
      fastify.register(memberController);

      fastify.register(memberThumbnailPlugin);
      fastify.register(memberProfilePlugin, { prefix: MEMBER_PROFILE_ROUTE_PREFIX });
      fastify.register(memberExportDataPlugin);
    },
    { prefix: ROUTES_PREFIX },
  );
};

export default plugin;
