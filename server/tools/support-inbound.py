"""Deliver a cPanel mail pipe message to its Pagecraft support ticket."""
import argparse
import hashlib
import json
import re
import subprocess
import sys
from email import policy
from email.parser import BytesParser
from html.parser import HTMLParser
from pathlib import Path

MAX_MAIL_BYTES = 8 * 1024 * 1024
MAX_BODY_CHARS = 8000
SUPPORT_FROM = 'hello@braudyp.dev'


class ReplyHTML(HTMLParser):
    """Extract readable text from an HTML-only reply, excluding quoted messages."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.skip = []
        self.void = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
                     'link', 'meta', 'param', 'source', 'track', 'wbr'}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = (attrs.get('class') or '').split()
        if self.skip or tag in {'blockquote', 'head', 'script', 'style'} or 'gmail_quote' in classes:
            if tag not in self.void:
                self.skip.append(tag)
        elif tag in {'p', 'div', 'br', 'li', 'tr', 'hr'}:
            self.parts.append('\n')

    def handle_endtag(self, tag):
        if self.skip:
            while tag in self.skip:
                if self.skip.pop() == tag:
                    break
        elif tag in {'p', 'div', 'li', 'tr'}:
            self.parts.append('\n')

    def handle_data(self, text):
        if not self.skip:
            self.parts.append(text)


def reply_text(message):
    part = message.get_body(preferencelist=('plain', 'html'))
    if part is None:
        return ''
    body = part.get_content()
    if part.get_content_type() == 'text/html':
        parser = ReplyHTML()
        parser.feed(body)
        parser.close()
        body = ''.join(parser.parts)
    body = body.replace('\r\n', '\n').replace('\r', '\n')
    # Gmail, Apple Mail and Outlook delimit the old thread differently.
    old_thread = re.search(r'(?im)^[ \t]*(?:>|On [^\n]{1,400}(?:\n[^\n]{1,400}){0,2}? wrote:[ \t]*$'
                           r'|-+ *Original Message *-+ *$|_{5,} *\n+From:|From:[^\n]+\n+(?:Sent|Date):)', body)
    if old_thread:
        body = body[:old_thread.start()]
    return re.sub(r'\n[ \t]*\n(?:[ \t]*\n)+', '\n\n', body).strip()


def extract_reply(raw, domain):
    message = BytesParser(policy=policy.default).parsebytes(raw)
    if (message.get('Auto-Submitted', 'no').strip().lower() != 'no'
            or message.get('Precedence', '').strip().lower() in {'list', 'bulk', 'junk'}
            or any(h in message for h in ('X-Autoreply', 'X-Autorespond', 'List-Id', 'Resent-To'))
            or message.get('Return-Path', '').strip() == '<>'
            or message.get_content_type() == 'multipart/report'
            or re.match(r'^\s*(?:Fwd?|Automatic reply|Out of office):', message.get('Subject', ''), re.I)):
        return None
    for header in ('From', 'To'):
        values = message.get_all(header, [])
        if len(values) != 1 or values[0].defects or len(values[0].addresses) != 1:
            return None
    if message['From'].addresses[0].addr_spec.lower() != SUPPORT_FROM:
        return None
    recipient = message['To'].addresses[0].addr_spec.lower()
    match = re.fullmatch(r'support-replies\+([0-9a-f]{32})@' + re.escape(domain.lower()), recipient)
    if not match:
        return None
    token = match.group(1)
    body = reply_text(message)
    if not body or len(body.encode('utf-16-le')) > 2 * MAX_BODY_CHARS or token in body.lower():
        return None
    # Some mail clients omit Message-ID. Leave transport-added Received headers out
    # of the fallback so MTA retries still identify the same message.
    identity = str(message.get('Message-ID', '')).strip() or '\n'.join((recipient, str(message.get('Date', '')), body))
    return {'replyToken': token, 'inboundId': hashlib.sha256(identity.encode()).hexdigest(), 'body': body}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--node', required=True)
    parser.add_argument('--store', required=True)
    parser.add_argument('--domain', required=True)
    args = parser.parse_args()
    raw = sys.stdin.buffer.read(MAX_MAIL_BYTES + 1)
    if len(raw) > MAX_MAIL_BYTES:
        return 0
    try:
        reply = extract_reply(raw, args.domain)
    except (ValueError, LookupError, UnicodeError, IndexError, RecursionError, AttributeError):
        return 0
    if reply is None:
        return 0
    try:
        result = subprocess.run([args.node, str(Path(__file__).resolve().with_suffix('.mjs')), args.store],
                                input=json.dumps(reply).encode(), stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL, timeout=25)
    except (OSError, subprocess.TimeoutExpired):
        return 75
    return 0 if result.returncode == 0 else 75


if __name__ == '__main__':
    sys.exit(main())
