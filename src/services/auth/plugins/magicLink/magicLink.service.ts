import { singleton } from 'tsyringe';

import { ActionTriggers } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db.js';
import { BaseLogger } from '../../../../logger.js';
import type { MemberInfo } from '../../../../types.js';
import { MemberNotSignedUp } from '../../../../utils/errors.js';
import { ActionRepository } from '../../../action/action.repository.js';
import { View } from '../../../item/plugins/action/itemAction.schemas.js';
import { MemberRepository } from '../../../member/member.repository.js';
import { AuthService } from '../../auth.service.js';

@singleton()
export class MagicLinkService {
  private readonly log: BaseLogger;
  private readonly authService: AuthService;
  private readonly memberRepository: MemberRepository;
  private readonly actionRepository: ActionRepository;

  constructor(
    authService: AuthService,
    log: BaseLogger,
    memberRepository: MemberRepository,
    actionRepository: ActionRepository,
  ) {
    this.authService = authService;
    this.memberRepository = memberRepository;
    this.actionRepository = actionRepository;
    this.log = log;
  }

  async sendRegisterMail(member: MemberInfo, url?: string) {
    await this.authService.generateRegisterLinkAndEmailIt(member, { url });
  }

  async login(
    dbConnection: DBConnection,
    body: { email: string },
    url?: string,
  ) {
    const { email } = body;
    const member = await this.memberRepository.getByEmail(dbConnection, email);

    if (member) {
      await this.authService.generateLoginLinkAndEmailIt(
        member.toMemberInfo(),
        { url },
      );
      const actions = [
        {
          creatorId: member.id,
          type: ActionTriggers.MemberLogin,
          view: View.Unknown,
          extra: { type: 'email' },
        },
      ];
      await this.actionRepository.postMany(dbConnection, actions);
    } else {
      this.log.warn(`Login attempt with non-existent email '${email}'`);
      throw new MemberNotSignedUp({ email });
    }
  }
}
