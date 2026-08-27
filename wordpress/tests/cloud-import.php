<?php

declare(strict_types=1);

if ($argc < 2) throw new RuntimeException('Package fixture path is required.');

define('MINUTE_IN_SECONDS', 60);
$GLOBALS['pc_cloud_options'] = [];
$GLOBALS['pc_cloud_transients'] = [];
$GLOBALS['pc_cloud_fixture'] = $argv[1];
$GLOBALS['pc_cloud_calls'] = [];
$GLOBALS['pc_cloud_revoke_access'] = false;

final class WP_Error
{
    public function __construct(private string $message) {}
    public function get_error_message(): string { return $this->message; }
}
function is_wp_error(mixed $value): bool { return $value instanceof WP_Error; }
function apply_filters(string $hook, mixed $value): mixed { return $hook === 'pagecraft_cloud_origin' ? 'https://cloud.test' : $value; }
function untrailingslashit(string $value): string { return rtrim($value, '/'); }
function wp_generate_uuid4(): string { return '11111111-2222-4333-8444-555555555555'; }
function get_option(string $key, mixed $default = false): mixed { return $GLOBALS['pc_cloud_options'][$key] ?? $default; }
function update_option(string $key, mixed $value, bool $autoload = true): bool { $GLOBALS['pc_cloud_options'][$key] = $value; return true; }
function delete_option(string $key): bool { unset($GLOBALS['pc_cloud_options'][$key]); return true; }
function set_transient(string $key, mixed $value, int $ttl): bool { $GLOBALS['pc_cloud_transients'][$key] = $value; return true; }
function get_transient(string $key): mixed { return $GLOBALS['pc_cloud_transients'][$key] ?? false; }
function delete_transient(string $key): bool { unset($GLOBALS['pc_cloud_transients'][$key]); return true; }
function wp_salt(string $scheme = 'auth'): string { return 'test-wordpress-salt-' . $scheme; }
function wp_json_encode(mixed $value, int $flags = 0, int $depth = 512): string|false { return json_encode($value, $flags, $depth); }
function add_query_arg(array|string $args, string|false $url = false): string
{
    $target = (string) $url;
    $parts = parse_url($target);
    parse_str($parts['query'] ?? '', $query);
    foreach ((array) $args as $key => $value) $query[$key] = $value;
    return ($parts['scheme'] ?? 'https') . '://' . ($parts['host'] ?? 'cloud.test')
        . ($parts['path'] ?? '') . '?' . http_build_query($query);
}
function wp_remote_retrieve_response_code(mixed $response): int { return is_array($response) ? (int) ($response['code'] ?? 0) : 0; }
function wp_remote_retrieve_body(mixed $response): string { return is_array($response) ? (string) ($response['body'] ?? '') : ''; }
function wp_remote_post(string $url, array $args): array
{
    $body = json_decode((string) ($args['body'] ?? ''), true);
    $GLOBALS['pc_cloud_calls'][] = ['POST', $url, $body];
    if (str_ends_with($url, '/token')) return ['code' => 200, 'body' => json_encode([
        'access_token' => 'access-secret-token', 'refresh_token' => 'refresh-secret-token',
        'credential_id' => 'credential-one', 'expires_in' => 900,
    ])];
    if (str_ends_with($url, '/revoke')) return ['code' => 200, 'body' => '{"revoked":true}'];
    return ['code' => 404, 'body' => '{"error":"missing"}'];
}
function wp_remote_get(string $url, array $args): array
{
    $GLOBALS['pc_cloud_calls'][] = ['GET', $url, $args['headers']['Authorization'] ?? ''];
    if ($GLOBALS['pc_cloud_revoke_access']) return ['code' => 401, 'body' => '{"error":"unauthorized","reconnect":true}'];
    if (str_ends_with($url, '/projects')) return ['code' => 200, 'body' => json_encode(['projects' => [[
        'id' => 'project-one', 'name' => 'North House', 'pageCount' => 1,
    ]]])];
    if (str_ends_with($url, '/projects/project-one/pages')) return ['code' => 200, 'body' => json_encode([
        'project' => ['id' => 'project-one', 'name' => 'North House'],
        'pages' => [['id' => 'page-one', 'name' => 'Home', 'slug' => 'index']],
    ])];
    if (str_ends_with($url, '/projects/project-one/pages/page-one/package')) {
        copy($GLOBALS['pc_cloud_fixture'], (string) $args['filename']);
        return ['code' => 200, 'body' => ''];
    }
    return ['code' => 404, 'body' => '{"error":"missing"}'];
}
function wp_tempnam(string $filename = '', string $dir = ''): string|false { return tempnam(sys_get_temp_dir(), 'pagecraft-cloud-'); }
function wp_delete_file(string $file): void { if (is_file($file)) unlink($file); }
function pc_cloud_assert(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }

require dirname(__DIR__) . '/pagecraft-builder/includes/Autoload.php';
\Pagecraft\Builder\Autoload::register();

$cloud = new \Pagecraft\Builder\CloudImport();
$callback = 'https://wordpress.test/wp-admin/admin-post.php?action=pagecraft_cloud_callback';
$authorization = $cloud->authorizationUrl($callback);
$query = [];
parse_str((string) parse_url($authorization, PHP_URL_QUERY), $query);
pc_cloud_assert(($query['code_challenge_method'] ?? '') === 'S256', 'Cloud authorization does not require PKCE S256.');
pc_cloud_assert(isset($query['state'], $query['code_challenge']), 'Cloud authorization is missing state or challenge.');
$cloud->complete('authorization-code', (string) $query['state'], $callback);
$stored = (string) ($GLOBALS['pc_cloud_options']['pagecraft_cloud_import_v1'] ?? '');
pc_cloud_assert($stored !== '' && !str_contains($stored, 'access-secret-token') && !str_contains($stored, 'refresh-secret-token'),
    'Cloud credentials were stored in plaintext.');
pc_cloud_assert(count($cloud->projects()) === 1, 'Connected cloud projects were not listed.');
pc_cloud_assert(count($cloud->pages('project-one')['pages']) === 1, 'Connected cloud pages were not listed.');
$download = $cloud->download('project-one', 'page-one');
pc_cloud_assert(hash_file('sha256', $download) === hash_file('sha256', $argv[1]), 'Cloud package download changed the bytes.');
wp_delete_file($download);
$GLOBALS['pc_cloud_revoke_access'] = true;
try {
    $cloud->projects();
    throw new RuntimeException('A revoked cloud credential was accepted.');
} catch (\Pagecraft\Builder\PackageException $error) {
    pc_cloud_assert(str_contains($error->getMessage(), 'Reconnect'), 'Revoked credential recovery is not actionable.');
}
pc_cloud_assert($cloud->connection() === null, 'A revoked cloud credential remained stored locally.');
$GLOBALS['pc_cloud_revoke_access'] = false;
$authorization = $cloud->authorizationUrl($callback);
parse_str((string) parse_url($authorization, PHP_URL_QUERY), $query);
$cloud->complete('second-authorization-code', (string) $query['state'], $callback);
$cloud->disconnect();
pc_cloud_assert($cloud->connection() === null, 'Disconnect retained the local cloud credential.');
pc_cloud_assert(count(array_filter($GLOBALS['pc_cloud_calls'], static fn (array $call): bool => $call[0] === 'POST'
    && str_ends_with($call[1], '/revoke'))) === 1, 'Disconnect did not revoke the server credential.');

echo "Revocable manual Pagecraft Cloud import credentials are valid.\n";
