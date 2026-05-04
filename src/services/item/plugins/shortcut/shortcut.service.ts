import { singleton } from 'tsyringe';

import { type DBConnection } from '../../../../drizzle/db.js';
import i18next from '../../../../i18n.js';
import { BaseLogger } from '../../../../logger.js';
import { type MinimalMember } from '../../../../types.js';
import { AuthorizedItemService } from '../../../authorizedItem.service.js';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository.js';
import { ThumbnailService } from '../../../thumbnail/thumbnail.service.js';
import { WrongItemTypeError } from '../../errors.js';
import { type ItemRaw, type ShortcutItem, isShortcutItem } from '../../item.js';
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
export class ShortcutItemService extends ItemService {
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

  async postWithOptions(
    dbConnection: DBConnection,
    member: MinimalMember,
    args: {
      item: Partial<Pick<ItemRaw, 'description' | 'name'>>;
      target: ItemRaw['id'];
      parentId?: string;
      previousItemId?: ItemRaw['id'];
    },
  ): Promise<ShortcutItem> {
    const { target, item, ...properties } = args;
    const { description, name: definedName } = item;

    const targetItem = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: member.id,
      itemId: target,
    });

    // generate name from target item if not defined
    const name =
      definedName ??
      i18next.t('DEFAULT_SHORTCUT_NAME', {
        name: targetItem.name,
        lng: member.lang,
      });

    return (await super.post(dbConnection, member, {
      ...properties,
      item: {
        name,
        description,
        type: 'shortcut',
        extra: { shortcut: { target } },
      },
    })) as ShortcutItem;
  }

  async patch(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemId: ItemRaw['id'],
    body: Partial<Pick<ItemRaw, 'name' | 'description'>>,
  ): Promise<ShortcutItem> {
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);

    // check item is shortcut
    if (!isShortcutItem(item)) {
      throw new WrongItemTypeError(item.type);
    }

    const { name, description } = body;

    return (await super.patch(dbConnection, member, item.id, {
      name,
      description,
    })) as ShortcutItem;
  }
}
