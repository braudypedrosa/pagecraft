/** Email about new form entries.
 *
 *  Two rules shape this. A public form must never become a way to mail strangers, so the only
 *  possible recipients are people who already have access to the site. And a visitor's entry is
 *  safe the moment it is saved, so nothing about mail can delay, fail or repeat a submission. */
import { throttle, type NoticeSender } from './mail.ts';
import { roleAllows, type Role } from './auth.ts';
import type { FormAlertSettings, FileSubmissionStore, Submission } from './submissions.ts';

export interface AlertMember { userId: string; email: string; name: string; role: Role }
export interface FormAlertsOptions {
  submissions: FileSubmissionStore;
  /** Absent when this server has no outgoing mail. */
  send?: NoticeSender;
  /** People on the site whose account is confirmed. */
  members(siteId: string): Promise<AlertMember[]>;
  inboxUrl(siteId: string, formId: string): string;
  /** Whether test emails may go to this person again now. Injectable for tests. */
  perHour?: number;
}

const HOUR = 60 * 60 * 1000;
const line = (value: unknown, max: number) => String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const mailbox = (value: string) => value.length <= 254 && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(value) ? value : '';

/** Who hears about entries: the people chosen, or every owner until somebody chooses. Filtered
 *  against the site's people each time, so removing a person also stops their email. */
export function alertRecipients(settings: FormAlertSettings, members: AlertMember[]) {
  const chosen = settings.recipients;
  return members.filter(member => member.email && (chosen ? chosen.includes(member.userId) : member.role === 'owner'));
}

export function entryMessage(input: { siteName: string; entry: Submission; url: string; capped?: boolean }) {
  const form = line(input.entry.formName, 80) || 'Form', site = line(input.siteName, 80) || 'your site';
  const values = input.entry.values.filter(value => value.value).map(value => {
    const text = value.value.replace(/\r\n?/g, '\n').slice(0, 4000);
    return line(value.label, 120) + (text.includes('\n') ? ':\n' + text : ': ' + text);
  });
  const reply = mailbox((input.entry.values.find(value => mailbox(value.value.trim()))?.value || '').trim());
  return {
    subject: `New entry: ${form} · ${site}`,
    replyTo: reply || undefined,
    text: [
      `${form} on ${site} has a new entry.`, '',
      ...(values.length ? values : ['The entry has no text.']), '',
      'See it in Submissions:', input.url,
      ...(input.capped ? ['', 'This site has had many entries in the last hour, so no more will be emailed for now. They are all saved in Submissions.'] : []),
      '', 'You get this email because you are on this Pagecraft site. The site owner can change who gets it in Submissions.',
      ...(reply ? ['Replying to this email writes to the address in the entry, which has not been verified.'] : [])
    ].join('\n')
  };
}

export class FormAlerts {
  private o: FormAlertsOptions;
  private perSite: ReturnType<typeof throttle>;
  private tests = throttle(3, 10 * 60 * 1000);
  /** An email shows the whole entry, so it goes only to people who may open it in Submissions. */
  private async readers(siteId: string) {
    return (await this.o.members(siteId)).filter(member => roleAllows(member.role, 'read'));
  }
  constructor(o: FormAlertsOptions) { this.o = o; this.perSite = throttle(o.perHour ?? 30, HOUR); }
  get available() { return !!this.o.send; }

  async view(siteId: string) {
    const [settings, members] = await Promise.all([this.o.submissions.alerts(siteId), this.readers(siteId)]);
    return { available: this.available, settings, members, recipients: alertRecipients(settings, members).map(member => member.userId) };
  }
  /** Unknown people are dropped rather than stored: nobody can be added by editing the request. */
  async choose(siteId: string, userIds: string[]) {
    const members = await this.readers(siteId);
    const recipients = members.filter(member => userIds.includes(member.userId)).map(member => member.userId);
    await this.o.submissions.setAlerts(siteId, { ...await this.o.submissions.alerts(siteId), recipients });
    return recipients;
  }
  async test(siteId: string, siteName: string, email: string): Promise<'sent' | 'off' | 'wait' | 'failed'> {
    if (!this.o.send) return 'off';
    if (!this.tests.take(siteId + '|' + email)) return 'wait';
    try {
      await this.o.send(email, `Test: form emails for ${line(siteName, 80)}`,
        'Form emails are working. New entries will look like this one, with the visitor’s answers and a link to Submissions.');
      return 'sent';
    } catch { return 'failed'; }
  }
  /** Never throws. Resolves when every attempt has finished, which only tests wait for. */
  async entry(siteId: string, siteName: string, entry: Submission) {
    if (!this.o.send) return;
    try {
      const [settings, members] = await Promise.all([this.o.submissions.alerts(siteId), this.readers(siteId)]);
      const recipients = alertRecipients(settings, members);
      if (!recipients.length || !this.perSite.take(siteId)) return;
      const message = entryMessage({ siteName, entry, url: this.o.inboxUrl(siteId, entry.formId), capped: this.perSite.limited(siteId) });
      const results = await Promise.allSettled(recipients.map(async member => this.o.send!(member.email, message.subject, message.text, message.replyTo)));
      const failed = results.some(result => result.status === 'rejected');
      if (failed) console.warn('A form entry was saved but its email could not be sent.');
      /* Read again: an owner may have changed the recipients while mail was going out. */
      if (failed !== !!settings.failedAt) {
        const { failedAt: _old, ...rest } = await this.o.submissions.alerts(siteId);
        await this.o.submissions.setAlerts(siteId, failed ? { ...rest, failedAt: new Date().toISOString() } : rest);
      }
    } catch { console.warn('A form entry was saved but its email could not be prepared.'); }
  }
}
