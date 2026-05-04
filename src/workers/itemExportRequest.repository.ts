import { singleton } from 'tsyringe';

import type { DBConnection } from '../drizzle/db.js';
import { itemExportRequestsTable } from '../drizzle/schema.js';
import type { ItemExportRequestRaw } from '../drizzle/types.js';

@singleton()
export class ItemExportRequestRepository {
  /**
   * Create given request export and return it.
   * @param requestExport RequestExport to create
   */
  async create(
    dbConnection: DBConnection,
    requestExport: Omit<ItemExportRequestRaw, 'id' | 'createdAt'>,
  ): Promise<ItemExportRequestRaw> {
    const { memberId, itemId, type } = requestExport;
    const res = await dbConnection
      .insert(itemExportRequestsTable)
      .values({
        memberId,
        itemId,
        type,
      })
      .returning();
    return res[0];
  }
}
