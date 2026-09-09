<?php
/** Read-only: wp eval-file tools/template-wordpress-audit.php POST_ID */
declare(strict_types=1);

if (PHP_SAPI !== 'cli' || !defined('ABSPATH') || !class_exists('Pagecraft\\Builder\\PageEditor')) {
    throw new RuntimeException('Run through WP-CLI on the isolated Pagecraft test site.');
}
$postId = (int) ($args[0] ?? 0);
if ($postId < 1) throw new RuntimeException('Provide the imported page ID.');
wp_set_current_user(1);
$request = new WP_REST_Request('GET');
$request->set_param('id', $postId);
$loaded = (new \Pagecraft\Builder\RestController())->document($request)->get_data();
// Reproduce the actual PHP-to-browser JSON boundary, not just the stored source JSON.
$doc = json_decode(wp_json_encode($loaded['document']), false, 512, JSON_THROW_ON_ERROR);
$findings = [];
$walk = function (array $nodes, string $page) use (&$walk, &$findings): void {
    foreach ($nodes as $node) {
        foreach (['d' => 'desktop', 't' => 'tablet', 'm' => 'mobile'] as $bp => $viewport) {
            if (isset($node->css->$bp) && is_array($node->css->$bp)) {
                $findings[] = ['page' => $page, 'node' => $node->id, 'viewport' => $viewport,
                    'code' => 'style-map-is-array',
                    'detail' => 'The editor response represents a CSS property map as a JSON array; named style edits will be omitted by JSON.stringify.',
                    'correction' => 'Preserve schema object maps across WordPress load, save and restore. Retest inspector edit, save, reopen and frontend output.'];
            }
        }
        if (isset($node->use, $node->vals) && is_array($node->vals)) {
            $findings[] = ['page' => $page, 'node' => $node->id, 'viewport' => 'all',
                'code' => 'instance-values-is-array',
                'detail' => 'Component instance values reach the editor as an array.',
                'correction' => 'Preserve instance values as an object. Explicit initial values avoid the initial empty-map case but do not fix reset-to-defaults.'];
        }
        $walk($node->children ?? [], $page);
    }
};
foreach ($doc->pages ?? [] as $page) $walk($page->tree ?? [], $page->slug ?? (string) $postId);
$walk($doc->header ?? [], 'global-header');
$walk($doc->footer ?? [], 'global-footer');
foreach ($doc->meta->components ?? [] as $component) $walk([$component->node], 'component:' . $component->id);
echo wp_json_encode(['postId' => $postId, 'version' => $loaded['version'], 'findings' => $findings], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
