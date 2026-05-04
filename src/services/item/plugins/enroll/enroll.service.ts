import { singleton } from 'tsyringe';

import { ItemLoginSchemaStatus, type UUID } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db.js';
import type { MinimalMember } from '../../../../types.js';
import { AuthorizedItemService } from '../../../authorizedItem.service.js';
import {
  CannotEnrollFrozenItemLoginSchema,
  CannotEnrollItemWithoutItemLoginSchema,
} from '../../../itemLogin/errors.js';
import { ItemLoginService } from '../../../itemLogin/itemLogin.service.js';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository.js';
import { ItemMembershipAlreadyExists } from '../../../itemMembership/plugins/MembershipRequest/error.js';
import { ItemRepository } from '../../item.repository.js';

@singleton()
export class EnrollService {
  private readonly itemLoginService: ItemLoginService;
  private readonly itemRepository: ItemRepository;
  private readonly authorizedItemService: AuthorizedItemService;
  private readonly itemMembershipRepository: ItemMembershipRepository;

  constructor(
    itemLoginService: ItemLoginService,
    itemRepository: ItemRepository,
    authorizedItemService: AuthorizedItemService,
    itemMembershipRepository: ItemMembershipRepository,
  ) {
    this.itemLoginService = itemLoginService;
    this.itemRepository = itemRepository;
    this.authorizedItemService = authorizedItemService;
    this.itemMembershipRepository = itemMembershipRepository;
  }

  async enroll(dbConnection: DBConnection, member: MinimalMember, itemId: UUID) {
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);

    const itemLoginSchema = await this.itemLoginService.getByItemPath(dbConnection, item.path);
    if (!itemLoginSchema || itemLoginSchema.status === ItemLoginSchemaStatus.Disabled) {
      throw new CannotEnrollItemWithoutItemLoginSchema();
    } else if (itemLoginSchema.status === ItemLoginSchemaStatus.Freeze) {
      throw new CannotEnrollFrozenItemLoginSchema();
    }

    // Check if the member already has an permission over the item, if so, throw an error
    if (
      await this.authorizedItemService.hasPermission(dbConnection, {
        permission: 'read',
        accountId: member.id,
        item,
      })
    ) {
      throw new ItemMembershipAlreadyExists();
    }

    await this.itemMembershipRepository.addOne(dbConnection, {
      itemPath: item.path,
      permission: 'read',
      accountId: member.id,
      creatorId: member.id,
    });
  }
}
