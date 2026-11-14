import { sql } from 'drizzle-orm';
import { singleton } from 'tsyringe';

import { type DBConnection } from '../../../../drizzle/db';
import type { LearningGoalCompletionRaw, LearningGoalRaw } from '../../../../drizzle/types';
import type { MaybeUser, MinimalGuest, MinimalMember } from '../../../../types';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import {
  InvalidLearningGoalOrder,
  InvalidLearningGoalText,
  LearningGoalLimitReached,
  LearningGoalNotFound,
} from './learningGoal.errors';
import { LearningGoalRepository } from './learningGoal.repository';

const MAX_GOALS = 20;
const MAX_TEXT_LENGTH = 200;

@singleton()
export class LearningGoalService {
  constructor(
    private readonly authorizedItemService: AuthorizedItemService,
    private readonly learningGoalRepository: LearningGoalRepository,
  ) {}

  async getForItem(
    dbConnection: DBConnection,
    account: MaybeUser,
    itemId: string,
  ): Promise<LearningGoalRaw[]> {
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      accountId: account?.id,
      itemId,
    });
    return this.learningGoalRepository.getForItem(dbConnection, itemId);
  }

  async create(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemId: string,
    input: { text: string },
  ): Promise<LearningGoalRaw> {
    await this.assertCanWrite(dbConnection, member.id, itemId);
    await this.lockItemGoals(dbConnection, itemId);
    const goals = await this.learningGoalRepository.getForItem(dbConnection, itemId);
    if (goals.length >= MAX_GOALS) {
      throw new LearningGoalLimitReached();
    }
    return this.learningGoalRepository.create(
      dbConnection,
      itemId,
      this.normalizeText(input.text),
      goals.length,
    );
  }

  async update(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemId: string,
    goalId: string,
    input: { text: string },
  ): Promise<LearningGoalRaw> {
    await this.assertCanWrite(dbConnection, member.id, itemId);
    await this.getGoalOrThrow(dbConnection, itemId, goalId);
    return this.learningGoalRepository.updateText(
      dbConnection,
      goalId,
      this.normalizeText(input.text),
    );
  }

  async delete(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemId: string,
    goalId: string,
  ): Promise<void> {
    await this.assertCanWrite(dbConnection, member.id, itemId);
    await this.lockItemGoals(dbConnection, itemId);
    await this.getGoalOrThrow(dbConnection, itemId, goalId);
    await this.learningGoalRepository.delete(dbConnection, goalId);
    const goals = await this.learningGoalRepository.getForItem(dbConnection, itemId);
    for (const [position, goal] of goals.entries()) {
      await this.learningGoalRepository.updatePosition(dbConnection, goal.id, position);
    }
  }

  async reorder(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemId: string,
    goalIds: string[],
  ): Promise<LearningGoalRaw[]> {
    await this.assertCanWrite(dbConnection, member.id, itemId);
    await this.lockItemGoals(dbConnection, itemId);
    const goals = await this.learningGoalRepository.getForItem(dbConnection, itemId);
    const currentIds = new Set(goals.map(({ id }) => id));
    if (
      goalIds.length !== goals.length ||
      new Set(goalIds).size !== goalIds.length ||
      goalIds.some((id) => !currentIds.has(id))
    ) {
      throw new InvalidLearningGoalOrder();
    }
    for (const [position, id] of goalIds.entries()) {
      await this.learningGoalRepository.updatePosition(dbConnection, id, position);
    }
    return this.learningGoalRepository.getForItem(dbConnection, itemId);
  }

  async getOwnCompletions(
    dbConnection: DBConnection,
    account: MinimalMember | MinimalGuest,
    itemId: string,
  ): Promise<Pick<LearningGoalCompletionRaw, 'goalId' | 'completedAt'>[]> {
    await this.assertCanRead(dbConnection, account.id, itemId);
    return this.learningGoalRepository.getCompletions(dbConnection, itemId, account.id);
  }

  async setCompletion(
    dbConnection: DBConnection,
    account: MinimalMember | MinimalGuest,
    itemId: string,
    goalId: string,
    completed: boolean,
  ): Promise<void> {
    await this.assertCanRead(dbConnection, account.id, itemId);
    await this.getGoalOrThrow(dbConnection, itemId, goalId);
    if (completed) {
      await this.learningGoalRepository.complete(dbConnection, goalId, account.id);
    } else {
      await this.learningGoalRepository.uncomplete(dbConnection, goalId, account.id);
    }
  }

  async copyForItem(
    dbConnection: DBConnection,
    originalItemId: string,
    copyItemId: string,
  ): Promise<void> {
    const goals = await this.learningGoalRepository.getForItem(dbConnection, originalItemId);
    for (const goal of goals) {
      await this.learningGoalRepository.create(dbConnection, copyItemId, goal.text, goal.position);
    }
  }

  private normalizeText(text: string): string {
    const normalized = text.trim();
    if (!normalized || normalized.length > MAX_TEXT_LENGTH) {
      throw new InvalidLearningGoalText();
    }
    return normalized;
  }

  private async getGoalOrThrow(
    dbConnection: DBConnection,
    itemId: string,
    goalId: string,
  ): Promise<LearningGoalRaw> {
    const goal = await this.learningGoalRepository.getForItemById(dbConnection, itemId, goalId);
    if (!goal) {
      throw new LearningGoalNotFound();
    }
    return goal;
  }

  private async assertCanRead(dbConnection: DBConnection, accountId: string, itemId: string) {
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      accountId,
      itemId,
    });
  }

  private async assertCanWrite(dbConnection: DBConnection, accountId: string, itemId: string) {
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      accountId,
      itemId,
      permission: 'write',
    });
  }

  private async lockItemGoals(dbConnection: DBConnection, itemId: string) {
    await dbConnection.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${itemId}))`);
  }
}
