import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const connection = JSON.parse(await readFile('/tmp/pagecraft-template-review-connection.json', 'utf8')) as { origin: string; token: string };
const client = new Client({ name: 'template-workshop', version: '1.0.0' });
await client.connect(new StreamableHTTPClientTransport(new URL(`${connection.origin}/mcp/template-authoring`), {
  authProvider: { token: async () => connection.token },
}));
const call = async (name: string, input: Record<string, unknown>) => {
  const response = await client.callTool({ name, arguments: input });
  const value = JSON.parse((response.content as { text: string }[])[0].text);
  if (response.isError) throw new Error(`${name}: ${JSON.stringify(value)}`);
  return value;
};
const receipts = [];
try {
  for (const direction of ['family', 'contemporary', 'boutique']) {
    const root = resolve('premade-sites/review-library/dental-clinic-2026-11-12', direction);
    const config = JSON.parse(await readFile(resolve(root, 'config.json'), 'utf8'));
    const id = `dental-${direction}`, version = '0.1.0';
    const existing = await call('pagecraft_template_list', {});
    let draft = existing.find((row: { id: string; version: string }) => row.id === id && row.version === version)
      || await call('pagecraft_template_create', { id, version, name: config.name || `Linden Dental: ${direction}` });
    const replacements = new Map<string, string>();
    for (const spec of config.assets) {
      const bytes = await readFile(resolve(root, spec.file));
      const previous = new Set(draft.assets.map((asset: { id: string }) => asset.id));
      draft = await call('pagecraft_template_upload_image', { id, version, revision: draft.revision,
        name: spec.file.split('/').at(-1), base64: bytes.toString('base64') });
      const asset = draft.assets.find((asset: { id: string }) => asset.id === draft.uploadedAssetId || !previous.has(asset.id)) || draft.assets.at(-1);
      replacements.set(`asset:${spec.id}`, `asset:${asset.id}`);
    }
    let source = await readFile(resolve(root, 'document.json'), 'utf8');
    for (const [before, after] of replacements) source = source.replaceAll(before, after);
    draft = await call('pagecraft_template_save', { id, version, revision: draft.revision, document: JSON.parse(source) });
    const validated = await call('pagecraft_template_validate', { id, version, revision: draft.revision });
    receipts.push({ id, revision: draft.revision, packageSha256: validated.packageSha256, editorUrl: draft.editorUrl, previewUrl: draft.previewUrl });
    console.log(`${id}: revision ${draft.revision}, native package validated`);
  }
  await writeFile(resolve('evidence/template-authoring-2026-11-12/local-mcp-receipts.json'), JSON.stringify(receipts, null, 2));
} finally { await client.close(); }
