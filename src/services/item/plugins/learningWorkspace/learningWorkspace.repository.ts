import { and, eq, sql } from 'drizzle-orm';
import { singleton } from 'tsyringe';

import { type DBConnection } from '../../../../drizzle/db';
import {
  learningWorkspaceSettingsTable,
  learningWorkspacesTable,
} from '../../../../drizzle/schema';
import type { LearningWorkspaceRaw, LearningWorkspaceSettingRaw } from '../../../../drizzle/types';
import type {
  LearningWorkspacePatch,
  LearningWorkspaceSettingsPatch,
} from './learningWorkspace.types';

@singleton()
export class LearningWorkspaceRepository {
  async getSettings(
    dbConnection: DBConnection,
    itemId: string,
  ): Promise<LearningWorkspaceSettingRaw | undefined> {
    return dbConnection.query.learningWorkspaceSettingsTable.findFirst({
      where: eq(learningWorkspaceSettingsTable.itemId, itemId),
    });
  }

  async upsertSettings(
    dbConnection: DBConnection,
    itemId: string,
    patch: LearningWorkspaceSettingsPatch,
  ): Promise<LearningWorkspaceSettingRaw> {
    const [settings] = await dbConnection
      .insert(learningWorkspaceSettingsTable)
      .values({ itemId, ...patch })
      .onConflictDoUpdate({
        target: learningWorkspaceSettingsTable.itemId,
        set: { ...patch, updatedAt: sql.raw('DEFAULT') },
      })
      .returning();

    if (!settings) {
      throw new Error('Expected the learning workspace settings upsert to return a row.');
    }
    return settings;
  }

  async getOwn(
    dbConnection: DBConnection,
    itemId: string,
    accountId: string,
  ): Promise<LearningWorkspaceRaw | undefined> {
    return dbConnection.query.learningWorkspacesTable.findFirst({
      where: and(
        eq(learningWorkspacesTable.itemId, itemId),
        eq(learningWorkspacesTable.accountId, accountId),
      ),
    });
  }

  async upsert(
    dbConnection: DBConnection,
    itemId: string,
    accountId: string,
    patch: LearningWorkspacePatch,
  ): Promise<LearningWorkspaceRaw> {
    const [workspace] = await dbConnection
      .insert(learningWorkspacesTable)
      .values({ itemId, accountId, ...patch })
      .onConflictDoUpdate({
        target: [learningWorkspacesTable.itemId, learningWorkspacesTable.accountId],
        set: { ...patch, updatedAt: sql.raw('DEFAULT') },
      })
      .returning();

    if (!workspace) {
      throw new Error('Expected the learning workspace upsert to return a row.');
    }
    return workspace;
  }
}
