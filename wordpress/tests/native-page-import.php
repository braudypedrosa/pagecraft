<?php

declare(strict_types=1);

if ($argc < 2) {
    throw new RuntimeException('Package fixture path is required.');
}

define('ABSPATH', __DIR__ . '/');
define('PAGECRAFT_BUILDER_FILE', dirname(__DIR__) . '/pagecraft-builder/pagecraft-builder.php');
define('PAGECRAFT_BUILDER_DIR', dirname(__DIR__) . '/pagecraft-builder/');

$GLOBALS['pc_posts'] = [];
$GLOBALS['pc_meta'] = [];
$GLOBALS['pc_revisions'] = [];
$GLOBALS['pc_events'] = [];
$GLOBALS['pc_next_post'] = 100;
$GLOBALS['pc_caps'] = [
    'import_pagecraft_pages' => true,
    'publish_pages' => true,
    'edit_others_pages' => true,
];

final class WP_Error
{
    public function __construct(private string $message)
    {
    }

    public function get_error_message(): string
    {
        return $this->message;
    }
}

function is_wp_error(mixed $value): bool
{
    return $value instanceof WP_Error;
}

function current_user_can(string $capability, mixed ...$args): bool
{
    if ($capability === 'edit_post') {
        return isset($GLOBALS['pc_posts'][(int) ($args[0] ?? 0)]);
    }
    return !empty($GLOBALS['pc_caps'][$capability]);
}

function get_current_user_id(): int
{
    return 7;
}

function get_userdata(int $userId): object|false
{
    return in_array($userId, [7, 8], true) ? (object) ['ID' => $userId] : false;
}

function sanitize_text_field(string $value): string
{
    return trim(strip_tags($value));
}

function sanitize_title(string $value): string
{
    return trim((string) preg_replace('/[^a-z0-9]+/', '-', strtolower($value)), '-');
}

function wp_slash(mixed $value): mixed
{
    if (is_array($value)) {
        return array_map('wp_slash', $value);
    }
    return is_string($value) ? addslashes($value) : $value;
}

function pc_unslash(mixed $value): mixed
{
    if (is_array($value)) {
        return array_map('pc_unslash', $value);
    }
    return is_string($value) ? stripslashes($value) : $value;
}

function wp_kses(string $html, array $allowedHtml, array $allowedProtocols): string
{
    return $html;
}

function wp_insert_post(array $post, bool $wpError = false): int|WP_Error
{
    $post = pc_unslash($post);
    $id = $GLOBALS['pc_next_post']++;
    $meta = $post['meta_input'] ?? [];
    unset($post['meta_input']);
    $post['ID'] = $id;
    $GLOBALS['pc_posts'][$id] = $post;
    $GLOBALS['pc_meta'][$id] = $meta;
    $GLOBALS['pc_events'][] = ['insert', $id];
    return $id;
}

function wp_update_post(array $post, bool $wpError = false): int|WP_Error
{
    $post = pc_unslash($post);
    $id = (int) ($post['ID'] ?? 0);
    if (!isset($GLOBALS['pc_posts'][$id])) {
        return new WP_Error('missing post');
    }
    $GLOBALS['pc_events'][] = ['update', $id];
    $GLOBALS['pc_posts'][$id] = array_merge($GLOBALS['pc_posts'][$id], $post);
    return $id;
}

function get_post_type(int $postId): string|false
{
    return $GLOBALS['pc_posts'][$postId]['post_type'] ?? false;
}

function get_post(int $postId): ?object
{
    return isset($GLOBALS['pc_posts'][$postId]) ? (object) $GLOBALS['pc_posts'][$postId] : null;
}

function get_post_meta(int $postId, string $key, bool $single = false): mixed
{
    return $GLOBALS['pc_meta'][$postId][$key] ?? '';
}

function update_post_meta(int $postId, string $key, mixed $value): int|bool
{
    $GLOBALS['pc_meta'][$postId][$key] = pc_unslash($value);
    return 1;
}

function post_type_supports(string $postType, string $feature): bool
{
    return $postType === 'page' && $feature === 'revisions';
}

function wp_revisions_enabled(?object $post): bool
{
    return $post !== null;
}

function wp_save_post_revision(int $postId): int|WP_Error
{
    if (!isset($GLOBALS['pc_posts'][$postId])) {
        return new WP_Error('missing post');
    }
    $revisionId = 1000 + count($GLOBALS['pc_revisions']);
    $GLOBALS['pc_revisions'][$revisionId] = [
        'ID' => $revisionId,
        'post_parent' => $postId,
        'post' => $GLOBALS['pc_posts'][$postId],
        'meta' => $GLOBALS['pc_meta'][$postId],
    ];
    $GLOBALS['pc_events'][] = ['revision', $postId, $revisionId];
    return $revisionId;
}

function wp_get_post_revisions(int $postId, array $args = []): array
{
    $matches = array_filter(
        $GLOBALS['pc_revisions'],
        static fn (array $revision): bool => $revision['post_parent'] === $postId
    );
    return array_map(static fn (array $revision): object => (object) $revision, array_reverse($matches, true));
}

function wp_attachment_is_image(int $postId): bool
{
    return ($GLOBALS['pc_posts'][$postId]['post_type'] ?? '') === 'attachment';
}

function set_post_thumbnail(int $postId, int $thumbnailId): bool
{
    $GLOBALS['pc_meta'][$postId]['_thumbnail_id'] = (string) $thumbnailId;
    return true;
}

function pc_assert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

require dirname(__DIR__) . '/pagecraft-builder/includes/Autoload.php';
\Pagecraft\Builder\Autoload::register();

$fixture = $argv[1];
$package = \Pagecraft\Builder\PortablePagePackage::fromFile($fixture);
pc_assert($package->manifest()->entryPageId === 'page-import-fixture', 'Entry page was not validated.');
pc_assert($package->provenance()->sourceId === 'cloud-project-fixture', 'Provenance was not retained.');

$importer = new \Pagecraft\Builder\PageImporter();
$first = $importer->import($package);
pc_assert(!$first->replaced && $first->revisionId === null, 'New import was treated as replacement.');
pc_assert($GLOBALS['pc_posts'][$first->postId]['post_type'] === 'page', 'Import did not create a native page.');
pc_assert($GLOBALS['pc_posts'][$first->postId]['post_status'] === 'draft', 'New import did not default to draft.');
pc_assert($GLOBALS['pc_posts'][$first->postId]['post_title'] === 'Imported Landing Page', 'Native title was lost.');
pc_assert($GLOBALS['pc_posts'][$first->postId]['post_name'] === 'imported-landing-page', 'Native slug was lost.');
pc_assert(str_contains($GLOBALS['pc_posts'][$first->postId]['post_content'], 'A native Pagecraft page'), 'Fallback content is blank.');
pc_assert(str_contains($GLOBALS['pc_posts'][$first->postId]['post_content'], 'data-pagecraft-fallback="1"'), 'Fallback ownership marker is missing.');
pc_assert(
    ($GLOBALS['pc_meta'][$first->postId]['_pagecraft_source_project_id'] ?? '') === 'cloud-project-fixture',
    'Source project metadata is missing.'
);
pc_assert(
    ($GLOBALS['pc_meta'][$first->postId]['_pagecraft_compiled_hash'] ?? '')
        === hash('sha256', $GLOBALS['pc_posts'][$first->postId]['post_content']),
    'Compiled fallback hash is wrong.'
);

$second = $importer->import($package);
pc_assert($second->postId !== $first->postId, 'Reimport silently overwrote the first page.');
pc_assert(count($GLOBALS['pc_posts']) === 2, 'Reimport did not default to a new page.');

$before = $GLOBALS['pc_posts'][$first->postId];
try {
    $importer->import($package, ['replace_post_id' => $first->postId]);
    throw new RuntimeException('Unconfirmed replacement was accepted.');
} catch (\Pagecraft\Builder\PackageException $error) {
    pc_assert(str_contains($error->getMessage(), 'explicit confirmation'), 'Unconfirmed replacement error is unclear.');
}
pc_assert($GLOBALS['pc_posts'][$first->postId] === $before, 'Unconfirmed replacement changed the page.');
pc_assert($GLOBALS['pc_revisions'] === [], 'Unconfirmed replacement created a revision.');

$nativeId = 500;
$GLOBALS['pc_posts'][$nativeId] = [
    'ID' => $nativeId, 'post_type' => 'page', 'post_title' => 'Gutenberg',
    'post_name' => 'gutenberg', 'post_status' => 'publish', 'post_author' => 7,
    'post_content' => '<p>Native content</p>',
];
$GLOBALS['pc_meta'][$nativeId] = [];
try {
    $importer->import($package, ['replace_post_id' => $nativeId, 'confirm_replace' => true]);
    throw new RuntimeException('An unmanaged WordPress page was overwritten.');
} catch (\Pagecraft\Builder\PackageException $error) {
    pc_assert(str_contains($error->getMessage(), 'not a Pagecraft-managed page'), 'Native-page protection is unclear.');
}
pc_assert($GLOBALS['pc_posts'][$nativeId]['post_content'] === '<p>Native content</p>', 'Native WordPress content changed.');

$GLOBALS['pc_posts'][$first->postId]['post_title'] = 'Native title stays';
$GLOBALS['pc_posts'][$first->postId]['post_name'] = 'native-slug-stays';
$GLOBALS['pc_posts'][$first->postId]['post_status'] = 'private';
$GLOBALS['pc_posts'][$first->postId]['post_author'] = 8;
$GLOBALS['pc_posts'][$first->postId]['post_content'] = '<p>Local edit to recover</p>';
$GLOBALS['pc_meta'][$first->postId]['_thumbnail_id'] = '88';
$GLOBALS['pc_meta'][$first->postId]['_yoast_wpseo_title'] = 'SEO integration stays';
$GLOBALS['pc_events'] = [];
$replaced = $importer->import($package, [
    'replace_post_id' => $first->postId,
    'confirm_replace' => true,
]);
pc_assert($replaced->replaced && $replaced->revisionId !== null, 'Confirmed replacement has no revision.');
pc_assert($GLOBALS['pc_events'][0][0] === 'revision' && $GLOBALS['pc_events'][1][0] === 'update', 'Revision was not created before replacement.');
$revision = $GLOBALS['pc_revisions'][$replaced->revisionId];
pc_assert($revision['post']['post_content'] === '<p>Local edit to recover</p>', 'Revision did not preserve local content.');
pc_assert($GLOBALS['pc_posts'][$first->postId]['post_title'] === 'Native title stays', 'Replacement changed native title.');
pc_assert($GLOBALS['pc_posts'][$first->postId]['post_name'] === 'native-slug-stays', 'Replacement changed native slug.');
pc_assert($GLOBALS['pc_posts'][$first->postId]['post_status'] === 'private', 'Replacement changed native status.');
pc_assert($GLOBALS['pc_posts'][$first->postId]['post_author'] === 8, 'Replacement changed native author.');
pc_assert($GLOBALS['pc_meta'][$first->postId]['_thumbnail_id'] === '88', 'Replacement changed featured image.');
pc_assert($GLOBALS['pc_meta'][$first->postId]['_yoast_wpseo_title'] === 'SEO integration stays', 'Replacement changed integration metadata.');
pc_assert(str_contains($GLOBALS['pc_posts'][$first->postId]['post_content'], 'A native Pagecraft page'), 'Confirmed replacement did not update content.');

$tampered = tempnam(sys_get_temp_dir(), 'pagecraft-tampered-');
if ($tampered === false || !copy($fixture, $tampered)) {
    throw new RuntimeException('Could not create the tampered fixture.');
}
$zip = new ZipArchive();
pc_assert($zip->open($tampered) === true, 'Could not open tampered fixture.');
$zip->addFromString('compiled/imported-landing-page.html', '<main id="pagecraft-main">tampered</main>');
$zip->close();
try {
    \Pagecraft\Builder\PortablePagePackage::fromFile($tampered);
    throw new RuntimeException('Tampered package was accepted.');
} catch (\Pagecraft\Builder\PackageException $error) {
    pc_assert(str_contains($error->getMessage(), 'integrity verification'), 'Tampered-package error is unclear.');
}
unlink($tampered);

$cmsFixture = tempnam(sys_get_temp_dir(), 'pagecraft-cms-');
if ($cmsFixture === false || !copy($fixture, $cmsFixture)) {
    throw new RuntimeException('Could not create the CMS fixture.');
}
$zip = new ZipArchive();
pc_assert($zip->open($cmsFixture) === true, 'Could not open CMS fixture.');
$documentSource = $zip->getFromName('source/document.json');
$manifestSource = $zip->getFromName('manifest.json');
pc_assert(is_string($documentSource) && is_string($manifestSource), 'CMS fixture source is missing.');
$document = \Pagecraft\Builder\CanonicalJson::decodeObject($documentSource, 'fixture document');
$document->meta->collections = [(object) [
    'id' => 'posts', 'name' => 'Posts', 'slug' => 'posts', 'detail' => '',
    'fields' => [], 'items' => [],
]];
$documentSource = \Pagecraft\Builder\CanonicalJson::encode($document);
$manifest = \Pagecraft\Builder\CanonicalJson::decodeObject($manifestSource, 'fixture manifest');
foreach ($manifest->files as $record) {
    if ($record->path === 'source/document.json') {
        $record->bytes = strlen($documentSource);
        $record->sha256 = hash('sha256', $documentSource);
    }
}
$manifest->contentHash = hash('sha256', \Pagecraft\Builder\CanonicalJson::encode($manifest->files));
$zip->addFromString('source/document.json', $documentSource);
$zip->addFromString('manifest.json', \Pagecraft\Builder\CanonicalJson::encode($manifest));
$zip->close();
try {
    \Pagecraft\Builder\PortablePagePackage::fromFile($cmsFixture);
    throw new RuntimeException('CMS package was accepted by changing only its dependency claim.');
} catch (\Pagecraft\Builder\PackageException $error) {
    pc_assert(str_contains($error->getMessage(), 'CMS content must be flattened'), 'CMS rejection is unclear.');
}
unlink($cmsFixture);

$traversal = tempnam(sys_get_temp_dir(), 'pagecraft-traversal-');
if ($traversal === false) {
    throw new RuntimeException('Could not create traversal fixture.');
}
$zip = new ZipArchive();
pc_assert($zip->open($traversal, ZipArchive::OVERWRITE) === true, 'Could not open traversal fixture.');
$zip->addFromString('../outside.txt', 'outside');
$zip->addFromString('manifest.json', '{}');
$zip->close();
try {
    \Pagecraft\Builder\PortablePagePackage::fromFile($traversal);
    throw new RuntimeException('Path-traversing package was accepted.');
} catch (\Pagecraft\Builder\PackageException $error) {
    pc_assert(str_contains($error->getMessage(), 'path traversal'), 'Traversal rejection is unclear.');
}
unlink($traversal);

echo "Native WordPress page import and revision contract is valid.\n";
