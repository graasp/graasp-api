import { Readable } from 'node:stream';
import { singleton } from 'tsyringe';

import { type ItemGeolocation, type UUID } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db.js';
import { BaseLogger } from '../../../../logger.js';
import type {
  MaybeUser,
  MinimalMember,
  PermissionLevel,
} from '../../../../types.js';
import { ItemNotFolder } from '../../../../utils/errors.js';
import { AuthorizedItemService } from '../../../authorizedItem.service.js';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository.js';
import { ThumbnailService } from '../../../thumbnail/thumbnail.service.js';
import { WrongItemTypeError } from '../../errors.js';
import {
  type CapsuleItem,
  type FolderItem,
  type ItemRaw,
  isFolderItem,
} from '../../item.js';
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
export class FolderItemService extends ItemService {
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

  async getFolder(
    dbConnection: DBConnection,
    maybeUser: MaybeUser,
    itemId: ItemRaw['id'],
    permission?: PermissionLevel,
  ): Promise<FolderItem> {
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: maybeUser?.id,
      itemId,
      permission,
    });
    if (!isFolderItem(item)) {
      throw new WrongItemTypeError(item.type);
    }
    return item as FolderItem;
  }

  async postWithOptions(
    dbConnection: DBConnection,
    member: MinimalMember,
    args: {
      item: Partial<Pick<ItemRaw, 'description' | 'settings' | 'lang'>> &
        Pick<ItemRaw, 'name'>;
      parentId?: string;
      geolocation?: Pick<ItemGeolocation, 'lat' | 'lng'>;
      thumbnail?: Readable;
      previousItemId?: ItemRaw['id'];
    },
  ): Promise<FolderItem> {
    return (await super.post(dbConnection, member, {
      ...args,
      item: { ...args.item, type: 'folder', extra: { folder: {} } },
    })) as FolderItem;
  }

  async patch(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemId: UUID,
    body: Partial<Pick<ItemRaw, 'name' | 'description' | 'settings' | 'lang'>>,
  ): Promise<FolderItem> {
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);

    // check item is folder
    if (item.type !== 'folder') {
      throw new WrongItemTypeError(item.type);
    }

    return (await super.patch(
      dbConnection,
      member,
      item.id,
      body,
    )) as FolderItem;
  }

  async convertToCapsule(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemId: UUID,
  ): Promise<CapsuleItem> {
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);

    // check item is folder
    if (item.type !== 'folder') {
      throw new ItemNotFolder({ id: itemId });
    }

    return (await super.patch(dbConnection, member, item.id, {
      extra: { folder: { isCapsule: true } },
    })) as CapsuleItem;
  }
}
