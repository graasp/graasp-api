import { EnqueuedTask } from 'meilisearch';
import { v4 } from 'uuid';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TagFactory } from '@graasp/sdk';

import { ItemFactory } from '../../../../../test/factories/item.factory.js';
import { db } from '../../../../drizzle/db.js';
import type { ItemPublishedWithItemWithCreator, TagRaw } from '../../../../drizzle/types.js';
import type { MinimalMember } from '../../../../types.js';
import { AuthorizedItemService } from '../../../authorizedItem.service.js';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository.js';
import { TagRepository } from '../../../tag/tag.repository.js';
import { resolveItemType } from '../../item.js';
import { ItemRepository } from '../../item.repository.js';
import { ItemVisibilityRepository } from '../itemVisibility/itemVisibility.repository.js';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository.js';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch.js';
import { ItemTagRepository } from './itemTag.repository.js';
import { ItemTagService } from './itemTag.service.js';

const meilisearchWrapper = {
  indexOne: vi.fn() as MeiliSearchWrapper['indexOne'],
} as MeiliSearchWrapper;

const itemTagRepository = {
  create: vi.fn() as ItemTagRepository['create'],
  delete: vi.fn() as ItemTagRepository['delete'],
} as ItemTagRepository;
const tagRepository = {
  addOneIfDoesNotExist: vi.fn(async () => TagFactory() as TagRaw),
} as unknown as TagRepository;
const itemPublishedRepository = {
  getForItem: vi.fn() as ItemPublishedRepository['getForItem'],
} as ItemPublishedRepository;
const authorizedItemService = new AuthorizedItemService(
  new ItemMembershipRepository(),
  new ItemVisibilityRepository(),
  new ItemRepository(),
);

const itemTagService = new ItemTagService(
  authorizedItemService,
  tagRepository,
  itemTagRepository,
  itemPublishedRepository,
  meilisearchWrapper,
);

describe('Item Tag create', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });
  it('does not index item if it is not published', async () => {
    vi.spyOn(authorizedItemService, 'getItemById').mockResolvedValue(
      resolveItemType(ItemFactory()),
    );
    vi.spyOn(itemTagRepository, 'create').mockResolvedValue();
    const indexOneMock = vi
      .spyOn(meilisearchWrapper, 'indexOne')
      .mockResolvedValue({} as unknown as EnqueuedTask);
    vi.spyOn(itemPublishedRepository, 'getForItem').mockResolvedValue(null);

    await itemTagService.create(db, {} as MinimalMember, v4(), TagFactory());

    expect(indexOneMock).not.toHaveBeenCalled();
  });

  it('index item if it is published', async () => {
    vi.spyOn(authorizedItemService, 'getItemById').mockResolvedValue(
      resolveItemType(ItemFactory()),
    );
    vi.spyOn(itemTagRepository, 'create').mockResolvedValue();
    const indexOneMock = vi
      .spyOn(meilisearchWrapper, 'indexOne')
      .mockResolvedValue({} as unknown as EnqueuedTask);
    vi.spyOn(itemPublishedRepository, 'getForItem').mockResolvedValue(
      {} as ItemPublishedWithItemWithCreator,
    );

    await itemTagService.create(db, {} as MinimalMember, v4(), TagFactory());

    expect(indexOneMock).toHaveBeenCalled();
  });
});

describe('Item Tag delete', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });
  it('does not index item if it is not published', async () => {
    vi.spyOn(authorizedItemService, 'getItemById').mockResolvedValue(
      resolveItemType(ItemFactory()),
    );
    vi.spyOn(itemTagRepository, 'delete').mockResolvedValue();
    const indexOneMock = vi
      .spyOn(meilisearchWrapper, 'indexOne')
      .mockResolvedValue({} as unknown as EnqueuedTask);
    vi.spyOn(itemPublishedRepository, 'getForItem').mockResolvedValue(null);

    await itemTagService.delete(db, {} as MinimalMember, v4(), v4());

    expect(indexOneMock).not.toHaveBeenCalled();
  });

  it('index item if it is published', async () => {
    vi.spyOn(authorizedItemService, 'getItemById').mockResolvedValue(
      resolveItemType(ItemFactory()),
    );
    vi.spyOn(itemTagRepository, 'delete').mockResolvedValue();
    const indexOneMock = vi
      .spyOn(meilisearchWrapper, 'indexOne')
      .mockResolvedValue({} as unknown as EnqueuedTask);
    vi.spyOn(itemPublishedRepository, 'getForItem').mockResolvedValue(
      {} as ItemPublishedWithItemWithCreator,
    );

    await itemTagService.delete(db, {} as MinimalMember, v4(), v4());

    expect(indexOneMock).toHaveBeenCalled();
  });
});
