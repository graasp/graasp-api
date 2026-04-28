import { pino } from 'pino';
import 'reflect-metadata';

import { registerDependencies } from '../di/container.js';
import { resolveDependency } from '../di/utils.js';
import { CRON_3AM_MONDAY, JobServiceBuilder } from '../jobs.js';
import { BaseLogger } from '../logger.js';
import { ItemExportRequestService } from './itemExportRequest.service.js';
import { ItemExportRequestWorker } from './itemExportRequest.worker.js';
import { SearchIndexService } from './searchIndex.service.js';
import { SearchIndexWorker } from './searchIndex.worker.js';

const start = async () => {
  // register tsyringe dependencies
  registerDependencies(pino());
  const logger = resolveDependency(BaseLogger);

  logger.debug('STARTING WORKERS');

  // start search index worker
  const searchIndexService = resolveDependency(SearchIndexService);
  new SearchIndexWorker(searchIndexService, logger);

  // worker for rebuild meilisearch index
  const jobServiceBuilder = new JobServiceBuilder(resolveDependency(BaseLogger));
  jobServiceBuilder
    .registerTask('rebuild-index', {
      handler: () => resolveDependency(SearchIndexService).buildIndex(),
      pattern: CRON_3AM_MONDAY,
    })
    .build();

  // start item export request worker
  const itemExportRequestService = resolveDependency(ItemExportRequestService);
  new ItemExportRequestWorker(itemExportRequestService, logger);

  logger.debug('WORKERS READY');
};

start();
