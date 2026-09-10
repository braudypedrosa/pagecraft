// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { projectIdentity, renameHostedSite } from '../app/src/ui/hosted-identity';
test('Cloud identity uses the hosted name while portable and WordPress names stay local', () => {
  expect(projectIdentity('Document', 'Renamed site')).toBe('Renamed site');
  expect(projectIdentity('Document')).toBe('Document');
  expect(projectIdentity('Document','Cloud',true)).toBe('Document');
});
test('rename reuses the existing endpoint and rejects server validation or login HTML', async () => {
  const fetcher = vi.fn(async () => ({ok:true,url:'https://example.test/sites/qa/settings?message=Site+name+updated',text:async()=>'<div class="notice" role="status">Site name updated.</div>'}) as Response);
  expect(await renameHostedSite('qa',' New name ',fetcher)).toBe('New name');
  expect(fetcher.mock.calls[0]).toMatchObject(['/sites/qa/settings/name',{method:'POST',credentials:'same-origin'}]);
  fetcher.mockResolvedValue({ok:true,url:'https://example.test/login',text:async()=>'<h1>Sign in</h1>'} as Response);
  await expect(renameHostedSite('qa','Keep this',fetcher)).rejects.toThrow('could not be saved');
  fetcher.mockResolvedValue({ok:true,url:'https://example.test/sites/qa/settings',text:async()=>'<p class="notice error" role="alert">Invalid name.</p>'} as Response);
  await expect(renameHostedSite('qa','Keep this',fetcher)).rejects.toThrow('Invalid name.');
});
