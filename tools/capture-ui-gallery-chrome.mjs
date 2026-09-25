/** Capture the 24 gallery baselines in headless Google Chrome, without a Codex session.
 *
 *   node tools/capture-ui-gallery-chrome.mjs <new-capture-dir> [--url <gallery-url>]
 *
 * Runs the behavior checklist first and refuses to capture if any check fails, then drives
 * the same states through the same helper the Codex path uses (capture-ui-gallery.mjs). The
 * evidence names this browser honestly; it never claims to be the Codex in-app browser.
 * Review every image and the comparison before `ui-baselines.mjs record`. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launchChromeTab } from './chrome-tab.mjs';
import { runBehaviorChecks } from './gallery-behavior-checks.mjs';
import { captureGallery } from './capture-ui-gallery.mjs';

const args = process.argv.slice(2);
const directory = args[0] && resolve(args[0]);
const urlFlag = args.indexOf('--url');
const base = urlFlag >= 0 ? args[urlFlag + 1] : 'http://localhost:4944/internal/components';
if (!directory) throw new Error('Usage: node tools/capture-ui-gallery-chrome.mjs <new-capture-dir> [--url <gallery-url>]');

await mkdir(directory, { recursive: true });
const tab = await launchChromeTab({ url: `${base}?host=cloud&section=fields` });
try {
  console.log(`Browser: ${tab.browserVersion}`);
  const checks = await runBehaviorChecks(tab, base);
  await writeFile(resolve(directory, 'behavior-checks.detail.json'), JSON.stringify(checks, null, 2) + '\n');
  await writeFile(resolve(directory, 'behavior-checks.json'), JSON.stringify(checks.map(({ host, check, passed }) => ({ host, check, passed })), null, 2) + '\n');
  for (const c of checks) console.log(`${c.passed ? 'pass' : 'FAIL'}  ${c.host.padEnd(7)} ${c.check}${c.passed ? '' : `\n      ${JSON.stringify(c.detail)}`}`);
  if (checks.some(c => !c.passed)) {
    process.exitCode = 1;
    console.error('Behavior checks failed; nothing was captured.');
  } else {
    await tab.goto(`${base}?host=cloud&section=fields`);
    const result = await captureGallery(tab, directory, checks.map(({ host, check, passed }) => ({ host, check, passed })),
      { browser: tab.browser, browserVersion: tab.browserVersion });
    console.log(`Captured ${result.screenshots} screenshots in ${result.directory}`);
  }
} finally {
  await tab.close();
}
