import { singleton } from 'tsyringe';

import {
  LOGIN_TOKEN_EXPIRATION_IN_MINUTES,
  REGISTER_TOKEN_EXPIRATION_IN_MINUTES,
} from '../../config/secrets.js';
import { signAccessToken } from '../../crypto/jwt.js';
import { TRANSLATIONS } from '../../langs/constants.js';
import { BaseLogger } from '../../logger.js';
import { MailBuilder } from '../../plugins/mailer/builder.js';
import { MailerService } from '../../plugins/mailer/mailer.service.js';
import type { MemberInfo } from '../../types.js';
import { PUBLIC_URL } from '../../utils/config.js';
import { SHORT_TOKEN_PARAM } from './plugins/passport/constants.js';
import { getRedirectionLink } from './utils.js';

@singleton()
export class AuthService {
  private readonly log: BaseLogger;
  private readonly mailerService: MailerService;

  constructor(mailerService: MailerService, log: BaseLogger) {
    this.mailerService = mailerService;
    this.log = log;
  }

  public async generateRegisterLinkAndEmailIt(
    member: MemberInfo,
    options: { challenge?: string; url?: string } = {},
  ): Promise<void> {
    const { challenge, url } = options;

    // generate token with member info and expiration
    const token = await signAccessToken(
      { sub: member.id, challenge, emailValidation: true },
      'register',
      `${REGISTER_TOKEN_EXPIRATION_IN_MINUTES}m`,
    );

    const redirectionUrl = getRedirectionLink(this.log, url);
    const domain = PUBLIC_URL;
    const destination = new URL('/api/auth', domain);
    destination.searchParams.set(SHORT_TOKEN_PARAM, token);
    destination.searchParams.set('url', redirectionUrl);
    const link = destination.toString();

    const mail = new MailBuilder({
      subject: { text: TRANSLATIONS.SIGN_UP_TITLE },
      lang: member.lang,
    })
      .addText(TRANSLATIONS.GREETINGS)
      .addText(TRANSLATIONS.SIGN_UP_TEXT)
      .addButton(TRANSLATIONS.SIGN_UP_BUTTON_TEXT, link)
      .addUserAgreement()
      .addIgnoreEmailIfNotRequestedNotice()
      .build();

    // don't wait for mailerService's response; log error and link if it fails.
    this.mailerService
      .send(mail, member.email)
      .catch((err) => this.log.warn(`mailerService failed with ${err.message}. link: ${link}`));
  }

  public async generateLoginLinkAndEmailIt(
    member: MemberInfo,
    options: { challenge?: string; url?: string } = {},
  ): Promise<void> {
    const { challenge, url } = options;

    // generate token with member info and expiration
    const token = await signAccessToken(
      { sub: member.id, challenge, emailValidation: true },
      'login',
      `${LOGIN_TOKEN_EXPIRATION_IN_MINUTES}m`,
    );

    const redirectionUrl = getRedirectionLink(this.log, url);
    const domain = PUBLIC_URL;
    const destination = new URL('/api/auth', domain);
    destination.searchParams.set(SHORT_TOKEN_PARAM, token);
    destination.searchParams.set('url', redirectionUrl);
    const link = destination.toString();

    const mail = new MailBuilder({
      subject: { text: TRANSLATIONS.SIGN_IN_TITLE },
      lang: member.lang,
    })
      .addText(TRANSLATIONS.SIGN_IN_TEXT)
      .addButton(TRANSLATIONS.SIGN_IN_BUTTON_TEXT, link)
      .addIgnoreEmailIfNotRequestedNotice()
      .build();

    // don't wait for mailerService's response; log error and link if it fails.
    this.mailerService
      .send(mail, member.email)
      .catch((err) => this.log.warn(`mailerService failed: ${err.message}. link: ${link}`));
  }
}
