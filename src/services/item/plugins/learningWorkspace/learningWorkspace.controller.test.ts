import { and, eq, ne } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import waitForExpect from 'wait-for-expect';

import type { FastifyInstance } from 'fastify';

import { HttpMethod } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { MULTIPLE_ITEMS_LOADING_TIME } from '../../../../../test/constants';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import {
  accountsTable,
  itemMembershipsTable,
  itemsRawTable,
  learningGoalCompletionsTable,
  learningGoalsTable,
  learningWorkspaceSettingsTable,
  learningWorkspacesTable,
} from '../../../../drizzle/schema';
import { assertIsDefined } from '../../../../utils/assertions';
import { ITEMS_ROUTE_PREFIX } from '../../../../utils/config';

const workspaceUrl = (itemId: string) => `${ITEMS_ROUTE_PREFIX}/${itemId}/learning-workspace`;
const settingsUrl = (itemId: string) =>
  `${ITEMS_ROUTE_PREFIX}/${itemId}/learning-workspace-settings`;
const goalsUrl = (itemId: string) => `${ITEMS_ROUTE_PREFIX}/${itemId}/learning-goals`;
const goalUrl = (itemId: string, goalId: string) => `${goalsUrl(itemId)}/${goalId}`;
const completionsUrl = (itemId: string) =>
  `${ITEMS_ROUTE_PREFIX}/${itemId}/learning-goal-completions`;
const completionUrl = (itemId: string, goalId: string) => `${goalUrl(itemId, goalId)}/completion`;

describe('Learning workspace and goals', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build());
  });

  afterAll(async () => {
    await clearDatabase(db);
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
    unmockAuthenticate();
  });

  describe('private notes workspace', () => {
    it('returns null, upserts notes, and never exposes the account id', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{ memberships: [{ account: 'actor', permission: 'read' }] }],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const initial = await app.inject({
        method: HttpMethod.Get,
        url: workspaceUrl(item.id),
      });
      expect(initial.statusCode).toBe(StatusCodes.OK);
      expect(initial.json()).toBeNull();

      const updated = await app.inject({
        method: HttpMethod.Patch,
        url: workspaceUrl(item.id),
        payload: { notes: 'My private notes' },
      });
      expect(updated.statusCode).toBe(StatusCodes.OK);
      expect(updated.json()).toMatchObject({
        itemId: item.id,
        notes: 'My private notes',
      });
      expect(updated.json()).not.toHaveProperty('accountId');
      expect(updated.json()).not.toHaveProperty('status');
      expect(updated.json()).not.toHaveProperty('checklist');

      const records = await db.query.learningWorkspacesTable.findMany({
        where: eq(learningWorkspacesTable.accountId, actor.id),
      });
      expect(records).toHaveLength(1);
    });

    it.each([
      ['an empty patch', {}],
      ['notes over the limit', { notes: 'a'.repeat(20001) }],
      ['the removed status field', { status: 'completed' }],
      ['the removed checklist field', { checklist: [] }],
    ])('rejects %s', async (_label, payload) => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{ memberships: [{ account: 'actor', permission: 'read' }] }],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: workspaceUrl(item.id),
        payload,
      });
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it('rejects signed-out requests and accounts without read access', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{ creator: { name: 'Someone else' } }],
      });

      const signedOut = await app.inject({
        method: HttpMethod.Get,
        url: workspaceUrl(item.id),
      });
      expect(signedOut.statusCode).toBe(StatusCodes.UNAUTHORIZED);

      assertIsDefined(actor);
      mockAuthenticate(actor);
      const inaccessible = await app.inject({
        method: HttpMethod.Get,
        url: workspaceUrl(item.id),
      });
      expect(inaccessible.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
  });

  describe('shared learning workspace settings', () => {
    it('returns null, upserts rich-text instructions, and allows public reads', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            isPublic: true,
            memberships: [{ account: 'actor', permission: 'write' }],
          },
        ],
      });

      const initial = await app.inject({
        method: HttpMethod.Get,
        url: settingsUrl(item.id),
      });
      expect(initial.statusCode).toBe(StatusCodes.OK);
      expect(initial.json()).toBeNull();

      assertIsDefined(actor);
      mockAuthenticate(actor);
      const instructions = '<p><strong>Read pages 1–5.</strong></p>';
      const updated = await app.inject({
        method: HttpMethod.Patch,
        url: settingsUrl(item.id),
        payload: { instructions },
      });
      expect(updated.statusCode).toBe(StatusCodes.OK);
      expect(updated.json()).toMatchObject({ itemId: item.id, instructions });

      unmockAuthenticate();
      const publicRead = await app.inject({
        method: HttpMethod.Get,
        url: settingsUrl(item.id),
      });
      expect(publicRead.statusCode).toBe(StatusCodes.OK);
      expect(publicRead.json()).toMatchObject({ itemId: item.id, instructions });
    });

    it('supports clearing instructions and rejects invalid updates', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{ memberships: [{ account: 'actor', permission: 'write' }] }],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const cleared = await app.inject({
        method: HttpMethod.Patch,
        url: settingsUrl(item.id),
        payload: { instructions: '' },
      });
      expect(cleared.statusCode).toBe(StatusCodes.OK);
      expect(cleared.json()).toMatchObject({ instructions: '' });

      const atLimit = await app.inject({
        method: HttpMethod.Patch,
        url: settingsUrl(item.id),
        payload: { instructions: 'a'.repeat(5000) },
      });
      expect(atLimit.statusCode).toBe(StatusCodes.OK);

      for (const payload of [{}, { instructions: 'a'.repeat(5001) }]) {
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: settingsUrl(item.id),
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      }
    });

    it('requires write access and rejects item-login guest authoring', async () => {
      const {
        actor,
        guests: [guest],
        items: [item],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: 'read' }],
            itemLoginSchema: { guests: [{}] },
          },
        ],
      });
      assertIsDefined(actor);
      assertIsDefined(guest);

      const signedOut = await app.inject({
        method: HttpMethod.Get,
        url: settingsUrl(item.id),
      });
      expect(signedOut.statusCode).toBe(StatusCodes.FORBIDDEN);

      mockAuthenticate(actor);
      const readOnlyGet = await app.inject({
        method: HttpMethod.Get,
        url: settingsUrl(item.id),
      });
      expect(readOnlyGet.statusCode).toBe(StatusCodes.OK);
      expect(readOnlyGet.json()).toBeNull();

      const readOnly = await app.inject({
        method: HttpMethod.Patch,
        url: settingsUrl(item.id),
        payload: { instructions: 'Cannot update' },
      });
      expect(readOnly.statusCode).toBe(StatusCodes.FORBIDDEN);

      mockAuthenticate(guest);
      const guestGet = await app.inject({
        method: HttpMethod.Get,
        url: settingsUrl(item.id),
      });
      expect(guestGet.statusCode).toBe(StatusCodes.OK);
      expect(guestGet.json()).toBeNull();

      const guestResponse = await app.inject({
        method: HttpMethod.Patch,
        url: settingsUrl(item.id),
        payload: { instructions: 'Cannot update either' },
      });
      expect(guestResponse.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
  });

  describe('teacher-authored goals', () => {
    it('allows signed-out viewers to read ordered goals on a public item', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{ isPublic: true }] });
      await db.insert(learningGoalsTable).values([
        { itemId: item.id, text: 'Second', position: 1 },
        { itemId: item.id, text: 'First', position: 0 },
      ]);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: goalsUrl(item.id),
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.json().map(({ text }: { text: string }) => text)).toEqual([
        'First',
        'Second',
      ]);
    });

    it('supports create, trimmed edit, reorder, and delete with compacted positions', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{ memberships: [{ account: 'actor', permission: 'write' }] }],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const first = await app.inject({
        method: HttpMethod.Post,
        url: goalsUrl(item.id),
        payload: { text: '  Understand the argument  ' },
      });
      const second = await app.inject({
        method: HttpMethod.Post,
        url: goalsUrl(item.id),
        payload: { text: 'Explain the conclusion' },
      });
      expect(first.statusCode).toBe(StatusCodes.CREATED);
      expect(first.json()).toMatchObject({ text: 'Understand the argument', position: 0 });
      expect(second.json()).toMatchObject({ position: 1 });

      const edited = await app.inject({
        method: HttpMethod.Patch,
        url: goalUrl(item.id, first.json().id),
        payload: { text: 'Identify the main argument' },
      });
      expect(edited.statusCode).toBe(StatusCodes.OK);
      expect(edited.json()).toMatchObject({
        id: first.json().id,
        text: 'Identify the main argument',
      });

      const reordered = await app.inject({
        method: HttpMethod.Put,
        url: `${goalsUrl(item.id)}/order`,
        payload: { goalIds: [second.json().id, first.json().id] },
      });
      expect(reordered.statusCode).toBe(StatusCodes.OK);
      expect(reordered.json().map(({ id }: { id: string }) => id)).toEqual([
        second.json().id,
        first.json().id,
      ]);

      const deleted = await app.inject({
        method: HttpMethod.Delete,
        url: goalUrl(item.id, second.json().id),
      });
      expect(deleted.statusCode).toBe(StatusCodes.NO_CONTENT);
      const remaining = await db.query.learningGoalsTable.findMany({
        where: eq(learningGoalsTable.itemId, item.id),
      });
      expect(remaining).toMatchObject([{ id: first.json().id, position: 0 }]);
    });

    it('rejects invalid text, invalid reorder sets, and a 21st goal', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{ memberships: [{ account: 'actor', permission: 'write' }] }],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const whitespace = await app.inject({
        method: HttpMethod.Post,
        url: goalsUrl(item.id),
        payload: { text: '   ' },
      });
      expect(whitespace.statusCode).toBe(StatusCodes.BAD_REQUEST);

      await db.insert(learningGoalsTable).values(
        Array.from({ length: 20 }, (_, position) => ({
          itemId: item.id,
          text: `Goal ${position + 1}`,
          position,
        })),
      );
      const overLimit = await app.inject({
        method: HttpMethod.Post,
        url: goalsUrl(item.id),
        payload: { text: 'One too many' },
      });
      expect(overLimit.statusCode).toBe(StatusCodes.BAD_REQUEST);

      const invalidOrder = await app.inject({
        method: HttpMethod.Put,
        url: `${goalsUrl(item.id)}/order`,
        payload: { goalIds: [] },
      });
      expect(invalidOrder.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it('requires write access and rejects item-login guest authoring', async () => {
      const {
        actor,
        guests: [guest],
        items: [item],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: 'read' }],
            itemLoginSchema: { guests: [{}] },
          },
        ],
      });
      assertIsDefined(actor);
      assertIsDefined(guest);

      mockAuthenticate(actor);
      const readOnly = await app.inject({
        method: HttpMethod.Post,
        url: goalsUrl(item.id),
        payload: { text: 'Cannot add' },
      });
      expect(readOnly.statusCode).toBe(StatusCodes.FORBIDDEN);

      mockAuthenticate(guest);
      const guestResponse = await app.inject({
        method: HttpMethod.Post,
        url: goalsUrl(item.id),
        payload: { text: 'Cannot add either' },
      });
      expect(guestResponse.statusCode).toBe(StatusCodes.FORBIDDEN);
    });

    it('copies goals with new ids but never copies learner data', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{ memberships: [{ account: 'actor', permission: 'admin' }] }],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);
      const originalGoals = await db
        .insert(learningGoalsTable)
        .values([
          { itemId: item.id, text: 'First goal', position: 0 },
          { itemId: item.id, text: 'Second goal', position: 1 },
        ])
        .returning();
      await db.insert(learningWorkspacesTable).values({
        itemId: item.id,
        accountId: actor.id,
        notes: 'Do not copy',
      });
      await db.insert(learningWorkspaceSettingsTable).values({
        itemId: item.id,
        instructions: '<p>Copy these instructions</p>',
      });
      await db.insert(learningGoalCompletionsTable).values({
        goalId: originalGoals[0].id,
        accountId: actor.id,
      });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/copy`,
        query: { id: [item.id] },
        payload: {},
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        const copiedItem = await db.query.itemsRawTable.findFirst({
          where: and(ne(itemsRawTable.id, item.id), eq(itemsRawTable.name, `${item.name} (2)`)),
        });
        assertIsDefined(copiedItem);
        const copiedGoals = await db.query.learningGoalsTable.findMany({
          where: eq(learningGoalsTable.itemId, copiedItem.id),
        });
        expect(copiedGoals.map(({ text, position }) => ({ text, position }))).toEqual([
          { text: 'First goal', position: 0 },
          { text: 'Second goal', position: 1 },
        ]);
        expect(copiedGoals.map(({ id }) => id)).not.toEqual(originalGoals.map(({ id }) => id));
        expect(
          await db.query.learningWorkspaceSettingsTable.findFirst({
            where: eq(learningWorkspaceSettingsTable.itemId, copiedItem.id),
          }),
        ).toMatchObject({ instructions: '<p>Copy these instructions</p>' });
        expect(
          await db.query.learningWorkspacesTable.findMany({
            where: eq(learningWorkspacesTable.itemId, copiedItem.id),
          }),
        ).toHaveLength(0);
        expect(
          await db.query.learningGoalCompletionsTable.findMany({
            where: eq(learningGoalCompletionsTable.goalId, copiedGoals[0].id),
          }),
        ).toHaveLength(0);
      }, MULTIPLE_ITEMS_LOADING_TIME);
    });
  });

  describe('private learner completions', () => {
    it('is idempotent, account-scoped, and retained after goal edits', async () => {
      const {
        actor,
        members: [other],
        items: [item],
      } = await seedFromJson({
        members: [{}],
        items: [
          {
            memberships: [{ account: 'actor', permission: 'admin' }],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsDefined(other);
      await db.insert(itemMembershipsTable).values({
        itemPath: item.path,
        accountId: other.id,
        permission: 'read',
      });
      const [goal] = await db
        .insert(learningGoalsTable)
        .values({ itemId: item.id, text: 'Original text', position: 0 })
        .returning();
      assertIsDefined(goal);

      mockAuthenticate(other);
      const initiallyEmpty = await app.inject({
        method: HttpMethod.Get,
        url: completionsUrl(item.id),
      });
      expect(initiallyEmpty.json()).toEqual([]);

      for (const _ of [0, 1]) {
        const response = await app.inject({
          method: HttpMethod.Put,
          url: completionUrl(item.id, goal.id),
        });
        expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
      }
      expect(
        await db.query.learningGoalCompletionsTable.findMany({
          where: eq(learningGoalCompletionsTable.goalId, goal.id),
        }),
      ).toHaveLength(1);

      mockAuthenticate(actor);
      const teacherOwn = await app.inject({
        method: HttpMethod.Get,
        url: completionsUrl(item.id),
      });
      expect(teacherOwn.json()).toEqual([]);
      await app.inject({
        method: HttpMethod.Patch,
        url: goalUrl(item.id, goal.id),
        payload: { text: 'Edited text' },
      });

      mockAuthenticate(other);
      const learnerOwn = await app.inject({
        method: HttpMethod.Get,
        url: completionsUrl(item.id),
      });
      expect(learnerOwn.json()).toMatchObject([{ goalId: goal.id }]);

      for (const _ of [0, 1]) {
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: completionUrl(item.id, goal.id),
        });
        expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
      }
      expect(
        await db.query.learningGoalCompletionsTable.findMany({
          where: eq(learningGoalCompletionsTable.goalId, goal.id),
        }),
      ).toHaveLength(0);
    });

    it('supports item-login guests and rejects a goal from another item', async () => {
      const {
        guests: [guest],
        items: [item, otherItem],
      } = await seedFromJson({
        actor: null,
        items: [{ itemLoginSchema: { guests: [{}] } }, { isPublic: true }],
      });
      assertIsDefined(guest);
      const [ownGoal, otherGoal] = await db
        .insert(learningGoalsTable)
        .values([
          { itemId: item.id, text: 'Guest goal', position: 0 },
          { itemId: otherItem.id, text: 'Other item goal', position: 0 },
        ])
        .returning();
      assertIsDefined(ownGoal);
      assertIsDefined(otherGoal);
      mockAuthenticate(guest);

      const completed = await app.inject({
        method: HttpMethod.Put,
        url: completionUrl(item.id, ownGoal.id),
      });
      expect(completed.statusCode).toBe(StatusCodes.NO_CONTENT);

      const response = await app.inject({
        method: HttpMethod.Put,
        url: completionUrl(item.id, otherGoal.id),
      });
      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    });

    it('cascades private learner data with accounts and shared data with items', async () => {
      const {
        actor,
        members: [other],
        items: [item],
      } = await seedFromJson({ members: [{}], items: [{}] });
      assertIsDefined(actor);
      assertIsDefined(other);
      const [goal] = await db
        .insert(learningGoalsTable)
        .values({ itemId: item.id, text: 'Cascade goal', position: 0 })
        .returning();
      assertIsDefined(goal);
      await db.insert(learningGoalCompletionsTable).values([
        { goalId: goal.id, accountId: actor.id },
        { goalId: goal.id, accountId: other.id },
      ]);
      await db.insert(learningWorkspacesTable).values([
        { itemId: item.id, accountId: actor.id, notes: 'Actor notes' },
        { itemId: item.id, accountId: other.id, notes: 'Other notes' },
      ]);
      await db.insert(learningWorkspaceSettingsTable).values({
        itemId: item.id,
        instructions: 'Cascade instructions',
      });

      await db.delete(accountsTable).where(eq(accountsTable.id, other.id));
      expect(
        await db.query.learningGoalCompletionsTable.findMany({
          where: eq(learningGoalCompletionsTable.goalId, goal.id),
        }),
      ).toHaveLength(1);
      expect(
        await db.query.learningWorkspacesTable.findMany({
          where: eq(learningWorkspacesTable.itemId, item.id),
        }),
      ).toHaveLength(1);

      await db.delete(itemsRawTable).where(eq(itemsRawTable.id, item.id));
      expect(
        await db.query.learningGoalsTable.findFirst({
          where: eq(learningGoalsTable.id, goal.id),
        }),
      ).toBeUndefined();
      expect(
        await db.query.learningGoalCompletionsTable.findMany({
          where: eq(learningGoalCompletionsTable.goalId, goal.id),
        }),
      ).toHaveLength(0);
      expect(
        await db.query.learningWorkspaceSettingsTable.findFirst({
          where: eq(learningWorkspaceSettingsTable.itemId, item.id),
        }),
      ).toBeUndefined();
      expect(
        await db.query.learningWorkspacesTable.findMany({
          where: eq(learningWorkspacesTable.itemId, item.id),
        }),
      ).toHaveLength(0);
    });
  });
});
