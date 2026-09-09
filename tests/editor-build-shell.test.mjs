import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('generated editor places the attributed app root inside body and preserves deployed preview capture',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const app=html.indexOf('<div id="app"');
 assert.ok(html.indexOf('</head>')<html.indexOf('<body>'));
 assert.ok(html.indexOf('<body>')<app && app<html.indexOf('</body>'));
 assert.match(html,/async function publicationPreviewSnapshot/);
 assert.match(html,/HOST\.releases\.savePreview/);
});
