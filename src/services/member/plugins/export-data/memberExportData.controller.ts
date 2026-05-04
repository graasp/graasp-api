import { StatusCodes } from 'http-status-codes';

import type { FastifyPluginAsync } from 'fastify';

import { resolveDependency } from '../../../../di/utils.js';
import { db } from '../../../../drizzle/db.js';
import { asDefined } from '../../../../utils/assertions.js';
import { MEMBER_EXPORT_DATA_ROUTE_PREFIX } from '../../../../utils/config.js';
import { isAuthenticated, matchOne } from '../../../auth/plugins/passport/preHandlers.js';
import { assertIsMember } from '../../../authentication.js';
import { MemberRepository } from '../../member.repository.js';
import { memberAccountRole } from '../../strategies/memberAccountRole.js';
import { exportMemberData } from './memberExportData.schemas.js';
import { ExportMemberDataService } from './memberExportData.service.js';

const plugin: FastifyPluginAsync = async (fastify) => {
  const exportMemberDataService = resolveDependency(ExportMemberDataService);
  const memberRepository = resolveDependency(MemberRepository);

  await fastify.register(
    async function (fastify) {
      // download all related data to the given user
      fastify.post(
        '/',
        {
          schema: exportMemberData,
          preHandler: [isAuthenticated, matchOne(memberAccountRole)],
        },
        async ({ user }, reply) => {
          const authedUser = asDefined(user?.account);
          assertIsMember(authedUser);
          // get member info such as email and lang
          const member = await memberRepository.get(db, authedUser.id);

          // reply no content and let the server create the archive and send the mail
          reply.status(StatusCodes.NO_CONTENT);

          // TODO: add in queue
          await db.transaction(async (tx) => {
            await exportMemberDataService.createArchiveAndSendByEmail(tx, member.toMemberInfo());
          });
        },
      );
    },
    { prefix: MEMBER_EXPORT_DATA_ROUTE_PREFIX },
  );
};

export default plugin;
