import { StatusCodes } from 'http-status-codes';
import waitForExpect from 'wait-for-expect';

import type { FastifyInstance } from 'fastify';

import { HttpMethod, type ItemOpFeedbackEvent as ItemOpFeedbackEventType } from '@graasp/sdk';

import {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../../../test/app.js';
import { seedFromJson } from '../../../../../../../test/mocks/seed.js';
import { db } from '../../../../../../drizzle/db.js';
import { assertIsDefined } from '../../../../../../utils/assertions.js';
import { ITEMS_ROUTE_PREFIX } from '../../../../../../utils/config.js';
import { TestWsClient } from '../../../../../websockets/test/test-websocket-client.js';
import { setupWsApp } from '../../../../../websockets/test/ws-app.js';
import { type ItemRaw } from '../../../../item.js';
import {
  ItemOpFeedbackErrorEvent,
  ItemOpFeedbackEvent,
  memberItemsTopic,
} from '../../../../ws/item.events.js';
import { expectValidateFeedbackOp } from '../../../action/test/utils.js';
import { ItemValidationGroupRepository } from '../ItemValidationGroup.repository.js';

describe('asynchronous feedback', () => {
  let app: FastifyInstance;
  let address: string;
  let ws: TestWsClient;

  beforeAll(async () => {
    ({ app, address } = await setupWsApp());
  });

  afterAll(async () => {
    await clearDatabase(db);
    app.close();
    ws.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
    unmockAuthenticate();
  });

  it('member that initated the validate operation receives success feedback', async () => {
    const {
      items: [item],
      actor,
    } = await seedFromJson({
      items: [{ memberships: [{ account: 'actor', permission: 'admin' }] }],
    });
    assertIsDefined(actor);
    mockAuthenticate(actor);
    ws = new TestWsClient(address);

    const memberUpdates = await ws.subscribe<ItemOpFeedbackEventType<ItemRaw, 'validate'>>({
      topic: memberItemsTopic,
      channel: actor.id,
    });

    const res = await app.inject({
      method: HttpMethod.Post,
      url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validate`,
    });
    expect(res.statusCode).toBe(StatusCodes.ACCEPTED);
    expect(res.body).toEqual(item.id);

    await waitForExpect(() => {
      const [feedbackUpdate] = memberUpdates;
      expectValidateFeedbackOp(
        feedbackUpdate,
        ItemOpFeedbackEvent('validate', [item.id], { [item.id]: item }),
      );
    });
  });

  it('member that initated the validate operation receives failure feedback', async () => {
    const {
      items: [item],
      actor,
    } = await seedFromJson({
      items: [{ memberships: [{ account: 'actor', permission: 'admin' }] }],
    });
    assertIsDefined(actor);
    mockAuthenticate(actor);
    ws = new TestWsClient(address);

    const memberUpdates = await ws.subscribe<ItemOpFeedbackEventType<ItemRaw, 'validate'>>({
      topic: memberItemsTopic,
      channel: actor.id,
    });

    jest.spyOn(ItemValidationGroupRepository.prototype, 'post').mockImplementation(async () => {
      throw new Error('mock error');
    });

    const res = await app.inject({
      method: HttpMethod.Post,
      url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validate`,
    });
    expect(res.statusCode).toBe(StatusCodes.ACCEPTED);
    expect(res.body).toEqual(item.id);

    await waitForExpect(() => {
      const [feedbackUpdate] = memberUpdates;
      expectValidateFeedbackOp(
        feedbackUpdate,
        ItemOpFeedbackErrorEvent('validate', [item.id], new Error('mock error')),
      );
    });
  });
});
