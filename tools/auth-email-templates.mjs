// Builds the Pagecraft-branded Supabase Auth email templates into supabase/templates/.
// Apply them in Supabase → Authentication → Emails (see server/AUTH_SETUP.md).
import { mkdirSync, writeFileSync } from 'node:fs';

const LOGO = 'https://itspagecraft.com/images/email/pagecraft-logo.png';
const CONFIRM = '{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type={{ .EmailActionType }}';
const RECOVER = '{{ .RedirectTo }}&token_hash={{ .TokenHash }}';

const font = "font-family:Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

const layout = ({ preheader, heading, body, cta, link, note }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#eef0ec;${font};-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef0ec">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td style="background:#111311;border-radius:14px 14px 0 0;padding:26px 32px">
<img src="${LOGO}" width="148" height="32" alt="Pagecraft" style="display:block;border:0;width:148px;height:32px">
</td></tr>
<tr><td style="background:#ffffff;border-radius:0 0 14px 14px;padding:36px 32px 32px">
<h1 style="margin:0 0 14px;${font};font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-.02em;color:#111311">${heading}</h1>
${body.map(p => `<p style="margin:0 0 16px;${font};font-size:16px;line-height:1.6;color:#3d443c">${p}</p>`).join('\n')}
${cta ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 26px"><tr><td style="background:#b7f34a;border-radius:10px">
<a href="${cta.href}" style="display:inline-block;padding:14px 26px;${font};font-size:16px;font-weight:700;line-height:1;color:#111311;text-decoration:none;border-radius:10px">${cta.label}</a>
</td></tr></table>` : ''}
${link ? `<p style="margin:0 0 6px;${font};font-size:13px;line-height:1.5;color:#6b7369">Button not working? Paste this link into your browser:</p>
<p style="margin:0 0 22px;${font};font-size:13px;line-height:1.5;word-break:break-all"><a href="${link}" style="color:#3f6b12;text-decoration:underline">${link}</a></p>` : ''}
<p style="margin:0;padding-top:20px;border-top:1px solid #e3e6e1;${font};font-size:13px;line-height:1.6;color:#6b7369">${note}</p>
</td></tr>
<tr><td align="center" style="padding:20px 8px 0;${font};font-size:12px;line-height:1.6;color:#80887e">
Pagecraft · Build, review and publish client sites<br>
<a href="https://itspagecraft.com" style="color:#80887e;text-decoration:underline">itspagecraft.com</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;

const templates = {
  confirmation: {
    subject: 'Confirm your Pagecraft account',
    html: layout({
      preheader: 'One click to finish setting up your Pagecraft account.',
      heading: 'Confirm your email',
      body: ['Welcome to Pagecraft. Confirm <strong style="color:#111311">{{ .Email }}</strong> to finish creating your account and start building.'],
      cta: { href: CONFIRM, label: 'Confirm email' },
      link: CONFIRM,
      note: 'This link expires soon and can be used once. If you didn’t create a Pagecraft account, you can ignore this email.'
    })
  },
  invite: {
    subject: 'You’re invited to Pagecraft',
    html: layout({
      preheader: 'Accept your invitation and set a password.',
      heading: 'You’ve been invited',
      body: ['You’ve been invited to join Pagecraft as <strong style="color:#111311">{{ .Email }}</strong>. Accept the invitation to set your password and get started.'],
      cta: { href: CONFIRM, label: 'Accept invitation' },
      link: CONFIRM,
      note: 'This invitation link can be used once. If you weren’t expecting it, you can ignore this email.'
    })
  },
  magic_link: {
    subject: 'Your Pagecraft sign-in link',
    html: layout({
      preheader: 'Use this link to sign in to Pagecraft.',
      heading: 'Sign in to Pagecraft',
      body: ['Use the button below to sign in as <strong style="color:#111311">{{ .Email }}</strong>.'],
      cta: { href: CONFIRM, label: 'Sign in' },
      link: CONFIRM,
      note: 'This link expires soon and can be used once. If you didn’t ask to sign in, you can ignore this email — your account is safe.'
    })
  },
  email_change: {
    subject: 'Confirm your new Pagecraft email',
    html: layout({
      preheader: 'Confirm the change to your Pagecraft sign-in email.',
      heading: 'Confirm your new email',
      body: ['You asked to change your Pagecraft sign-in email from <strong style="color:#111311">{{ .Email }}</strong> to <strong style="color:#111311">{{ .NewEmail }}</strong>.'],
      cta: { href: CONFIRM, label: 'Confirm new email' },
      link: CONFIRM,
      note: 'If you didn’t request this change, don’t click the link and change your password from Account settings.'
    })
  },
  recovery: {
    subject: 'Reset your Pagecraft password',
    html: layout({
      preheader: 'Choose a new password for your Pagecraft account.',
      heading: 'Reset your password',
      body: ['We received a request to reset the password for <strong style="color:#111311">{{ .Email }}</strong>. Choose a new one with the button below.'],
      cta: { href: RECOVER, label: 'Choose a new password' },
      link: RECOVER,
      note: 'This link expires soon and can be used once. If you didn’t ask for a reset, you can ignore this email — your password stays the same.'
    })
  },
  reauthentication: {
    subject: 'Your Pagecraft verification code',
    html: layout({
      preheader: 'Enter this code to confirm it’s you.',
      heading: 'Confirm it’s you',
      body: ['Enter this code in Pagecraft to continue:', `<span style="display:inline-block;padding:12px 18px;background:#f3f5f1;border:1px solid #e3e6e1;border-radius:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:26px;letter-spacing:.24em;font-weight:700;color:#111311">{{ .Token }}</span>`],
      note: 'This code expires soon. If you didn’t try to make a change, you can ignore this email.'
    })
  }
};

mkdirSync(new URL('../supabase/templates/', import.meta.url), { recursive: true });
for (const [name, t] of Object.entries(templates)) {
  writeFileSync(new URL(`../supabase/templates/${name}.html`, import.meta.url), t.html);
}
writeFileSync(new URL('../supabase/templates/subjects.json', import.meta.url), JSON.stringify(Object.fromEntries(Object.entries(templates).map(([k, t]) => [k, t.subject])), null, 2));
console.log(Object.keys(templates).join(', '));
