import { v4 } from 'uuid';
import { describe, expect, it, vi } from 'vitest';

import { ItemFactory } from '../../../../../test/factories/item.factory';
import { MemberFactory } from '../../../../../test/factories/member.factory';
import type { DBConnection } from '../../../../drizzle/db';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { ItemVisibilityRepository } from '../itemVisibility/itemVisibility.repository';
import { ItemThumbnailService } from '../thumbnail/itemThumbnail.service';
import { ItemBookmarkRepository } from './itemBookmark.repository';
import { BookmarkService } from './itemBookmark.service';

const dbConnection = {} as DBConnection;

describe('BookmarkService', () => {
  describe('getOwn', () => {
    it('returns packed bookmarked items with thumbnail URLs', async () => {
      const member = MemberFactory();
      const itemWithThumbnail = ItemFactory({ settings: { hasThumbnail: true } });
      const itemWithoutThumbnail = ItemFactory({ settings: { hasThumbnail: false } });
      const thumbnailUrls = {
        [itemWithThumbnail.id]: {
          small: 'https://example.com/small-thumbnail',
          medium: 'https://example.com/medium-thumbnail',
        },
      };
      const bookmarks = [
        {
          id: v4(),
          itemId: itemWithThumbnail.id,
          memberId: member.id,
          createdAt: new Date().toISOString(),
          item: itemWithThumbnail,
        },
        {
          id: v4(),
          itemId: itemWithoutThumbnail.id,
          memberId: member.id,
          createdAt: new Date().toISOString(),
          item: itemWithoutThumbnail,
        },
      ];

      const itemBookmarkRepository = {
        getBookmarksForMember: vi.fn().mockResolvedValue(bookmarks),
      } as unknown as ItemBookmarkRepository;
      const itemMembershipRepository = {
        getForManyItems: vi.fn().mockResolvedValue({
          data: {
            [itemWithThumbnail.id]: [{ permission: 'read' }],
            [itemWithoutThumbnail.id]: [{ permission: 'read' }],
          },
          errors: [],
        }),
      } as unknown as ItemMembershipRepository;
      const itemVisibilityRepository = {
        getManyForMany: vi.fn().mockResolvedValue({
          data: {
            [itemWithThumbnail.id]: [],
            [itemWithoutThumbnail.id]: [],
          },
          errors: [],
        }),
      } as unknown as ItemVisibilityRepository;
      const itemThumbnailService = {
        getUrlsByItems: vi.fn().mockResolvedValue(thumbnailUrls),
      } as unknown as ItemThumbnailService;

      const service = new BookmarkService(
        {} as AuthorizedItemService,
        itemBookmarkRepository,
        itemMembershipRepository,
        itemVisibilityRepository,
        itemThumbnailService,
      );

      const result = await service.getOwn(dbConnection, member);

      expect(itemThumbnailService.getUrlsByItems).toHaveBeenCalledWith([
        itemWithThumbnail,
        itemWithoutThumbnail,
      ]);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: bookmarks[0].id,
        createdAt: bookmarks[0].createdAt,
        item: {
          id: itemWithThumbnail.id,
          thumbnails: thumbnailUrls[itemWithThumbnail.id],
        },
      });
      expect(result[1]).toMatchObject({
        id: bookmarks[1].id,
        createdAt: bookmarks[1].createdAt,
        item: {
          id: itemWithoutThumbnail.id,
        },
      });
      expect(result[1].item).not.toHaveProperty('thumbnails');
    });
  });
});
