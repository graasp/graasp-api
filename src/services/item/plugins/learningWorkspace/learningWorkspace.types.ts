import type { LearningWorkspaceRaw, LearningWorkspaceSettingRaw } from '../../../../drizzle/types';

export type LearningWorkspacePatch = Partial<Pick<LearningWorkspaceRaw, 'notes'>>;

export type LearningWorkspace = Omit<LearningWorkspaceRaw, 'accountId'>;

export type LearningWorkspaceSettingsPatch = Pick<LearningWorkspaceSettingRaw, 'instructions'>;
