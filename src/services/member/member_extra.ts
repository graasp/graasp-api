import type { CompleteMember } from '@graasp/sdk';

export type NotificationFrequency = 'always' | 'never';

export type MemberExtra = CompleteMember['extra'] & {
  emailFreq?: NotificationFrequency;
};
