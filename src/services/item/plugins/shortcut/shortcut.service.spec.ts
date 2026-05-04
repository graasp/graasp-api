import { v4 } from 'uuid';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MOCK_LOGGER } from '../../../../../test/app.vitest.js';
import { ItemFactory } from '../../../../../test/factories/item.factory.js';
import { MemberFactory } from '../../../../../test/factories/member.factory.js';
import { db } from '../../../../drizzle/db.js';
import { AuthorizedItemService } from '../../../authorizedItem.service.js';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository.js';
import { ThumbnailService } from '../../../thumbnail/thumbnail.service.js';
import { ItemRepository } from '../../item.repository.js';
import { PackedItemService } from '../../packedItem.dto.js';
import { ItemGeolocationRepository } from '../geolocation/itemGeolocation.repository.js';
import { ItemVisibilityRepository } from '../itemVisibility/itemVisibility.repository.js';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository.js';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch.js';
import { RecycledBinService } from '../recycled/recycled.service.js';
import { ItemThumbnailService } from '../thumbnail/itemThumbnail.service.js';
import { ShortcutItemService } from './shortcut.service.js';

const MOCK_ITEM = ItemFactory({ type: 'shortcut' });
const MOCK_MEMBER = MemberFactory({ extra: { lang: 'en' } });

const itemRepository = {
  getOneOrThrow: async () => {
    return MOCK_ITEM;
  },
} as unknown as ItemRepository;

const shortcutService = new ShortcutItemService(
  {} as unknown as ThumbnailService,
  {} as unknown as ItemThumbnailService,
  {} as unknown as ItemMembershipRepository,
  {} as MeiliSearchWrapper,
  itemRepository,
  {} as unknown as ItemPublishedRepository,
  {} as unknown as ItemGeolocationRepository,
  {} as unknown as AuthorizedItemService,
  {} as unknown as PackedItemService,
  {} as unknown as ItemVisibilityRepository,
  {} as unknown as RecycledBinService,
  MOCK_LOGGER,
);

describe('Shortcut Service', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('postWithOptions', () => {
    // it('set correct type and extra', async () => {
    //   const itemServicePostMock = jest
    //     .spyOn(ItemService.prototype, 'post')
    //     .mockImplementation(async () => {
    //       return {} as Item;
    //     });
    //   // jest
    //   //   .spyOn(basicItemService, 'get')
    //   //   .mockImplementation(async (_db, _actor, id, _permission) => {
    //   //     return { id } as ItemWithCreator;
    //   //   });

    //   const targetItem = ItemFactory() as ItemWithCreator;
    //   await shortcutService.postWithOptions(db, MOCK_MEMBER, {
    //     target: targetItem.id,
    //     item: { name: 'name', description: 'description' },
    //   });

    //   // expect(itemServicePostMock).toHaveBeenCalledWith(MOCK_MEMBER, {
    //   //   item: {
    //   //     name: 'name',
    //   //     description: 'description',
    //   //     extra: { ['shortcut']: { target: targetItem.id } },
    //   //     type: 'shortcut',
    //   //   },
    //   // });
    // });
    // it('generate default name', async () => {
    //   const itemServicePostMock = jest
    //     .spyOn(ItemService.prototype, 'post')
    //     .mockImplementation(async () => {
    //       return {} as Item;
    //     });
    //   const targetItem = ItemFactory() as ItemWithCreator;
    //   // jest.spyOn(basicItemService, 'get').mockImplementation(async () => {
    //   //   return targetItem;
    //   // });

    //   await shortcutService.postWithOptions(db, MOCK_MEMBER, {
    //     target: targetItem.id,
    //     item: {},
    //   });

    //   expect(itemServicePostMock).toHaveBeenCalledWith();
    //   expect(itemServicePostMock).toHaveBeenCalledWith(MOCK_MEMBER, {
    //     // item: {
    //     // eslint-disable-next-line import/no-named-as-default-member
    //     // name: i18next.t('DEFAULT_SHORTCUT_NAME', {
    //     //   name: targetItem.name,
    //     //   lng: MOCK_MEMBER.lang,
    //     // }),
    //     // description: undefined,
    //     // extra: { ['shortcut']: { target: targetItem.id } },
    //     // type: 'shortcut',
    //     // },
    //   });
    // });
    it('throw if target does not exist', async () => {
      vi.spyOn(AuthorizedItemService.prototype, 'getItemById').mockRejectedValue(new Error());

      await expect(() =>
        shortcutService.postWithOptions(db, MOCK_MEMBER, {
          target: v4(),
          item: { name: 'name', description: 'description' },
        }),
      ).rejects.toThrow();
    });
  });
  describe('patch', () => {
    it('throw if item is not a shortcut', async () => {
      await expect(() =>
        shortcutService.patch(db, MOCK_MEMBER, MOCK_ITEM.id, { name: 'name' }),
      ).rejects.toThrow();
    });
    // it('use item service patch', async () => {
    //   const itemServicePatchMock = jest
    //     .spyOn(ItemService.prototype, 'patch')
    //     .mockImplementation(async () => {
    //       return MOCK_ITEM;
    //     });

    //   await shortcutService.patch(db, MOCK_MEMBER, MOCK_ITEM.id, { name: 'name' });

    //   expect(itemServicePatchMock).toHaveBeenCalledWith(MOCK_MEMBER, MOCK_ITEM.id, {
    //     name: 'name',
    //   });
    // });

    it('Cannot update not found item given id', async () => {
      vi.spyOn(itemRepository, 'getOneOrThrow').mockImplementation(() => {
        throw new Error();
      });

      await expect(() =>
        shortcutService.patch(db, MOCK_MEMBER, v4(), { name: 'name' }),
      ).rejects.toThrow();
    });
  });
});
