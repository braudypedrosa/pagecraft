import type { Context, Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import * as Core from '../../app/src/core/index.ts';
import type { User } from './auth.ts';
import { blankDoc, renderSite } from './render.ts';
import { createSitePackage, validatePortablePackage } from './portable-packages.ts';
import { ALLOWED, MAX_BYTES, sniff, type Asset } from './assets.ts';
import { optimizeImage, optimizedName } from './image-optimization.ts';
import { TemplateDraftError, TemplateDraftStore, type TemplateDraft } from './template-draft-store.ts';
import { TEMPLATE_DRAFT_WIDGETS } from './template-draft-validation.ts';
import { TemplateAuthorGrants } from './template-authoring-grants.ts';
import { canonicalJson, sha256 } from './releases.ts';

export interface TemplateAuthoringOptions {
  store: TemplateDraftStore;
  grants: TemplateAuthorGrants;
}
interface Dependencies extends TemplateAuthoringOptions {
  origin: string;
  editorHtml?: string;
  identity(c: Context): Promise<User | null>;
  editorHost(c: Context): boolean;
}
const RESOURCE = '/mcp/template-authoring';
const esc = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const key = (id: string, version: string) => `${encodeURIComponent(id)}/${encodeURIComponent(version)}`;
const apiRoot = (id: string, version: string) => `/api/template-drafts/${key(id, version)}`;
const reviewRoot = (id: string, version: string) => `/owner/template-drafts/${key(id, version)}`;
// The portable document is canonical JSON. Persist that same order before rendering it.
const nativeInput = (value: unknown) => JSON.parse(canonicalJson(value));
const page = (title: string, content: string) => `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{margin:0;background:#f7f7f6;color:#252625;font:15px/1.6 system-ui,sans-serif}main{max-width:1120px;margin:64px auto;padding:0 24px}h1{font-size:32px;line-height:1.2;letter-spacing:-.04em}p{max-width:700px}a{color:inherit}table{width:100%;border-collapse:collapse;margin:32px 0}th,td{text-align:left;padding:16px 10px;border-bottom:1px solid #ddd}button,input{font:inherit;padding:9px 12px}code{overflow-wrap:anywhere}nav{display:flex;gap:20px;flex-wrap:wrap}small{color:#626562}</style><main>${content}</main></html>`;

export function templateAuthoringRoutes(app: Hono, d: Dependencies) {
  const owner = async (c: Context) => {
    if (!d.editorHost(c)) return null;
    const user = await d.identity(c);
    return user && d.grants.operatorIds.includes(user.authUserId || user.id) ? user : null;
  };
  const actor = (user: User) => user.authUserId || user.id;
  const originAllowed = (c: Context) => (c.req.header('origin') || (() => {
    try { return new URL(c.req.header('referer') || '').origin; } catch { return ''; }
  })()) === new URL(d.origin).origin;
  const errorResponse = (c: Context, error: unknown) => {
    if (error instanceof TemplateDraftError) return c.json({ error: error.code, detail: error.message },
      error.code === 'not_found' ? 404 : error.code === 'invalid' ? 422 : 409);
    if (error instanceof SyntaxError) return c.json({ error: 'invalid_json' }, 400);
    if (error instanceof Error && error.message.startsWith('invalid template document:')) return c.json({ error: 'invalid', detail: error.message }, 422);
    console.error('Template authoring operation failed', error instanceof Error ? error.message : 'unknown error');
    return c.json({ error: 'template_authoring_unavailable' }, 503);
  };
  const guarded = (run: (c: Context) => Promise<Response>) => async (c: Context) => {
    try { return await run(c); } catch (error) { return errorResponse(c, error); }
  };
  app.use('/api/template-drafts/*', async (c, next) => {
    if (!await owner(c)) return c.json({ error: 'template_operator_required' }, 403);
    if (!['GET', 'HEAD'].includes(c.req.method) && !originAllowed(c)) return c.json({ error: 'origin_not_allowed' }, 403);
    try { await next(); } catch (error) { return errorResponse(c, error); }
  });
  app.use('/owner/template-drafts', async (c, next) => {
    c.header('cache-control', 'private, no-store'); c.header('x-robots-tag', 'noindex, nofollow');
    if (!await owner(c)) return c.text('Template operator access required.', 403);
    try { await next(); } catch (error) { return errorResponse(c, error); }
  });
  app.use('/owner/template-drafts/*', async (c, next) => {
    c.header('cache-control', 'private, no-store'); c.header('x-robots-tag', 'noindex, nofollow');
    if (!await owner(c)) return c.text('Template operator access required.', 403);
    if (!['GET', 'HEAD'].includes(c.req.method) && !originAllowed(c)) return c.json({ error: 'origin_not_allowed' }, 403);
    try { await next(); } catch (error) { return errorResponse(c, error); }
  });
  const read = (c: Context) => d.store.read(c.req.param('id')!, c.req.param('version')!,
    c.req.query('revision') ? Number(c.req.query('revision')) : undefined);
  const bodies = async (draft: TemplateDraft): Promise<Asset[]> => Promise.all(draft.assets.map(async asset => {
    const stored = await d.store.asset(draft.id, draft.version, asset.id, draft.revision);
    return { ...stored, siteId: `template:${draft.id}:${draft.version}` };
  }));
  const output = async (draft: TemplateDraft) => {
    const assets = await bodies(draft);
    const built = createSitePackage({ document: draft.document, assets,
      provenance: { format: 'pagecraft.provenance.v1', origin: 'pagecraft-cloud',
        sourceId: `template:${draft.id}:${draft.version}`, sourceVersion: draft.revision, exportedBy: 'Pagecraft curated templates' } });
    validatePortablePackage(built.bytes);
    return built;
  };
  const view = (draft: TemplateDraft) => ({ ...draft,
    editorUrl: `${d.origin}${reviewRoot(draft.id, draft.version)}/edit`,
    previewUrl: `${d.origin}${reviewRoot(draft.id, draft.version)}/preview/${draft.revision}/index.html` });
  const upload = async (id: string, version: string, revision: number, name: string, bytes: Uint8Array, by: string) => {
    if (bytes.byteLength > MAX_BYTES) throw new TemplateDraftError('invalid', 'Image exceeds the supported upload size');
    const type = sniff(bytes);
    if (!type || !ALLOWED.has(type)) throw new TemplateDraftError('invalid', 'Unsupported image type');
    const optimized = await optimizeImage(bytes, type).catch(() => { throw new TemplateDraftError('invalid', 'Image could not be decoded or optimized'); });
    const draft = await d.store.putAsset(id, version, revision, { name: optimizedName(name, optimized.extension),
      type: optimized.type, bytes: optimized.bytes, w: optimized.w, h: optimized.h }, by);
    return { draft, assetId: `img-${sha256(optimized.bytes)}` };
  };

  app.get('/owner/template-drafts', guarded(async c => {
    const drafts = await d.store.list();
    return c.html(page('Template drafts', `<nav><a href="/">Pagecraft</a><a href="/owner/template-drafts/access">Authoring access</a></nav><h1>Template drafts</h1><p>Private native templates. Drafts appear in the customer collection only after package review and promotion.</p>${drafts.length ? `<table><thead><tr><th>Template</th><th>Version</th><th>Revision</th><th>Review</th></tr></thead><tbody>${drafts.map(row => `<tr><td>${esc(row.name)}</td><td>${esc(row.version)}</td><td>${row.revision}</td><td><a href="${reviewRoot(row.id, row.version)}/edit">Edit</a> · <a href="${reviewRoot(row.id, row.version)}/preview/${row.revision}/index.html">Preview</a></td></tr>`).join('')}</tbody></table>` : '<p>No template drafts yet. Create a draft through the template-authoring MCP.</p>'}`));
  }));
  app.get('/owner/template-drafts/access', c => c.html(page('Template authoring access', `<nav><a href="/owner/template-drafts">Template drafts</a></nav><h1>Template authoring access</h1><p>Create a private credential for native template drafts. It cannot publish templates or modify customer sites.</p><p>MCP endpoint: <code>${esc(d.origin + RESOURCE)}</code></p><form method="post"><label>Credential name <input name="name" required maxlength="80"></label> <button>Create credential</button></form><p>Revoke a credential using its recorded identifier.</p><form method="post" action="/owner/template-drafts/access/revoke"><label>Credential identifier <input name="id" required pattern="[a-f0-9]{32}"></label> <button>Revoke credential</button></form>`)));
  app.post('/owner/template-drafts/access', guarded(async c => {
    const user = (await owner(c))!;
    const form = await c.req.parseBody();
    const created = await d.grants.create(actor(user), String(form.name || ''));
    return c.html(page('Credential created', `<h1>Credential created</h1><p>Copy this credential now. It will not be shown again.</p><p><code>${esc(created.token)}</code></p><p>Identifier: <code>${created.grant.id}</code></p><p><a href="/owner/template-drafts">Return to template drafts</a></p>`));
  }));
  app.post('/owner/template-drafts/access/revoke', guarded(async c => {
    const form = await c.req.parseBody();
    const id = String(form.id || '');
    if (!/^[a-f0-9]{32}$/.test(id)) return c.json({ error: 'invalid_grant' }, 422);
    await d.grants.revoke(id, actor((await owner(c))!));
    return c.redirect('/owner/template-drafts/access', 303);
  }));
  app.get('/owner/template-drafts/:id/:version/edit', guarded(async c => {
    if (!d.editorHtml) return c.text('Builder is unavailable.', 503);
    const draft = await read(c), user = (await owner(c))!;
    const config = { templateDraft: true, apiRoot: apiRoot(draft.id, draft.version),
      siteId: `template-${draft.id}`, name: draft.name, slug: draft.id, host: new URL(d.origin).host,
      role: 'owner', user, doc: draft.document, version: draft.revision, publishedVersion: 0,
      url: `${d.origin}${reviewRoot(draft.id, draft.version)}/preview/index.html` };
    const tag = `<script>window.PC_SERVER=${JSON.stringify(config).replace(/</g, '\\u003c')};<\/script>`;
    const at = d.editorHtml.indexOf('<script');
    return c.html(at < 0 ? tag + d.editorHtml : d.editorHtml.slice(0, at) + tag + d.editorHtml.slice(at));
  }));
  app.get('/owner/template-drafts/:id/:version/preview/*', guarded(async c => {
    const id = c.req.param('id')!, version = c.req.param('version')!;
    const prefix = `${reviewRoot(id, version)}/preview/`;
    const requested = decodeURIComponent(new URL(c.req.url).pathname.slice(prefix.length));
    const revisionPath = /^([1-9]\d*)\/(.+)$/.exec(requested);
    const revision = revisionPath ? Number(revisionPath[1]) : (c.req.query('revision') ? Number(c.req.query('revision')) : undefined);
    if (revision !== undefined && (!Number.isSafeInteger(revision) || revision < 1)) throw new TemplateDraftError('invalid', 'Invalid revision');
    const draft = await d.store.read(id, version, revision), assets = await bodies(draft);
    const path = revisionPath ? revisionPath[2] : requested;
    if (path.startsWith('assets/')) {
      const asset = assets.find(row => Core.assetFile(row) === path);
      return asset ? c.body(new Uint8Array(asset.bytes), 200, { 'content-type': asset.type }) : c.notFound();
    }
    const html = renderSite(draft.document, assets).files.get(path);
    if (!html || !path.endsWith('.html')) return c.notFound();
    c.header('content-security-policy', "sandbox allow-scripts allow-same-origin; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com data:; form-action 'none'; frame-ancestors 'self'; base-uri 'none'; object-src 'none'");
    return c.html(html);
  }));
  app.get('/api/template-drafts/:id/:version', guarded(async c => {
    const draft = await read(c); return c.json({ doc: draft.document, version: draft.revision });
  }));
  app.put('/api/template-drafts/:id/:version', bodyLimit({ maxSize: 16 * 1024 * 1024 }), guarded(async c => {
    const body = await c.req.json();
    if (!body || typeof body !== 'object' || !Number.isSafeInteger(body.version) || body.version < 1 || !body.doc
      || Object.keys(body).some(key => !['doc', 'version'].includes(key))) return c.json({ error: 'doc_and_version_required' }, 422);
    const draft = await d.store.save(c.req.param('id')!, c.req.param('version')!, body.version, nativeInput(body.doc), actor((await owner(c))!));
    return c.json({ version: draft.revision });
  }));
  const media = (draft: TemplateDraft) => draft.assets.map(asset => ({ ...asset,
    url: `${apiRoot(draft.id, draft.version)}/assets/${asset.id}?revision=${draft.revision}`, storedBytes: asset.bytes }));
  app.get('/api/template-drafts/:id/:version/assets', guarded(async c => c.json(media(await read(c)))));
  app.get('/api/template-drafts/:id/:version/assets/:asset', guarded(async c => {
    const draft = await read(c), asset = await d.store.asset(draft.id, draft.version, c.req.param('asset')!, draft.revision);
    return c.body(new Uint8Array(asset.bytes), 200, { 'content-type': asset.type });
  }));
  app.post('/api/template-drafts/:id/:version/assets', bodyLimit({ maxSize: MAX_BYTES + 1024 * 1024 }), guarded(async c => {
    const draft = await read(c), form = await c.req.formData(), file = form.get('file');
    if (!(file instanceof File)) return c.json({ error: 'file_required' }, 422);
    if (file.size > MAX_BYTES) return c.json({ error: 'image_too_large' }, 413);
    const revision = Number(form.get('revision'));
    if (!Number.isSafeInteger(revision) || revision < 1) return c.json({ error: 'revision_required' }, 422);
    const uploaded = await upload(draft.id, draft.version, revision, file.name, new Uint8Array(await file.arrayBuffer()), actor((await owner(c))!));
    const item = media(uploaded.draft).find(row => row.id === uploaded.assetId)!;
    return c.json({ ...item, revision: uploaded.draft.revision, previousRevision: revision }, 201);
  }));
  app.get('/api/template-drafts/:id/:version/history', guarded(async c => {
    const draft = await read(c), rows = [];
    for (let revision = draft.revision; revision >= 1; revision--) {
      const row = await d.store.read(draft.id, draft.version, revision);
      rows.push({ version: row.revision, createdAt: row.updatedAt, savedBy: row.actor, author: { name: 'Template author' } });
    }
    return c.json(rows);
  }));
  app.post('/api/template-drafts/:id/:version/history/:revision/restore', guarded(async c => {
    const body = await c.req.json(), current = await read(c);
    if (!body || !Number.isSafeInteger(body.currentVersion) || body.currentVersion < 1
      || Object.keys(body).some(key => key !== 'currentVersion')) return c.json({ error: 'current_version_required' }, 422);
    const historical = await d.store.read(current.id, current.version, Number(c.req.param('revision')));
    const saved = await d.store.save(current.id, current.version, body.currentVersion, historical.document, actor((await owner(c))!));
    return c.json({ document: saved.document, version: saved.revision });
  }));

  const result = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value) }] });
  const identitySchema = { id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), version: z.string().regex(/^\d+\.\d+\.\d+$/) };
  const mcp = (by: string) => {
    const server = new McpServer({ name: 'pagecraft-template-authoring', version: '1.0.0' }, { capabilities: { tools: {} }, maxToolInputElements: 150_000 });
    const tool = <T extends z.ZodRawShape>(name: string, description: string, shape: T, run: (input: z.infer<z.ZodObject<T>>) => Promise<unknown>) => {
      server.registerTool(name, { description, inputSchema: z.strictObject(shape) }, async input => {
        try { return result(await run(input as z.infer<z.ZodObject<T>>)); }
        catch (error) { return { ...result({ error: error instanceof TemplateDraftError ? error.code : 'invalid', detail: error instanceof Error ? error.message : 'Operation failed' }), isError: true }; }
      });
    };
    tool('pagecraft_template_schema', 'Read the native Pagecraft widget and control definitions. Use only these controls; template drafts cannot contain custom code or CMS dependencies.', {}, async () => ({ schemaVersion: Core.SCHEMA, widgets: Object.fromEntries([...TEMPLATE_DRAFT_WIDGETS].map(type => { const definition = Core.DEF[type]; return [type, { ...definition, defaults: definition.make() }]; })), commonStyles: Core.COMMON_STYLE }));
    tool('pagecraft_template_list', 'List private template drafts. These are separate from the released customer catalog.', {}, () => d.store.list());
    tool('pagecraft_template_create', 'Create an unpublished native template draft. Does not create a customer site or add a catalog entry.', { ...identitySchema, name: z.string().min(1).max(120) }, async input => view(await d.store.create({ ...input, document: nativeInput(blankDoc(input.name)) }, by)));
    tool('pagecraft_template_read', 'Read a complete native template document, assets, revision and review links.', { ...identitySchema, revision: z.number().int().positive().optional() }, async input => view(await d.store.read(input.id, input.version, input.revision)));
    tool('pagecraft_template_save', 'Atomically save native pages, elements, responsive styles, tokens, menus and components to an unpublished draft. Read again after a revision conflict.', { ...identitySchema, revision: z.number().int().positive(), document: z.unknown() }, async input => view(await d.store.save(input.id, input.version, input.revision, nativeInput(input.document), by)));
    tool('pagecraft_template_upload_image', 'Upload an image to this draft only. Image bytes are base64, validated and optimized; returns the new revision and asset ID.', { ...identitySchema, revision: z.number().int().positive(), name: z.string().min(1).max(160), base64: z.string().min(1).max(Math.ceil(MAX_BYTES / 3) * 4) }, async input => {
      if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.base64)) throw new TemplateDraftError('invalid', 'Invalid base64 image');
      const uploaded = await upload(input.id, input.version, input.revision, input.name, new Uint8Array(Buffer.from(input.base64, 'base64')), by);
      return { ...view(uploaded.draft), uploadedAssetId: uploaded.assetId };
    });
    tool('pagecraft_template_validate', 'Validate and render one immutable revision using the actual portable package pipeline. This does not certify host compatibility.', { ...identitySchema, revision: z.number().int().positive() }, async input => {
      const draft = await d.store.read(input.id, input.version, input.revision), built = await output(draft);
      return { packageSha256: built.sha256, schemaVersion: draft.document.schemaVersion, ...view(draft) };
    });
    tool('pagecraft_template_export', 'Build a native draft package bound to one revision. Download requires the same authoring credential. This cannot promote or publish.', { ...identitySchema, revision: z.number().int().positive() }, async input => {
      const draft = await d.store.read(input.id, input.version, input.revision), built = await output(draft);
      return { id: draft.id, version: draft.version, revision: draft.revision, packageSha256: built.sha256,
        downloadUrl: `${d.origin}${RESOURCE}/packages/${key(draft.id, draft.version)}/${draft.revision}` };
    });
    return server;
  };
  const authorised = async (c: Context, run: (ownerId: string) => Promise<Response>) => {
    c.header('cache-control', 'private, no-store'); c.header('x-robots-tag', 'noindex, nofollow');
    if (!d.editorHost(c)) return c.notFound();
    const token = /^Bearer (\S+)$/i.exec(c.req.header('authorization') || '')?.[1] || '';
    const response = await d.grants.withGrant(token, grant => run(grant.ownerId));
    if (response) return response;
    c.header('www-authenticate', `Bearer resource_metadata="${d.origin}/.well-known/oauth-protected-resource/mcp/template-authoring"`);
    return c.json({ error: 'template_authoring_credential_required' }, 401);
  };
  app.get('/.well-known/oauth-protected-resource/mcp/template-authoring', c => d.editorHost(c)
    ? c.json({ resource: d.origin + RESOURCE, resource_name: 'Pagecraft template authoring', bearer_methods_supported: ['header'], scopes_supported: ['templates:draft'] }) : c.notFound());
  app.all(RESOURCE, bodyLimit({ maxSize: 16 * 1024 * 1024 }), c => authorised(c, async by => {
    const handler = createMcpHandler(() => mcp(by), { responseMode: 'json', maxRequestBodySize: 16 * 1024 * 1024 });
    return handler.fetch(c.req.raw, { authInfo: { token: 'verified-template-operator', clientId: by, scopes: ['templates:draft'], expiresAt: Math.floor(Date.now() / 1000) + 60 } });
  }));
  app.get(`${RESOURCE}/packages/:id/:version/:revision`, c => authorised(c, async () => {
    try {
      const draft = await d.store.read(c.req.param('id')!, c.req.param('version')!, Number(c.req.param('revision')));
      const built = await output(draft);
      return c.body(new Uint8Array(built.bytes), 200, { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${draft.id}-${draft.version}.pagecraft-site.zip"`, 'x-package-sha256': built.sha256 });
    } catch (error) { return errorResponse(c, error); }
  }));
}
