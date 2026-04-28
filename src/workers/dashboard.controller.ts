import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { FastifyAdapter } from '@bull-board/fastify';
import { Queue } from 'bullmq';

import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { DEV } from '../config/env.js';
import { REDIS_CONNECTION } from '../config/redis.js';
import { Queues } from './config.js';

export const queueDashboardPlugin: FastifyPluginAsyncTypebox = async (
  instance,
) => {
  if (DEV) {
    const serverAdapter = new FastifyAdapter();

    const queues = [
      new Queue(Queues.ItemExport.queueName, {
        connection: { url: REDIS_CONNECTION },
      }),
      new Queue(Queues.SearchIndex.queueName, {
        connection: { url: REDIS_CONNECTION },
      }),
    ];

    createBullBoard({
      queues: queues.map((q) => new BullMQAdapter(q)),
      serverAdapter,
    });

    serverAdapter.setBasePath('/ui');
    instance.register(serverAdapter.registerPlugin(), { prefix: '/ui' });
  } else {
    // warn that the dashboard will not be available.
    instance.log.info(
      'Not running in dev mode, the bullmq dashboard will not be available.',
    );
  }
};
