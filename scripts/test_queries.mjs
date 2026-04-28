import { config } from 'dotenv';
import { and, asc, eq, isNotNull, ne, or, sql } from 'drizzle-orm';
import 'reflect-metadata';

import { db } from '../dist/drizzle/db.js';
import { isAncestorOrSelf } from '../dist/drizzle/operations.js';
import { itemMembershipsTable, itemVisibilitiesTable, items } from '../dist/drizzle/schema.js';

// prettier-ignore
config({ path: '.env.development', override: true });

async function main() {
  const dbConnection = db;

  const item = {
    path: '1e3177bf_4df5_49b0_8ab8_26bf2e0a9d85.a1bbbb72_1f70_4bd4_964f_915a72835c8a',
    id: 'a1bbbb72-1f70-4bd4-964f-915a72835c8a',
  };
  const user = { id: '63a1c2b0-5e38-4ba3-a096-13b5f7576d54' };

  // const andConditions = [eq(itemMembershipsTable.accountId, accountId)];
  // const memberships = await dbConnection
  //   .select()
  //   .from(itemMembershipsTable)
  //   .innerJoin(
  //     itemsRawTable,
  //     and(
  //       eq(itemMembershipsTable.itemPath, itemsRawTable.path),
  //       isAncestorOrSelf(itemMembershipsTable.itemPath, itemPath),
  //     ),
  //   )
  //   .innerJoin(accountsTable, eq(itemMembershipsTable.accountId, accountsTable.id))
  //   .where(and(...andConditions))
  //   .orderBy(desc(sql`nlevel(${itemMembershipsTable.itemPath})`));

  // getParentsForAccount
  const itemTree = await dbConnection
    .select({ id: items.id, name: items.name, path: items.path })
    .from(items)
    .where(and(isAncestorOrSelf(items.path, item.path), ne(items.id, item.id)))
    .as('item_tree');

  const imTree = dbConnection
    .select()
    .from(itemMembershipsTable)
    .where(
      and(
        isAncestorOrSelf(itemMembershipsTable.itemPath, item.path),
        eq(itemMembershipsTable.accountId, user.id),
        ne(itemMembershipsTable.itemPath, item.path),
      ),
    )
    .as('im_tree');

  const publicTree = dbConnection
    .select()
    .from(itemVisibilitiesTable)
    .where(
      and(
        isAncestorOrSelf(itemVisibilitiesTable.itemPath, item.path),
        ne(itemVisibilitiesTable.itemPath, item.path),
        eq(itemVisibilitiesTable.type, 'public'),
      ),
    )
    .as('is_public');

  const conditions = or(
    eq(imTree.permission, 'admin'),
    eq(imTree.permission, 'write'),
    eq(imTree.permission, 'read'),
    isNotNull(publicTree.type),
  );

  // duplicate can happen if there are multiple public visibilities or memberships in the tree
  const parents = dbConnection
    .selectDistinctOn([itemTree.id], {
      id: itemTree.id,
      name: itemTree.name,
      path: itemTree.path,
    })
    .from(itemTree)
    .leftJoin(imTree, isAncestorOrSelf(imTree.itemPath, itemTree.path))
    .leftJoin(publicTree, isAncestorOrSelf(publicTree.itemPath, itemTree.path))
    .where(conditions)
    .as('parents');

  return await dbConnection
    .select()
    .from(parents)
    .orderBy(asc(sql`nlevel(path)`));
}

main();
