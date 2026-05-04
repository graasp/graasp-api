import { ItemValidationStatus } from '@graasp/sdk';

import { registerValue } from '../../../../../../di/utils.js';
import type { DBConnection } from '../../../../../../drizzle/db.js';
import type { ItemValidationGroupRaw } from '../../../../../../drizzle/types.js';
import type { ItemRaw } from '../../../../item.js';
import { ItemValidationRepository } from '../itemValidation.repository.js';
import { ItemValidationReviewRepository } from '../itemValidationReview.repository.js';
import { ItemValidationModerator } from '../moderators/itemValidationModerator.js';
import { StrategyExecutorFactory } from '../moderators/strategyExecutorFactory.js';

export type ItemModeratorValidate = (
  dbConnection: DBConnection,
  itemToValidate: ItemRaw,
  itemValidationGroupId: ItemValidationGroupRaw['id'],
) => Promise<ItemValidationStatus[]>;

class StubItemModerator extends ItemValidationModerator {
  constructor(private readonly validateImpl: ItemModeratorValidate) {
    super(
      {} as StrategyExecutorFactory,
      {} as ItemValidationRepository,
      {} as ItemValidationReviewRepository,
    );
  }

  async validate(
    dbConnection: DBConnection,
    itemToValidate: ItemRaw,
    itemValidationGroupId: ItemValidationGroupRaw['id'],
  ) {
    return await this.validateImpl(dbConnection, itemToValidate, itemValidationGroupId);
  }
}

export const stubItemModerator = (validateImpl: ItemModeratorValidate) => {
  registerValue(ItemValidationModerator, new StubItemModerator(validateImpl));
};
