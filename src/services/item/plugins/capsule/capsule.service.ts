import { singleton } from 'tsyringe';

import type { UUID } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db.js';
import { BaseLogger } from '../../../../logger.js';
import type { MinimalMember } from '../../../../types.js';
import { ItemNotFolder } from '../../../../utils/errors.js';
import { AuthorizedItemService } from '../../../authorizedItem.service.js';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository.js';
import { ThumbnailService } from '../../../thumbnail/thumbnail.service.js';
import type { CapsuleItem, FolderItem, ItemRaw } from '../../item.js';
import { ItemRepository } from '../../item.repository.js';
import { ItemService } from '../../item.service.js';
import { PackedItemService } from '../../packedItem.dto.js';
import { ItemGeolocationRepository } from '../geolocation/itemGeolocation.repository.js';
import { ItemVisibilityRepository } from '../itemVisibility/itemVisibility.repository.js';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository.js';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch.js';
import { RecycledBinService } from '../recycled/recycled.service.js';
import { ItemThumbnailService } from '../thumbnail/itemThumbnail.service.js';

@singleton()
export class CapsuleItemService extends ItemService {
  constructor(
    thumbnailService: ThumbnailService,
    itemThumbnailService: ItemThumbnailService,
    itemMembershipRepository: ItemMembershipRepository,
    meilisearchWrapper: MeiliSearchWrapper,
    itemRepository: ItemRepository,
    itemPublishedRepository: ItemPublishedRepository,
    itemGeolocationRepository: ItemGeolocationRepository,
    authorizedItemService: AuthorizedItemService,
    itemWrapperService: PackedItemService,
    itemVisibilityRepository: ItemVisibilityRepository,
    recycledBinService: RecycledBinService,
    log: BaseLogger,
  ) {
    super(
      thumbnailService,
      itemThumbnailService,
      itemMembershipRepository,
      meilisearchWrapper,
      itemRepository,
      itemPublishedRepository,
      itemGeolocationRepository,
      authorizedItemService,
      itemWrapperService,
      itemVisibilityRepository,
      recycledBinService,
      log,
    );
  }

  async create(
    dbConnection: DBConnection,
    member: MinimalMember,
    args: {
      item: Partial<Pick<ItemRaw, 'description' | 'settings' | 'lang'>> &
        Pick<ItemRaw, 'name'>;
      parentId?: string;
      previousItemId?: ItemRaw['id'];
    },
  ): Promise<CapsuleItem> {
    return (await super.post(dbConnection, member, {
      ...args,
      item: {
        ...args.item,
        type: 'folder',
        extra: { folder: { isCapsule: true } },
      },
    })) as CapsuleItem;
  }

  async convertToFolder(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemId: UUID,
  ): Promise<FolderItem> {
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);

    // check item is folder
    if (item.type !== 'folder') {
      throw new ItemNotFolder({ id: itemId });
    }

    return (await super.patch(dbConnection, member, item.id, {
      extra: { folder: { isCapsule: false } },
    })) as FolderItem;
  }
}
