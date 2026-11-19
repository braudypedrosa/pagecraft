// Private mail-pipe entry point. The capability and message travel only through stdin.
import { SupportTicketStore } from '../src/support-tickets.ts';
import { FileRecords } from '../src/record-files.ts';

try {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const reply = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const store = new SupportTicketStore(new FileRecords(process.argv[2]));
  await store.appendReply(reply.replyToken, reply.inboundId, reply.body);
} catch {
  // EX_TEMPFAIL tells the mail transport to retry a transient storage failure.
  process.exitCode = 75;
}
