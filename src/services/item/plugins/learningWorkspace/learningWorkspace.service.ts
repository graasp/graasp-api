import { singleton } from 'tsyringe';

import { type DBConnection } from '../../../../drizzle/db';
import type { LearningWorkspaceRaw, LearningWorkspaceSettingRaw } from '../../../../drizzle/types';
import type { MaybeUser, MinimalGuest, MinimalMember } from '../../../../types';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { LearningWorkspaceRepository } from './learningWorkspace.repository';
import type {
  LearningWorkspace,
  LearningWorkspacePatch,
  LearningWorkspaceSettingsPatch,
} from './learningWorkspace.types';

const removeAccountId = ({ accountId: _accountId, ...workspace }: LearningWorkspaceRaw) =>
  workspace;

@singleton()
export class LearningWorkspaceService {
  constructor(
    private readonly authorizedItemService: AuthorizedItemService,
    private readonly learningWorkspaceRepository: LearningWorkspaceRepository,
  ) {}

  async getSettings(
    dbConnection: DBConnection,
    account: MaybeUser,
    itemId: string,
  ): Promise<LearningWorkspaceSettingRaw | null> {
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      accountId: account?.id,
      itemId,
    });
    return (await this.learningWorkspaceRepository.getSettings(dbConnection, itemId)) ?? null;
  }

  async updateSettings(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemId: string,
    patch: LearningWorkspaceSettingsPatch,
  ): Promise<LearningWorkspaceSettingRaw> {
    await this.assertCanWrite(dbConnection, member.id, itemId);
    return this.learningWorkspaceRepository.upsertSettings(dbConnection, itemId, patch);
  }

  async copySettingsForItem(
    dbConnection: DBConnection,
    originalItemId: string,
    copyItemId: string,
  ): Promise<void> {
    const settings = await this.learningWorkspaceRepository.getSettings(
      dbConnection,
      originalItemId,
    );
    if (settings) {
      await this.learningWorkspaceRepository.upsertSettings(dbConnection, copyItemId, {
        instructions: settings.instructions,
      });
    }
  }

  async getOwn(
    dbConnection: DBConnection,
    account: MinimalMember | MinimalGuest,
    itemId: string,
  ): Promise<LearningWorkspace | null> {
    await this.assertCanRead(dbConnection, account.id, itemId);
    const workspace = await this.learningWorkspaceRepository.getOwn(
      dbConnection,
      itemId,
      account.id,
    );
    return workspace ? removeAccountId(workspace) : null;
  }

  async patchOwn(
    dbConnection: DBConnection,
    account: MinimalMember | MinimalGuest,
    itemId: string,
    patch: LearningWorkspacePatch,
  ): Promise<LearningWorkspace> {
    await this.assertCanRead(dbConnection, account.id, itemId);
    const workspace = await this.learningWorkspaceRepository.upsert(
      dbConnection,
      itemId,
      account.id,
      patch,
    );
    return removeAccountId(workspace);
  }

  private async assertCanRead(dbConnection: DBConnection, accountId: string, itemId: string) {
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      accountId,
      itemId,
      permission: 'read',
    });
  }

  private async assertCanWrite(dbConnection: DBConnection, accountId: string, itemId: string) {
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      accountId,
      itemId,
      permission: 'write',
    });
  }
}
