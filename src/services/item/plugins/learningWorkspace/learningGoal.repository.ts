import { and, asc, eq } from 'drizzle-orm';
import { singleton } from 'tsyringe';

import { type DBConnection } from '../../../../drizzle/db';
import { learningGoalCompletionsTable, learningGoalsTable } from '../../../../drizzle/schema';
import type { LearningGoalCompletionRaw, LearningGoalRaw } from '../../../../drizzle/types';

@singleton()
export class LearningGoalRepository {
  async getForItem(dbConnection: DBConnection, itemId: string): Promise<LearningGoalRaw[]> {
    return dbConnection.query.learningGoalsTable.findMany({
      where: eq(learningGoalsTable.itemId, itemId),
      orderBy: asc(learningGoalsTable.position),
    });
  }

  async getForItemById(
    dbConnection: DBConnection,
    itemId: string,
    goalId: string,
  ): Promise<LearningGoalRaw | undefined> {
    return dbConnection.query.learningGoalsTable.findFirst({
      where: and(eq(learningGoalsTable.id, goalId), eq(learningGoalsTable.itemId, itemId)),
    });
  }

  async create(
    dbConnection: DBConnection,
    itemId: string,
    text: string,
    position: number,
  ): Promise<LearningGoalRaw> {
    const [goal] = await dbConnection
      .insert(learningGoalsTable)
      .values({ itemId, text, position })
      .returning();
    if (!goal) {
      throw new Error('Expected learning goal creation to return a row.');
    }
    return goal;
  }

  async updateText(
    dbConnection: DBConnection,
    goalId: string,
    text: string,
  ): Promise<LearningGoalRaw> {
    const [goal] = await dbConnection
      .update(learningGoalsTable)
      .set({ text })
      .where(eq(learningGoalsTable.id, goalId))
      .returning();
    if (!goal) {
      throw new Error('Expected learning goal update to return a row.');
    }
    return goal;
  }

  async delete(dbConnection: DBConnection, goalId: string): Promise<void> {
    await dbConnection.delete(learningGoalsTable).where(eq(learningGoalsTable.id, goalId));
  }

  async updatePosition(
    dbConnection: DBConnection,
    goalId: string,
    position: number,
  ): Promise<void> {
    await dbConnection
      .update(learningGoalsTable)
      .set({ position })
      .where(eq(learningGoalsTable.id, goalId));
  }

  async getCompletions(
    dbConnection: DBConnection,
    itemId: string,
    accountId: string,
  ): Promise<Pick<LearningGoalCompletionRaw, 'goalId' | 'completedAt'>[]> {
    return dbConnection
      .select({
        goalId: learningGoalCompletionsTable.goalId,
        completedAt: learningGoalCompletionsTable.completedAt,
      })
      .from(learningGoalCompletionsTable)
      .innerJoin(learningGoalsTable, eq(learningGoalCompletionsTable.goalId, learningGoalsTable.id))
      .where(
        and(
          eq(learningGoalsTable.itemId, itemId),
          eq(learningGoalCompletionsTable.accountId, accountId),
        ),
      );
  }

  async complete(dbConnection: DBConnection, goalId: string, accountId: string): Promise<void> {
    await dbConnection
      .insert(learningGoalCompletionsTable)
      .values({ goalId, accountId })
      .onConflictDoNothing();
  }

  async uncomplete(dbConnection: DBConnection, goalId: string, accountId: string): Promise<void> {
    await dbConnection
      .delete(learningGoalCompletionsTable)
      .where(
        and(
          eq(learningGoalCompletionsTable.goalId, goalId),
          eq(learningGoalCompletionsTable.accountId, accountId),
        ),
      );
  }
}
