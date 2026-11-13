import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';

const [root, id, worker, now, pause] = process.argv.slice(2);
let continueWrite;
const continued = new Promise(resolve => { continueWrite = resolve; });
let held = false;
const holdClaimWrite = async body => {
  let value;
  try { value = JSON.parse(String(body)); } catch { return; }
  if (pause !== 'write' || held || value?.worker !== worker) return;
  held = true;
  process.send({ type: 'writing' });
  await continued;
};
const originalOpen = fs.promises.open.bind(fs.promises);
fs.promises.open = async (...args) => {
  const handle = await originalOpen(...args);
  const write = handle.writeFile.bind(handle);
  handle.writeFile = async (body, ...options) => {
    await holdClaimWrite(body);
    return write(body, ...options);
  };
  return handle;
};
const originalWriteFile = fs.promises.writeFile.bind(fs.promises);
fs.promises.writeFile = async (path, body, ...options) => {
  await holdClaimWrite(body);
  return originalWriteFile(path, body, ...options);
};
syncBuiltinESMExports();
const { FilePublicationScheduleStore } = await import('../../src/schedules.ts');
const store = new FilePublicationScheduleStore(root);
process.on('message', async message => {
  if (message === 'continue') { continueWrite(); return; }
  if (message !== 'claim' && message !== 'create' && message !== 'settle') return;
  try {
    if (message === 'claim') process.send({ type: 'result', won: await store.claim(id, worker, new Date(now)) });
    else if (message === 'settle') {
      const result = await store.settle(id, worker, { status: 'retry', error: 'fixture settle' }, new Date(now));
      process.send({ type: 'result', settled: result !== null });
    } else {
      const result = await store.create({ siteId: id, snapshotId: randomUUID(), baselinePublicationId: null,
        publishAt: now, createdBy: 'fixture-owner', idempotencyKey: worker }, new Date(now));
      process.send({ type: 'result', status: result.status });
    }
  } catch (error) {
    process.send({ type: 'error', message: String(error?.stack || error) });
  }
});
process.send({ type: 'ready' });
