import { v4 } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppItemFactory } from '@graasp/sdk';

import { MOCK_LOGGER } from '../../../../../test/app.vitest.js';
import { ItemFactory } from '../../../../../test/factories/item.factory.js';
import { db } from '../../../../drizzle/db.js';
import type { ItemWithCreator } from '../../../../drizzle/types.js';
import type { MinimalMember } from '../../../../types.js';
import { ItemNotFound } from '../../../../utils/errors.js';
import { AuthorizedItemService } from '../../../authorizedItem.service.js';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository.js';
import { ThumbnailService } from '../../../thumbnail/thumbnail.service.js';
import { WrongItemTypeError } from '../../errors.js';
import { ItemRepository } from '../../item.repository.js';
import { PackedItemService } from '../../packedItem.dto.js';
import { ItemGeolocationRepository } from '../geolocation/itemGeolocation.repository.js';
import { ItemVisibilityRepository } from '../itemVisibility/itemVisibility.repository.js';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository.js';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch.js';
import { RecycledBinService } from '../recycled/recycled.service.js';
import { ItemThumbnailService } from '../thumbnail/itemThumbnail.service.js';
import { FolderItemService } from './folder.service.js';

const itemRepository = {
  getOneOrThrow: vi.fn(async () => {
    return MOCK_ITEM;
  }),
};
const authorizedItemService = {
  getItemById: vi.fn(),
};
const folderService = new FolderItemService(
  {} as ThumbnailService,
  {} as ItemThumbnailService,
  {} as ItemMembershipRepository,
  {} as MeiliSearchWrapper,
  itemRepository as unknown as ItemRepository,
  {} as ItemPublishedRepository,
  {} as ItemGeolocationRepository,
  authorizedItemService as unknown as AuthorizedItemService,
  {} as PackedItemService,
  {} as ItemVisibilityRepository,
  {} as RecycledBinService,
  MOCK_LOGGER,
);
const MOCK_ITEM = ItemFactory();

const MOCK_MEMBER = {} as MinimalMember;

describe('Folder Service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  // afterEach(() => {
  //   // vi.clearAllMocks();
  // });

  describe('get', () => {
    // it('return folder', async () => {
    //   const folderItem = FolderItemFactory() as ItemWithCreator;
    //   const itemServicePostMock = jest
    //     .spyOn(BasicItemService.prototype, 'get')
    //     .mockImplementation(async () => {
    //       return folderItem;
    //     });

    //   expect(await folderService.getFolder(db, MOCK_MEMBER, folderItem.id)).toEqual(folderItem);

    //   expect(itemServicePostMock).toHaveBeenCalledWith(
    //     db,
    //     MOCK_MEMBER,

    //     folderItem.id,
    //     undefined,
    //   );
    // });

    // it('return folder for permission', async () => {
    //   const permission = "write";
    //   const folderItem = FolderItemFactory() as ItemWithCreator;
    //   const itemServicePostMock = jest
    //     .spyOn(BasicItemService.prototype, 'get')
    //     .mockImplementation(async () => {
    //       return folderItem;
    //     });

    //   expect(await folderService.getFolder(db, MOCK_MEMBER, folderItem.id, permission)).toEqual(
    //     folderItem,
    //   );

    //   expect(itemServicePostMock).toHaveBeenCalledWith(
    //     db,
    //     MOCK_MEMBER,

    //     folderItem.id,
    //     permission,
    //   );
    // });

    it('throw if item is not a folder', async () => {
      const appItem = AppItemFactory() as ItemWithCreator;
      authorizedItemService.getItemById.mockImplementation(async () => {
        return appItem;
      });

      await expect(() => folderService.getFolder(db, MOCK_MEMBER, appItem.id)).rejects.toThrow(
        new WrongItemTypeError('app'),
      );
    });
  });

  // describe('post', () => {
  // it('set correct type and extra', async () => {
  //   const itemServicePostMock = jest
  //     .spyOn(ItemService.prototype, 'post')
  //     .mockImplementation(async () => {
  //       return {} as Item;
  //     });
  //   await folderService.post(db, MOCK_MEMBER, { item: { name: 'name', type: 'folder' } });
  //   expect(itemServicePostMock).toHaveBeenCalledWith(db, MOCK_MEMBER, {
  //     item: { name: 'name', extra: { ['folder']: {} }, type: 'folder' },
  //   });
  // });
  // });

  describe('patch', () => {
    it('throw if item is not a folder', async () => {
      const appItem = AppItemFactory() as ItemWithCreator;
      itemRepository.getOneOrThrow.mockImplementation(async () => {
        return appItem;
      });
      await expect(() =>
        folderService.patch(db, MOCK_MEMBER, MOCK_ITEM.id, { name: 'name' }),
      ).rejects.toThrow(new WrongItemTypeError('app'));
    });
    // it('use item service patch', async () => {
    //   const itemServicePatchMock = jest
    //     .spyOn(ItemService.prototype, 'patch')
    //     .mockImplementation(async () => {
    //       return MOCK_ITEM;
    //     });

    //   await folderService.patch(db, MOCK_MEMBER, MOCK_ITEM.id, { name: 'name' });

    //   expect(itemServicePatchMock).toHaveBeenCalledWith(MOCK_MEMBER, MOCK_ITEM.id, {
    //     name: 'name',
    //   });
    // });

    it('Cannot update not found item given id', async () => {
      const id = v4();
      itemRepository.getOneOrThrow.mockImplementation(() => {
        throw new ItemNotFound(id);
      });

      await expect(() =>
        folderService.patch(db, MOCK_MEMBER, id, { name: 'name' }),
      ).rejects.toThrow(new ItemNotFound(id));
    });
  });
});
