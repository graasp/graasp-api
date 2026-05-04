import { v4 } from 'uuid';
import { describe, expect, it, vi } from 'vitest';

import { buildPathFromIds } from '@graasp/sdk';

import { MOCK_LOGGER } from '../../../../../../test/app.vitest.js';
import { db } from '../../../../../drizzle/db.js';
import { MailerService } from '../../../../../plugins/mailer/mailer.service.js';
import { AuthorizedItemService } from '../../../../authorizedItem.service.js';
import { ItemMembershipRepository } from '../../../../itemMembership/membership.repository.js';
import { MemberRepository } from '../../../../member/member.repository.js';
import { ItemRepository } from '../../../item.repository.js';
import { PackedItemService } from '../../../packedItem.dto.js';
import { ItemActionService } from '../../action/itemAction.service.js';
import { ItemVisibilityRepository } from '../../itemVisibility/itemVisibility.repository.js';
import { ItemPublishedRepository } from './itemPublished.repository.js';
import { ItemPublishedService } from './itemPublished.service.js';
import { MeiliSearchWrapper } from './plugins/search/meilisearch.js';

const meiliSearchWrapper = {
  updateItem: vi.fn(),
} as unknown as MeiliSearchWrapper;

const itemPublishedRepository = new ItemPublishedRepository();

const itemPublishedService = new ItemPublishedService(
  {} as AuthorizedItemService,
  {} as MailerService,
  meiliSearchWrapper,
  {} as ItemVisibilityRepository,
  {} as ItemMembershipRepository,
  itemPublishedRepository,
  {} as PackedItemService,
  {} as ItemRepository,
  {} as MemberRepository,
  {} as ItemActionService,
  MOCK_LOGGER,
);

describe('ItemPublishedService - touchUpdatedAt', () => {
  it('change updatedAt with current time', async () => {
    // GIVEN
    const id = v4();
    const item = { id, path: buildPathFromIds(id) };
    const updatedAt = new Date().toISOString();

    // MOCK
    const updateItemMock = vi.spyOn(meiliSearchWrapper, 'updateItem');
    vi.spyOn(itemPublishedRepository, 'touchUpdatedAt').mockResolvedValue(updatedAt);

    // WHEN
    await itemPublishedService.touchUpdatedAt(db, item);

    // EXPECT
    expect(updateItemMock).toHaveBeenCalledWith(id, { updatedAt });
  });
});
