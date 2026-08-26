<?php

declare(strict_types=1);

use Pagecraft\Connector\Support;

define('ABSPATH', dirname(__DIR__, 5) . '/');
define('PAGECRAFT_CONNECTOR_DIR', dirname(__DIR__) . '/');
define('PAGECRAFT_CONNECTOR_VERSION', '0.1.0');
define('MINUTE_IN_SECONDS', 60);
define('HOUR_IN_SECONDS', 3600);
define('DAY_IN_SECONDS', 86400);
define('MB_IN_BYTES', 1048576);
define('AUTH_KEY', 'pagecraft-unit-test-auth-key-not-for-production');
define('ARRAY_A', 'ARRAY_A');
define('OBJECT', 'OBJECT');

if (!function_exists('sodium_crypto_sign_seed_keypair')) {
    throw new RuntimeException('The connector unit suite requires Sodium for Ed25519 vectors.');
}

$rootDerEncoded = strtr('MC4CAQAwBQYDK2VwBCIEIAfeCT4-i2gK-kDDZNAmzFNt1KRreItHOq14dLd-vV26', '-_', '+/');
$rootDerEncoded .= str_repeat('=', (4 - strlen($rootDerEncoded) % 4) % 4);
$rootDer = base64_decode($rootDerEncoded, true);
if (!is_string($rootDer) || strlen($rootDer) < SODIUM_CRYPTO_SIGN_SEEDBYTES) {
    throw new RuntimeException('Could not load the shared golden root key seed.');
}
$rootPair = sodium_crypto_sign_seed_keypair(substr($rootDer, -SODIUM_CRYPTO_SIGN_SEEDBYTES));
$GLOBALS['pagecraft_test_root_secret'] = sodium_crypto_sign_secretkey($rootPair);
$rootPublic = sodium_crypto_sign_publickey($rootPair);
define('PAGECRAFT_CONNECTOR_ALLOW_LOCAL_ROOT_OVERRIDE', true);
define('PAGECRAFT_CONNECTOR_LOCAL_ROOT_PUBLIC_KEY', rtrim(strtr(base64_encode($rootPublic), '+/', '-_'), '='));

$GLOBALS['pagecraft_test_options'] = [];
$GLOBALS['pagecraft_test_transients'] = [];
$GLOBALS['pagecraft_test_environment'] = 'local';
$GLOBALS['pagecraft_test_home'] = 'http://localhost:8088';
$GLOBALS['pagecraft_test_user_id'] = 7;
$GLOBALS['pagecraft_test_theme_dependency_ids'] = [];
$GLOBALS['pagecraft_test_filters'] = [];
$GLOBALS['pagecraft_test_actions'] = [];
$GLOBALS['pagecraft_test_registered_actions'] = [];
$GLOBALS['pagecraft_test_scheduled_events'] = [];
$GLOBALS['pagecraft_test_cache_calls'] = [];
$GLOBALS['pagecraft_test_active_release'] = null;
$GLOBALS['pagecraft_test_multisite'] = false;
$GLOBALS['pagecraft_test_http_handler'] = null;
$GLOBALS['pagecraft_test_update_option_handler'] = null;
$GLOBALS['pagecraft_test_add_option_handler'] = null;
$GLOBALS['pagecraft_test_delete_transient_handler'] = null;
$GLOBALS['pagecraft_test_cached_options'] = [];
$GLOBALS['pagecraft_test_uploads'] = sys_get_temp_dir() . '/pagecraft-connector-unit-' . getmypid();
$GLOBALS['pagecraft_test_attachments'] = [];
$GLOBALS['pagecraft_test_post_meta'] = [];
$GLOBALS['pagecraft_test_next_attachment_id'] = 1000;
$GLOBALS['pagecraft_test_attachment_files'] = [];
$GLOBALS['pagecraft_test_attachment_mimes'] = [];
$GLOBALS['pagecraft_test_attachment_titles'] = [];
$GLOBALS['pagecraft_test_image_mimes'] = [];
$GLOBALS['pagecraft_test_posts'] = [];
$GLOBALS['pagecraft_test_permalinks'] = [];
$GLOBALS['pagecraft_test_url_post_ids'] = [];
$GLOBALS['pagecraft_test_post_types'] = [];
$GLOBALS['pagecraft_test_post_type_archives'] = [];
$GLOBALS['pagecraft_test_taxonomies'] = [];
$GLOBALS['pagecraft_test_terms'] = [];
$GLOBALS['pagecraft_test_users'] = [];
$GLOBALS['pagecraft_test_nonce_fields'] = [];
$GLOBALS['pagecraft_test_meta_boxes_added'] = [];
$GLOBALS['pagecraft_test_meta_boxes_removed'] = [];
$GLOBALS['pagecraft_test_deleted_posts'] = [];
$GLOBALS['pagecraft_test_deleted_attachments'] = [];

if (!class_exists('WP_Post')) {
    class WP_Post
    {
        public int $ID = 0;
        public string $post_type = 'post';
        public string $post_title = '';
        public string $post_name = '';
        public string $post_content = '';
        public string $post_excerpt = '';
        public string $post_status = 'publish';
        public string $post_modified_gmt = '2026-01-01 00:00:00';
        public string $post_password = '';
        public string $post_date = '2026-01-01 00:00:00';
        public string $post_date_gmt = '2026-01-01 00:00:00';
        public string $comment_status = 'closed';
        public string $ping_status = 'closed';
        public int $post_parent = 0;
        public int $menu_order = 0;

        /** @param array<string,mixed> $data */
        public function __construct(array $data = [])
        {
            foreach ($data as $key => $value) {
                if (property_exists($this, (string) $key)) {
                    $this->{$key} = $value;
                }
            }
        }
    }
}

if (!class_exists('WP_Query')) {
    class WP_Query
    {
        /** @var array<string,mixed> */
        public array $query_vars = [];
        public bool $is_page = false;
        public bool $is_singular = false;
        public bool $is_home = false;
        public bool $is_posts_page = false;
        public bool $is_404 = true;
        public function __construct(private bool $main = true) {}
        public function is_main_query(): bool { return $this->main; }
        public function set(string $key, mixed $value): void { $this->query_vars[$key] = $value; }
        public function get(string $key): mixed { return $this->query_vars[$key] ?? null; }
    }
}

final class PagecraftTestRewrite
{
    public string $author_base = 'author';
    /** @var array<string,string> */
    public array $rules = [];
    /** @return array<string,string> */
    public function wp_rewrite_rules(): array { return $this->rules; }
}

$GLOBALS['wp_rewrite'] = new PagecraftTestRewrite();

final class PagecraftTestWpdb
{
    public string $prefix = 'wp_';
    public string $posts = 'wp_posts';
    public string $postmeta = 'wp_postmeta';
    public string $options = 'wp_options';
    /** @var list<mixed> */
    public array $preparedArgs = [];
    /** @var array<string,array<string,mixed>> */
    public array $scriptApprovals = [];
    /** @var array<string,string> */
    public array $routeBodies = [];
    /** @var list<array<string,mixed>> */
    public array $formInserts = [];
    /** @var list<array<string,mixed>> */
    public array $formUpdates = [];
    /** @var list<array<string,mixed>> */
    public array $routeInserts = [];
    /** @var array<string,array<string,mixed>> */
    public array $releaseRows = [];
    /** @var list<array<string,mixed>> */
    public array $routeRows = [];
    /** @var list<array<string,mixed>> */
    public array $objectRows = [];
    /** @var list<array<string,mixed>> */
    public array $redirectRows = [];
    /** @var array<string,mixed>|null */
    private ?array $transactionSnapshot = null;
    public string $failRetentionDeleteTable = '';
    /** @var list<int> */
    public array $failObjectReferenceCountIds = [];
    public int $objectResultQueries = 0;
    /** @var list<array<string,mixed>> */
    public array $cmsDraftInserts = [];
    /** @var list<string> */
    public array $cmsDraftEvents = [];
    public int $insert_id = 0;

    public function get_charset_collate(): string
    {
        return 'DEFAULT CHARACTER SET utf8mb4';
    }

    public function esc_like(string $text): string
    {
        return addcslashes($text, '_%\\');
    }

    public function prepare(string $query, mixed ...$args): string
    {
        $this->preparedArgs = $args;
        return $query;
    }

    public function query(string $query): int|false
    {
        $transaction = strtoupper(trim($query));
        if ($transaction === 'START TRANSACTION') {
            $this->transactionSnapshot = [
                'releases' => $this->releaseRows,
                'routes' => $this->routeRows,
                'objects' => $this->objectRows,
                'redirects' => $this->redirectRows,
            ];
            return 1;
        }
        if ($transaction === 'COMMIT') {
            $this->transactionSnapshot = null;
            return 1;
        }
        if ($transaction === 'ROLLBACK') {
            if (is_array($this->transactionSnapshot)) {
                $this->releaseRows = $this->transactionSnapshot['releases'];
                $this->routeRows = $this->transactionSnapshot['routes'];
                $this->objectRows = $this->transactionSnapshot['objects'];
                $this->redirectRows = $this->transactionSnapshot['redirects'];
            }
            $this->transactionSnapshot = null;
            return 1;
        }
        if (str_starts_with(ltrim($query), 'UPDATE wp_options SET option_value')) {
            $next = (string) ($this->preparedArgs[0] ?? '');
            $optionName = (string) ($this->preparedArgs[1] ?? '');
            $expected = (string) ($this->preparedArgs[2] ?? '');
            $current = array_key_exists($optionName, $GLOBALS['pagecraft_test_options'])
                ? (string) maybe_serialize($GLOBALS['pagecraft_test_options'][$optionName])
                : null;
            if ($current === null || !hash_equals($expected, $current)) {
                return 0;
            }
            $GLOBALS['pagecraft_test_options'][$optionName] = maybe_unserialize($next);
            return 1;
        }
        if (str_contains($query, 'pagecraft_cms_drafts') && str_contains($query, "SET status = 'superseded'")) {
            $this->cmsDraftEvents[] = 'supersede';
            return 1;
        }
        if (str_starts_with(ltrim($query), 'INSERT IGNORE INTO') && isset($this->preparedArgs[0])) {
            $fingerprint = (string) $this->preparedArgs[0];
            $this->scriptApprovals[$fingerprint] ??= [
                'fingerprint' => $fingerprint,
                'label' => (string) ($this->preparedArgs[1] ?? ''),
                'first_seen' => (string) ($this->preparedArgs[2] ?? ''),
                'approved_at' => null,
                'approved_by' => null,
                'revoked_at' => null,
            ];
        }
        return 1;
    }

    public function get_var(string $query): mixed
    {
        if (str_contains($query, 'FROM wp_options') && str_contains($query, 'option_value')) {
            $optionName = (string) ($this->preparedArgs[0] ?? '');
            return array_key_exists($optionName, $GLOBALS['pagecraft_test_options'])
                ? maybe_serialize($GLOBALS['pagecraft_test_options'][$optionName])
                : null;
        }
        if (str_contains($query, 'pagecraft_routes')) {
            $key = (string) ($this->preparedArgs[0] ?? '') . '|' . (string) ($this->preparedArgs[1] ?? '');
            return $this->routeBodies[$key] ?? null;
        }
        if (str_contains($query, 'pagecraft_rate_limits')) {
            return 1;
        }
        if (str_contains($query, 'pagecraft_objects') && str_contains($query, 'COUNT(*)')) {
            $objectId = (int) ($this->preparedArgs[0] ?? 0);
            if (in_array($objectId, $this->failObjectReferenceCountIds, true)) {
                return null;
            }
            return count(array_filter(
                $this->objectRows,
                static fn (array $row): bool => (int) ($row['object_id'] ?? 0) === $objectId
            ));
        }
        $fingerprint = (string) ($this->preparedArgs[0] ?? '');
        return $this->scriptApprovals[$fingerprint]['approved_at'] ?? null;
    }

    /** @return array<string,mixed>|null */
    public function get_row(string $query, mixed $output = null): ?array
    {
        if (str_starts_with(ltrim($query), 'SHOW TABLE STATUS')) {
            return ['Engine' => 'InnoDB'];
        }
        if (str_contains($query, 'pagecraft_objects')) {
            $this->objectResultQueries++;
            $deploymentId = (string) ($this->preparedArgs[0] ?? '');
            $sourceId = (string) ($this->preparedArgs[1] ?? '');
            $objectId = (int) ($this->preparedArgs[2] ?? 0);
            foreach ($this->objectRows as $row) {
                if ((string) ($row['deployment_id'] ?? '') === $deploymentId
                    && (string) ($row['source_type'] ?? '') === 'cms'
                    && (string) ($row['source_id'] ?? '') === $sourceId
                    && (int) ($row['object_id'] ?? 0) === $objectId
                    && (string) ($row['state'] ?? '') === 'active') {
                    return $row;
                }
            }
            return null;
        }
        if (str_contains($query, 'pagecraft_routes')) {
            $releaseId = (string) ($this->preparedArgs[0] ?? '');
            $needle = $this->preparedArgs[1] ?? null;
            foreach ($this->routeRows as $row) {
                if ((string) ($row['release_id'] ?? '') !== $releaseId) {
                    continue;
                }
                if (str_contains($query, 'route_path = %s') && (string) ($row['route_path'] ?? '') === (string) $needle) {
                    return $row;
                }
                if (str_contains($query, 'post_id = %d') && (int) ($row['post_id'] ?? 0) === (int) $needle) {
                    return $row;
                }
            }
            return null;
        }
        if (str_contains($query, 'pagecraft_releases')) {
            if (str_contains($query, 'WHERE connection_id = %s')) {
                $connectionId = (string) ($this->preparedArgs[0] ?? '');
                $rows = array_values(array_filter($this->releaseRows, static function (array $row) use ($connectionId): bool {
                    $rowConnection = (string) ($row['connection_id'] ?? '');
                    if ($rowConnection === '' && is_string($row['manifest'] ?? null)) {
                        $decoded = json_decode((string) $row['manifest'], true);
                        $rowConnection = is_array($decoded) ? (string) ($decoded['connectionId'] ?? '') : '';
                    }
                    // Test-only legacy rows predate the scoped column. Production
                    // install backfills these values from their signed manifest.
                    return $rowConnection === '' || hash_equals($connectionId, $rowConnection);
                }));
                usort($rows, static fn (array $left, array $right): int => [(int) ($right['sequence_no'] ?? 0), (int) ($right['id'] ?? 0)] <=> [(int) ($left['sequence_no'] ?? 0), (int) ($left['id'] ?? 0)]);
                return $rows[0] ?? null;
            }
            if (!str_contains($query, 'WHERE') && str_contains($query, 'ORDER BY sequence_no DESC')) {
                $rows = array_values($this->releaseRows);
                usort($rows, static fn (array $left, array $right): int => (int) ($right['sequence_no'] ?? 0) <=> (int) ($left['sequence_no'] ?? 0));
                return $rows[0] ?? null;
            }
            $deploymentId = (string) ($this->preparedArgs[0] ?? '');
            if (str_contains($query, 'deployment_id <>')) {
                $connectionId = str_contains($query, 'connection_id = %s') ? (string) ($this->preparedArgs[1] ?? '') : '';
                $siteId = str_contains($query, 'site_id = %s') ? (string) ($this->preparedArgs[2] ?? '') : '';
                $beforeSequence = str_contains($query, 'sequence_no < %d') ? (int) ($this->preparedArgs[3] ?? PHP_INT_MAX) : PHP_INT_MAX;
                $eligible = array_values(array_filter(
                    $this->releaseRows,
                    static fn (array $row): bool => (string) ($row['deployment_id'] ?? '') !== $deploymentId
                        && ($connectionId === '' || hash_equals($connectionId, (string) ($row['connection_id'] ?? '')))
                        && ($siteId === '' || hash_equals($siteId, (string) ($row['site_id'] ?? '')))
                        && (int) ($row['sequence_no'] ?? 0) < $beforeSequence
                        && !empty($row['verified_at'])
                        && in_array((string) ($row['status'] ?? ''), ['active', 'retained'], true)
                ));
                usort($eligible, static fn (array $left, array $right): int => (int) ($right['sequence_no'] ?? 0) <=> (int) ($left['sequence_no'] ?? 0));
                return $eligible[0] ?? null;
            }
            foreach ($this->releaseRows as $row) {
                if ((string) ($row['deployment_id'] ?? '') === $deploymentId
                    || (string) ($row['release_id'] ?? '') === $deploymentId) {
                    return $row;
                }
            }
        }
        if (str_starts_with(ltrim($query), 'SHOW TABLE STATUS')) {
            return ['Engine' => 'InnoDB'];
        }
        return null;
    }

    /** @param array<string,mixed> $data */
    public function insert(string $table, array $data, array $format = []): int|false
    {
        if ($table === $this->options) {
            $optionName = (string) ($data['option_name'] ?? '');
            if ($optionName === '' || array_key_exists($optionName, $GLOBALS['pagecraft_test_options'])) {
                return false;
            }
            $GLOBALS['pagecraft_test_options'][$optionName] = maybe_unserialize($data['option_value'] ?? '');
            return 1;
        }
        if (str_ends_with($table, 'pagecraft_cms_drafts')) {
            if (!empty($GLOBALS['pagecraft_test_fail_cms_draft_insert'])) {
                return false;
            }
            $this->insert_id++;
            $data['id'] = $this->insert_id;
            $this->cmsDraftInserts[] = $data;
            $this->cmsDraftEvents[] = 'insert';
        }
        if (str_ends_with($table, 'pagecraft_forms')) {
            $this->formInserts[] = $data;
        }
        if (str_ends_with($table, 'pagecraft_routes')) {
            $this->routeInserts[] = $data;
        }
        if (str_ends_with($table, 'pagecraft_releases')) {
            $this->releaseRows[(string) ($data['deployment_id'] ?? '')] = $data;
        }
        return 1;
    }

    /** @param array<string,mixed> $where */
    public function delete(string $table, array $where, array $whereFormat = []): int|false
    {
        if ($this->failRetentionDeleteTable !== '' && str_ends_with($table, $this->failRetentionDeleteTable)) {
            return false;
        }
        if (str_ends_with($table, 'pagecraft_routes')) {
            $releaseId = (string) ($where['release_id'] ?? '');
            $before = count($this->routeRows);
            $this->routeRows = array_values(array_filter(
                $this->routeRows,
                static fn (array $row): bool => (string) ($row['release_id'] ?? '') !== $releaseId
            ));
            return $before - count($this->routeRows);
        }
        if (str_ends_with($table, 'pagecraft_redirects')) {
            $releaseId = (string) ($where['release_id'] ?? '');
            $before = count($this->redirectRows);
            $this->redirectRows = array_values(array_filter(
                $this->redirectRows,
                static fn (array $row): bool => (string) ($row['release_id'] ?? '') !== $releaseId
            ));
            return $before - count($this->redirectRows);
        }
        if (str_ends_with($table, 'pagecraft_objects')) {
            $deploymentId = (string) ($where['deployment_id'] ?? '');
            $before = count($this->objectRows);
            $this->objectRows = array_values(array_filter(
                $this->objectRows,
                static fn (array $row): bool => (string) ($row['deployment_id'] ?? '') !== $deploymentId
            ));
            return $before - count($this->objectRows);
        }
        if (str_ends_with($table, 'pagecraft_releases')) {
            $deploymentId = (string) ($where['deployment_id'] ?? '');
            if ($deploymentId !== '') {
                if (!isset($this->releaseRows[$deploymentId])) {
                    return 0;
                }
                unset($this->releaseRows[$deploymentId]);
            }
        }
        return 1;
    }

    /** @return list<mixed> */
    public function get_col(string $query): array
    {
        if (str_contains($query, 'pagecraft_theme_dependencies')) {
            return (array) ($GLOBALS['pagecraft_test_theme_dependency_ids'] ?? []);
        }
        if (str_contains($query, 'pagecraft_releases')) {
            $rows = array_values($this->releaseRows);
            if (str_contains($query, 'connection_id = %s')) {
                $connectionId = (string) ($this->preparedArgs[0] ?? '');
                $siteId = (string) ($this->preparedArgs[1] ?? '');
                $limit = (int) ($this->preparedArgs[2] ?? 5);
                $rows = array_values(array_filter($rows, static fn (array $row): bool =>
                    hash_equals($connectionId, (string) ($row['connection_id'] ?? ''))
                    && hash_equals($siteId, (string) ($row['site_id'] ?? ''))
                    && !empty($row['verified_at'])
                    && in_array((string) ($row['status'] ?? ''), ['active', 'retained'], true)
                ));
                usort($rows, static fn (array $left, array $right): int => (int) ($right['sequence_no'] ?? 0) <=> (int) ($left['sequence_no'] ?? 0));
                $rows = array_slice($rows, 0, $limit);
            } elseif (str_contains($query, "status IN ('staged','installed','needs_approval')")) {
                $rows = array_values(array_filter($rows, static fn (array $row): bool => in_array((string) ($row['status'] ?? ''), ['staged', 'installed', 'needs_approval'], true)));
            } elseif (str_contains($query, 'pinned = 1')) {
                $rows = array_values(array_filter($rows, static fn (array $row): bool => !empty($row['pinned'])));
            } elseif (str_contains($query, 'previous_deployment_id')) {
                return array_values(array_filter(array_map(
                    static fn (array $row): string => (string) ($row['previous_deployment_id'] ?? ''),
                    $rows
                )));
            }
            return array_values(array_map(static fn (array $row): string => (string) ($row['deployment_id'] ?? ''), $rows));
        }
        if (str_contains($query, 'pagecraft_objects') && str_contains($query, 'object_id')) {
            $deploymentId = (string) ($this->preparedArgs[0] ?? '');
            return array_values(array_map(
                static fn (array $row): int => (int) ($row['object_id'] ?? 0),
                array_filter($this->objectRows, static fn (array $row): bool =>
                    (string) ($row['deployment_id'] ?? '') === $deploymentId
                )
            ));
        }
        return [];
    }

    /** @param array<string,mixed> $data @param array<string,mixed> $where */
    public function update(string $table, array $data, array $where, array $format = [], array $whereFormat = []): int|false
    {
        if (str_ends_with($table, 'pagecraft_forms')) {
            $this->formUpdates[] = ['data' => $data, 'where' => $where];
            return 1;
        }
        if (str_ends_with($table, 'pagecraft_releases')) {
            $deploymentId = (string) ($where['deployment_id'] ?? '');
            if ($deploymentId === '' && isset($where['id'])) {
                foreach ($this->releaseRows as $candidateId => $row) {
                    if ((int) ($row['id'] ?? 0) === (int) $where['id']) {
                        $deploymentId = (string) $candidateId;
                        break;
                    }
                }
            }
            if ($deploymentId === '' || !isset($this->releaseRows[$deploymentId])) {
                return 0;
            }
            $currentStatus = (string) ($this->releaseRows[$deploymentId]['status'] ?? '');
            if (isset($where['status']) && !hash_equals((string) $where['status'], $currentStatus)) {
                return 0;
            }
            if ((!empty($GLOBALS['pagecraft_test_fail_release_install']) && (string) ($where['status'] ?? '') === 'staged')
                || (!empty($GLOBALS['pagecraft_test_fail_release_ready']) && (string) ($where['status'] ?? '') === 'needs_approval')
                || (!empty($GLOBALS['pagecraft_test_fail_release_error']) && (string) ($data['status'] ?? '') === 'failed')
                || (!empty($GLOBALS['pagecraft_test_fail_release_backfill']) && isset($data['connection_id'], $data['site_id']))) {
                return false;
            }
            $this->releaseRows[$deploymentId] = array_merge($this->releaseRows[$deploymentId], $data);
            return 1;
        }
        $fingerprint = (string) ($where['fingerprint'] ?? '');
        if ($fingerprint === '' || !isset($this->scriptApprovals[$fingerprint])) {
            return false;
        }
        $this->scriptApprovals[$fingerprint] = array_merge($this->scriptApprovals[$fingerprint], $data);
        return 1;
    }

    /** @return list<array<string,mixed>> */
    public function get_results(string $query, mixed $output = null): array
    {
        if (preg_match('/^SHOW\s+COLUMNS\s+FROM\s+([A-Za-z0-9_]+)/i', trim($query), $matches)) {
            $table = (string) $matches[1];
            $columns = $this->schemaShape()[$table]['columns'] ?? [];
            $missing = (string) ($GLOBALS['pagecraft_test_missing_schema_column'] ?? '');
            return array_values(array_map(
                static fn (string $column): array => ['Field' => $column],
                array_filter($columns, static fn (string $column): bool => $missing !== $table . '.' . $column)
            ));
        }
        if (preg_match('/^SHOW\s+INDEX\s+FROM\s+([A-Za-z0-9_]+)/i', trim($query), $matches)) {
            $table = (string) $matches[1];
            $indexes = $this->schemaShape()[$table]['indexes'] ?? [];
            $missing = (string) ($GLOBALS['pagecraft_test_missing_schema_index'] ?? '');
            $rows = [];
            foreach ($indexes as $index) {
                if ($missing === $table . '.' . $index) {
                    continue;
                }
                $columns = $this->schemaIndexColumns($table, $index);
                foreach ($columns !== [] ? $columns : [$index] as $offset => $column) {
                    $rows[] = ['Key_name' => $index, 'Column_name' => $column, 'Seq_in_index' => $offset + 1];
                }
            }
            return $rows;
        }
        if (str_contains($query, 'pagecraft_objects')) {
            $this->objectResultQueries++;
            $deploymentId = (string) ($this->preparedArgs[0] ?? '');
            $sourceType = str_contains($query, "source_type = 'asset'") ? 'asset' : 'cms';
            return array_values(array_filter($this->objectRows, static fn (array $row): bool =>
                (string) ($row['deployment_id'] ?? '') === $deploymentId
                && (string) ($row['source_type'] ?? '') === $sourceType
                && (string) ($row['state'] ?? '') === 'active'
            ));
        }
        if (str_contains($query, 'pagecraft_releases')) {
            $rows = array_values($this->releaseRows);
            if (str_contains($query, "connection_id = '' OR site_id = ''")) {
                return array_values(array_filter($rows, static fn (array $row): bool =>
                    (string) ($row['connection_id'] ?? '') === '' || (string) ($row['site_id'] ?? '') === ''
                ));
            }
            usort($rows, static fn (array $left, array $right): int => [(int) ($right['sequence_no'] ?? 0), (int) ($right['id'] ?? 0)] <=> [(int) ($left['sequence_no'] ?? 0), (int) ($left['id'] ?? 0)]);
            return $rows;
        }
        return array_values($this->scriptApprovals);
    }

    /** @return array<string,array{columns:list<string>,indexes:list<string>}> */
    private function schemaShape(): array
    {
        return [
            'wp_pagecraft_releases' => [
                'columns' => ['id', 'deployment_id', 'release_id', 'connection_id', 'site_id', 'sequence_no', 'source_version', 'status', 'manifest', 'manifest_hash', 'deployment_hash', 'artifact_hash', 'parent_release_id', 'created_at', 'installed_at', 'activated_at', 'verified_at', 'previous_deployment_id', 'pinned', 'error_code', 'error_message'],
                'indexes' => ['PRIMARY', 'deployment_id', 'release_id', 'connection_sequence', 'site_id', 'sequence_no', 'status', 'verified_at', 'previous_deployment_id'],
            ],
            'wp_pagecraft_routes' => [
                'columns' => ['id', 'release_id', 'route_path', 'page_id', 'post_id', 'title', 'description', 'head_html', 'body_html', 'content_hash', 'seo_json', 'scripts_json'],
                'indexes' => ['PRIMARY', 'release_route', 'page_id', 'post_id'],
            ],
            'wp_pagecraft_objects' => [
                'columns' => ['id', 'deployment_id', 'release_id', 'source_type', 'source_id', 'object_id', 'object_hash', 'target_status', 'state', 'updated_at'],
                'indexes' => ['PRIMARY', 'deployment_source', 'source_state', 'object_id', 'release_id', 'deployment_id'],
            ],
            'wp_pagecraft_redirects' => [
                'columns' => ['id', 'release_id', 'from_path', 'to_path', 'status_code'],
                'indexes' => ['PRIMARY', 'release_from', 'release_id'],
            ],
            'wp_pagecraft_events' => [
                'columns' => ['id', 'event_id', 'connection_id', 'release_id', 'sequence_no', 'body_hash', 'status', 'attempts', 'available_at', 'lease_until', 'received_at', 'error_message'],
                'indexes' => ['PRIMARY', 'event_id', 'queue'],
            ],
            'wp_pagecraft_forms' => [
                'columns' => ['id', 'submission_uuid', 'form_id', 'route_path', 'payload', 'email_hash', 'ip_hash', 'user_agent_hash', 'status', 'created_at', 'expires_at'],
                'indexes' => ['PRIMARY', 'submission_uuid', 'form_id', 'expires_at'],
            ],
            'wp_pagecraft_rate_limits' => [
                'columns' => ['key_hash', 'window_start', 'hits', 'expires_at'],
                'indexes' => ['PRIMARY', 'expires_at'],
            ],
            'wp_pagecraft_script_approvals' => [
                'columns' => ['fingerprint', 'label', 'first_seen', 'approved_at', 'approved_by', 'revoked_at'],
                'indexes' => ['PRIMARY', 'approved_at'],
            ],
            'wp_pagecraft_cms_drafts' => [
                'columns' => ['id', 'connection_id', 'source_id', 'post_id', 'base_release_id', 'payload', 'status', 'attempts', 'available_at', 'created_at', 'updated_at', 'error_message'],
                'indexes' => ['PRIMARY', 'queue', 'source_id', 'post_id'],
            ],
        ];
    }

    /** @return list<string> */
    private function schemaIndexColumns(string $table, string $index): array
    {
        $critical = [
            'wp_pagecraft_releases.connection_sequence' => ['connection_id', 'sequence_no'],
            'wp_pagecraft_routes.release_route' => ['release_id', 'route_path'],
            'wp_pagecraft_objects.deployment_source' => ['deployment_id', 'source_type', 'source_id'],
            'wp_pagecraft_events.queue' => ['status', 'available_at'],
            'wp_pagecraft_cms_drafts.queue' => ['connection_id', 'status', 'available_at'],
        ];
        return $critical[$table . '.' . $index] ?? [];
    }
}

$GLOBALS['wpdb'] = new PagecraftTestWpdb();

if (!class_exists('WP_Error')) {
    final class WP_Error
    {
        public function __construct(private string $code = '', private string $message = '') {}
        public function get_error_code(): string { return $this->code; }
        public function get_error_message(): string { return $this->message; }
    }
}

function wp_parse_url(string $url, int $component = -1): mixed
{
    return $component === -1 ? parse_url($url) : parse_url($url, $component);
}
function wp_get_environment_type(): string { return (string) $GLOBALS['pagecraft_test_environment']; }
function is_multisite(): bool { return (bool) ($GLOBALS['pagecraft_test_multisite'] ?? false); }
function home_url(string $path = ''): string
{
    return rtrim((string) $GLOBALS['pagecraft_test_home'], '/') . '/' . ltrim($path, '/');
}
function admin_url(string $path = ''): string { return home_url('/wp-admin/' . ltrim($path, '/')); }
function rest_url(string $path = ''): string { return home_url('/wp-json/' . ltrim($path, '/')); }
function wp_salt(string $scheme = 'auth'): string { return AUTH_KEY . ':' . $scheme; }
function get_bloginfo(string $field = ''): string { return $field === 'version' ? '6.6' : ''; }
function dbDelta(string $sql): array { return []; }
function get_current_user_id(): int { return (int) $GLOBALS['pagecraft_test_user_id']; }
function wp_generate_uuid4(): string
{
    $hex = bin2hex(random_bytes(16));
    return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-4' . substr($hex, 13, 3)
        . '-a' . substr($hex, 17, 3) . '-' . substr($hex, 20, 12);
}
function wp_generate_password(int $length = 12, bool $special = true, bool $extra = false): string { return substr(str_repeat('unitpass', 4), 0, $length); }
function wp_is_post_revision(int $postId): int|false { return false; }
function wp_is_post_autosave(int $postId): int|false { return false; }
function wp_verify_nonce(string $nonce, string $action = '-1'): int|false { return $nonce !== '' ? 1 : false; }
function wp_nonce_field(string|int $action = -1, string $name = '_wpnonce', bool $referer = true, bool $display = true): string
{
    $field = '<input type="hidden" name="' . esc_attr($name) . '" value="unit-nonce">';
    $GLOBALS['pagecraft_test_nonce_fields'][] = ['action' => (string) $action, 'name' => $name];
    if ($display) echo $field;
    return $field;
}
function add_meta_box(string $id, string $title, callable $callback, string|array|null $screen = null, string $context = 'advanced', string $priority = 'default', mixed $callbackArgs = null): void
{
    $GLOBALS['pagecraft_test_meta_boxes_added'][] = compact('id', 'title', 'screen', 'context', 'priority');
}
function remove_meta_box(string $id, string|array|null $screen, string $context): void
{
    $GLOBALS['pagecraft_test_meta_boxes_removed'][] = compact('id', 'screen', 'context');
}
function wp_next_scheduled(string $hook, array $args = []): int|false
{
    foreach ($GLOBALS['pagecraft_test_scheduled_events'] as $event) {
        if ($event['hook'] === $hook && $event['args'] === $args) return (int) $event['timestamp'];
    }
    return false;
}
function wp_schedule_single_event(int $timestamp, string $hook, array $args = [], bool $wpError = false): bool|WP_Error
{
    $GLOBALS['pagecraft_test_scheduled_events'][] = compact('timestamp', 'hook', 'args');
    return true;
}
function wp_clear_scheduled_hook(string $hook, array $args = [], bool $wpError = false): int|false|WP_Error
{
    $removed = 0;
    $GLOBALS['pagecraft_test_scheduled_events'] = array_values(array_filter(
        $GLOBALS['pagecraft_test_scheduled_events'],
        static function (array $event) use ($hook, $args, &$removed): bool {
            if ($event['hook'] === $hook && $event['args'] === $args) {
                $removed++;
                return false;
            }
            return true;
        }
    ));
    return $removed;
}
function maybe_serialize(mixed $value): mixed { return is_array($value) || is_object($value) ? serialize($value) : $value; }
function maybe_unserialize(mixed $value): mixed
{
    if (!is_string($value) || !preg_match('/^(?:a|O|s|i|b|d|N):/', $value)) return $value;
    $decoded = @unserialize($value);
    return $decoded === false && $value !== 'b:0;' ? $value : $decoded;
}
function wp_upload_dir(): array
{
    $root = (string) $GLOBALS['pagecraft_test_uploads'];
    if (!is_dir($root)) mkdir($root, 0777, true);
    return ['basedir' => $root, 'baseurl' => 'http://localhost/uploads', 'error' => false];
}
function wp_mkdir_p(string $path): bool { return is_dir($path) || mkdir($path, 0777, true); }
function trailingslashit(string $path): string { return rtrim($path, '/\\') . '/'; }
function sanitize_file_name(string $name): string { return trim((string) preg_replace('/[^A-Za-z0-9._-]+/', '-', $name), '-'); }
function wp_delete_file(string $file): void { if (is_file($file)) unlink($file); }
function wp_unique_filename(string $directory, string $filename): string
{
    $candidate = $filename;
    $extension = pathinfo($filename, PATHINFO_EXTENSION);
    $stem = $extension === '' ? $filename : substr($filename, 0, -(strlen($extension) + 1));
    for ($suffix = 1; is_file(trailingslashit($directory) . $candidate); $suffix++) {
        $candidate = $stem . '-' . $suffix . ($extension === '' ? '' : '.' . $extension);
    }
    return $candidate;
}
function wp_insert_attachment(array $args, string|false $file = false, int $parentPostId = 0, bool $wpError = false): int|WP_Error
{
    $id = ++$GLOBALS['pagecraft_test_next_attachment_id'];
    $GLOBALS['pagecraft_test_attachments'][$id] = ['args' => $args, 'file' => $file, 'parent' => $parentPostId];
    return $id;
}
function clean_post_cache(int $postId): void {}
function update_post_meta(int $postId, string $key, mixed $value): bool
{
    $GLOBALS['pagecraft_test_post_meta'][$postId][$key] = $value;
    return true;
}
function get_post_type(int $postId = 0): string|false
{
    if (isset($GLOBALS['pagecraft_test_posts'][$postId]) && $GLOBALS['pagecraft_test_posts'][$postId] instanceof WP_Post) {
        return $GLOBALS['pagecraft_test_posts'][$postId]->post_type;
    }
    return isset($GLOBALS['pagecraft_test_attachment_files'][$postId]) ? 'attachment' : false;
}
function url_to_postid(string $url): int { return (int) ($GLOBALS['pagecraft_test_url_post_ids'][$url] ?? 0); }
function get_post(int $postId = 0, mixed $output = OBJECT): WP_Post|array|null
{
    $post = $GLOBALS['pagecraft_test_posts'][$postId] ?? null;
    if (!$post instanceof WP_Post) return null;
    return $output === ARRAY_A ? get_object_vars($post) : $post;
}
function wp_delete_post(int $postId = 0, bool $forceDelete = false): WP_Post|false|null
{
    $post = get_post($postId);
    if (!$post instanceof WP_Post) return null;
    $delete = null;
    foreach ((array) ($GLOBALS['pagecraft_test_filters']['pre_delete_post'] ?? []) as $callback) {
        $delete = $callback($delete, $post);
    }
    if ($delete === false) return false;
    $GLOBALS['pagecraft_test_deleted_posts'][] = [
        'id' => $postId,
        'force' => $forceDelete,
        'trusted' => \Pagecraft\Connector\ReleaseRepository::isDeletingManagedObject(),
    ];
    unset($GLOBALS['pagecraft_test_posts'][$postId], $GLOBALS['pagecraft_test_post_meta'][$postId]);
    return $post;
}
function wp_delete_attachment(int $postId = 0, bool $forceDelete = false): WP_Post|false|null
{
    $post = get_post($postId);
    if (!$post instanceof WP_Post) return null;
    $delete = null;
    foreach ((array) ($GLOBALS['pagecraft_test_filters']['pre_delete_attachment'] ?? []) as $callback) {
        $delete = $callback($delete, $post, $forceDelete);
    }
    if ($delete === false) return false;
    $GLOBALS['pagecraft_test_deleted_attachments'][] = [
        'id' => $postId,
        'force' => $forceDelete,
        'trusted' => \Pagecraft\Connector\ReleaseRepository::isDeletingManagedObject(),
    ];
    unset($GLOBALS['pagecraft_test_posts'][$postId], $GLOBALS['pagecraft_test_post_meta'][$postId]);
    return $post;
}
function get_posts(array $args = []): array
{
    $types = $args['post_type'] ?? ['post'];
    $types = is_array($types) ? $types : [$types];
    $statuses = $args['post_status'] ?? ['publish'];
    $statuses = is_array($statuses) ? $statuses : [$statuses];
    $posts = array_values(array_filter(
        $GLOBALS['pagecraft_test_posts'],
        static fn (mixed $post): bool => $post instanceof WP_Post
            && in_array($post->post_type, $types, true)
            && in_array($post->post_status, $statuses, true)
    ));
    usort($posts, static fn (WP_Post $left, WP_Post $right): int => [$left->post_type, $left->ID] <=> [$right->post_type, $right->ID]);
    $perPage = max(1, (int) ($args['posts_per_page'] ?? $args['numberposts'] ?? 5));
    $page = max(1, (int) ($args['paged'] ?? 1));
    return array_slice($posts, ($page - 1) * $perPage, $perPage);
}
function get_permalink(int|WP_Post $post): string|false
{
    $post = $post instanceof WP_Post ? $post : get_post($post);
    if (!$post instanceof WP_Post) return false;
    if (array_key_exists($post->ID, $GLOBALS['pagecraft_test_permalinks'])) {
        $value = $GLOBALS['pagecraft_test_permalinks'][$post->ID];
        return is_string($value) ? $value : false;
    }
    return home_url('/' . trim($post->post_name, '/') . '/');
}
function get_post_meta(int $postId, string $key = '', bool $single = false): mixed
{
    if ($key === '') return $GLOBALS['pagecraft_test_post_meta'][$postId] ?? [];
    $exists = array_key_exists($key, $GLOBALS['pagecraft_test_post_meta'][$postId] ?? []);
    $value = $exists ? $GLOBALS['pagecraft_test_post_meta'][$postId][$key] : ($single ? '' : []);
    return $single ? $value : ($exists ? [$value] : []);
}
function get_page_by_path(string $path, mixed $output = OBJECT, string|array $postType = 'page'): WP_Post|array|null
{
    foreach ($GLOBALS['pagecraft_test_posts'] as $post) {
        if ($post instanceof WP_Post && $post->post_type === 'page' && $post->post_name === basename(trim($path, '/'))) {
            return $output === ARRAY_A ? get_object_vars($post) : $post;
        }
    }
    return null;
}
function get_post_types(array $args = [], string $output = 'names'): array { return $GLOBALS['pagecraft_test_post_types']; }
function get_post_type_archive_link(string $postType): string|false { return $GLOBALS['pagecraft_test_post_type_archives'][$postType] ?? false; }
function get_taxonomies(array $args = [], string $output = 'names'): array { return $GLOBALS['pagecraft_test_taxonomies']; }
function get_term_by(string $field, string|int $value, string $taxonomy = '', string $output = OBJECT, string $filter = 'raw'): object|array|false
{
    $term = $GLOBALS['pagecraft_test_terms'][$taxonomy . '|' . $value] ?? false;
    return $term && $output === ARRAY_A ? (array) $term : $term;
}
function get_user_by(string $field, string|int $value): object|false { return $GLOBALS['pagecraft_test_users'][(string) $value] ?? false; }
function current_user_can(string $capability, mixed ...$args): bool { return true; }
function get_attached_file(int $attachmentId, bool $unfiltered = false): string|false
{
    return $GLOBALS['pagecraft_test_attachment_files'][$attachmentId] ?? false;
}
function get_post_mime_type(int $attachmentId = 0): string|false
{
    return $GLOBALS['pagecraft_test_attachment_mimes'][$attachmentId] ?? false;
}
function wp_get_image_mime(string $file): string|false
{
    return $GLOBALS['pagecraft_test_image_mimes'][$file] ?? false;
}
function wp_attachment_is_image(int $attachmentId = 0): bool
{
    return str_starts_with((string) get_post_mime_type($attachmentId), 'image/');
}
function get_the_title(int $postId = 0): string { return (string) ($GLOBALS['pagecraft_test_attachment_titles'][$postId] ?? ''); }
function wp_safe_remote_request(string $url, array $args = []): array|WP_Error
{
    $handler = $GLOBALS['pagecraft_test_http_handler'] ?? null;
    return $handler instanceof Closure
        ? $handler($url, $args)
        : new WP_Error('http_request_failed', 'No unit-test HTTP handler was configured.');
}
function wp_remote_retrieve_response_code(array $response): int { return (int) ($response['response']['code'] ?? 0); }
function wp_remote_retrieve_body(array $response): string { return (string) ($response['body'] ?? ''); }
function wp_remote_retrieve_header(array $response, string $name): string
{
    $headers = is_array($response['headers'] ?? null) ? $response['headers'] : [];
    foreach ($headers as $key => $value) {
        if (strcasecmp((string) $key, $name) === 0) return (string) $value;
    }
    return '';
}
function get_option(string $name, mixed $default = false): mixed
{
    if (array_key_exists($name, $GLOBALS['pagecraft_test_cached_options'] ?? [])) {
        return $GLOBALS['pagecraft_test_cached_options'][$name];
    }
    return $GLOBALS['pagecraft_test_options'][$name] ?? $default;
}
function update_option(string $name, mixed $value, mixed $autoload = null): bool
{
    $handler = $GLOBALS['pagecraft_test_update_option_handler'] ?? null;
    if ($handler instanceof Closure) {
        $result = $handler($name, $value, $autoload);
        if (is_bool($result)) {
            return $result;
        }
    }
    $GLOBALS['pagecraft_test_options'][$name] = $value;
    return true;
}
function delete_option(string $name): bool
{
    unset($GLOBALS['pagecraft_test_options'][$name]);
    return true;
}
function add_option(string $name, mixed $value, string $deprecated = '', mixed $autoload = null): bool
{
    $handler = $GLOBALS['pagecraft_test_add_option_handler'] ?? null;
    if ($handler instanceof Closure) {
        $result = $handler($name, $value, $deprecated, $autoload);
        if (is_bool($result)) return $result;
    }
    if (array_key_exists($name, $GLOBALS['pagecraft_test_options'])) return false;
    $GLOBALS['pagecraft_test_options'][$name] = $value;
    return true;
}
function set_transient(string $name, mixed $value, int $expiration = 0): bool
{
    $GLOBALS['pagecraft_test_transients'][$name] = [$value, $expiration ? time() + $expiration : PHP_INT_MAX];
    return true;
}
function get_transient(string $name): mixed
{
    $item = $GLOBALS['pagecraft_test_transients'][$name] ?? null;
    if (!$item || $item[1] < time()) return false;
    return $item[0];
}
function delete_transient(string $name): bool
{
    $handler = $GLOBALS['pagecraft_test_delete_transient_handler'] ?? null;
    if ($handler instanceof Closure) {
        $result = $handler($name);
        if (is_bool($result)) {
            return $result;
        }
    }
    unset($GLOBALS['pagecraft_test_transients'][$name]);
    return true;
}
function add_query_arg(array $args, string $url): string
{
    $separator = str_contains($url, '?') ? '&' : '?';
    return $url . $separator . http_build_query($args, '', '&', PHP_QUERY_RFC3986);
}
function sanitize_text_field(mixed $value): string { return trim(strip_tags((string) $value)); }
function sanitize_textarea_field(mixed $value): string { return trim(strip_tags((string) $value)); }
function sanitize_key(mixed $value): string { return strtolower((string) preg_replace('/[^a-z0-9_\-]/i', '', (string) $value)); }
function sanitize_title(mixed $value): string { return trim(strtolower((string) preg_replace('/[^A-Za-z0-9]+/', '-', (string) $value)), '-'); }
function wp_kses_post(mixed $value): string { return (string) preg_replace('#<script\b[^>]*>[\s\S]*?</script>#i', '', (string) $value); }
function wp_kses(mixed $value, array $allowedHtml, array $allowedProtocols = []): string { return (string) $value; }
function esc_textarea(mixed $value): string { return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function is_email(mixed $value): string|false { return filter_var((string) $value, FILTER_VALIDATE_EMAIL) ? (string) $value : false; }
function wp_mail(string|array $to, string $subject, string $message, string|array $headers = '', array $attachments = []): bool { return true; }
function wp_strip_all_tags(mixed $value): string { return strip_tags((string) $value); }
function esc_url_raw(mixed $value): string { return (string) $value; }
function esc_url(mixed $value): string { return (string) $value; }
function esc_attr(mixed $value): string { return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function esc_html(mixed $value): string { return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function esc_attr__(string $text, string $domain = 'default'): string { return esc_attr(__($text, $domain)); }
function esc_html__(string $text, string $domain = 'default'): string { return esc_html(__($text, $domain)); }
function wp_json_encode(mixed $value, int $flags = 0, int $depth = 512): string|false { return json_encode($value, $flags, $depth); }
function wp_unslash(mixed $value): mixed { return $value; }
function apply_filters(string $hook, mixed $value, mixed ...$args): mixed { return $value; }
function add_filter(string $hook, callable $callback, int $priority = 10, int $acceptedArgs = 1): bool
{
    $GLOBALS['pagecraft_test_filters'][$hook][] = $callback;
    return true;
}
function add_action(string $hook, callable $callback, int $priority = 10, int $acceptedArgs = 1): bool
{
    $GLOBALS['pagecraft_test_registered_actions'][$hook][] = compact('callback', 'priority', 'acceptedArgs');
    return true;
}
function do_action(string $hook, mixed ...$args): void
{
    $GLOBALS['pagecraft_test_actions'][] = ['hook' => $hook, 'args' => $args];
}
function wp_cache_flush_group(string $group): bool
{
    $GLOBALS['pagecraft_test_cache_calls'][] = 'object:' . $group;
    return true;
}
function wp_cache_delete(string $key, string $group = ''): bool { return true; }
function rocket_clean_domain(): void { $GLOBALS['pagecraft_test_cache_calls'][] = 'wp-rocket'; }
function w3tc_flush_all(): void { $GLOBALS['pagecraft_test_cache_calls'][] = 'w3tc'; }
function wp_cache_clear_cache(): void { $GLOBALS['pagecraft_test_cache_calls'][] = 'wp-super-cache'; }
function is_wp_error(mixed $value): bool { return $value instanceof WP_Error; }
function __(string $text, string $domain = 'default'): string { return $text; }
function is_admin(): bool { return false; }
function status_header(int $code, string $description = ''): void {}
function is_singular(): bool { return false; }
function get_queried_object_id(): int { return 0; }
function pagecraft_get_active_release(): ?array
{
    $release = $GLOBALS['pagecraft_test_active_release'] ?? null;
    return is_array($release) ? $release : null;
}

require_once PAGECRAFT_CONNECTOR_DIR . 'includes/Autoload.php';
\Pagecraft\Connector\Autoload::register();
require_once __DIR__ . '/ConnectorTestCase.php';

/** Reset the fake WordPress state between tests. */
function pagecraft_test_reset_wordpress(): void
{
    unset($GLOBALS['post']);
    $GLOBALS['pagecraft_test_options'] = [];
    $GLOBALS['pagecraft_test_transients'] = [];
    $GLOBALS['pagecraft_test_environment'] = 'local';
    $GLOBALS['pagecraft_test_home'] = 'http://localhost:8088';
    $GLOBALS['pagecraft_test_user_id'] = 7;
    $GLOBALS['pagecraft_test_theme_dependency_ids'] = [];
    $GLOBALS['pagecraft_test_filters'] = [];
    $GLOBALS['pagecraft_test_actions'] = [];
    $GLOBALS['pagecraft_test_registered_actions'] = [];
    $GLOBALS['pagecraft_test_scheduled_events'] = [];
    $GLOBALS['pagecraft_test_cache_calls'] = [];
    $GLOBALS['pagecraft_test_active_release'] = null;
    $GLOBALS['pagecraft_test_multisite'] = false;
    $GLOBALS['pagecraft_test_http_handler'] = null;
    $GLOBALS['pagecraft_test_update_option_handler'] = null;
    $GLOBALS['pagecraft_test_add_option_handler'] = null;
    $GLOBALS['pagecraft_test_delete_transient_handler'] = null;
    $GLOBALS['pagecraft_test_cached_options'] = [];
    $GLOBALS['pagecraft_test_attachments'] = [];
    $GLOBALS['pagecraft_test_post_meta'] = [];
    $GLOBALS['pagecraft_test_next_attachment_id'] = 1000;
    $GLOBALS['pagecraft_test_attachment_files'] = [];
    $GLOBALS['pagecraft_test_attachment_mimes'] = [];
    $GLOBALS['pagecraft_test_attachment_titles'] = [];
    $GLOBALS['pagecraft_test_image_mimes'] = [];
    $GLOBALS['pagecraft_test_posts'] = [];
    $GLOBALS['pagecraft_test_permalinks'] = [];
    $GLOBALS['pagecraft_test_url_post_ids'] = [];
    $GLOBALS['pagecraft_test_post_types'] = [];
    $GLOBALS['pagecraft_test_post_type_archives'] = [];
    $GLOBALS['pagecraft_test_taxonomies'] = [];
    $GLOBALS['pagecraft_test_terms'] = [];
    $GLOBALS['pagecraft_test_users'] = [];
    $GLOBALS['pagecraft_test_nonce_fields'] = [];
    $GLOBALS['pagecraft_test_meta_boxes_added'] = [];
    $GLOBALS['pagecraft_test_meta_boxes_removed'] = [];
    $GLOBALS['pagecraft_test_deleted_posts'] = [];
    $GLOBALS['pagecraft_test_deleted_attachments'] = [];
    $GLOBALS['pagecraft_test_fail_cms_draft_insert'] = false;
    $GLOBALS['pagecraft_test_fail_release_install'] = false;
    $GLOBALS['pagecraft_test_fail_release_ready'] = false;
    $GLOBALS['pagecraft_test_fail_release_error'] = false;
    $GLOBALS['pagecraft_test_fail_release_backfill'] = false;
    $GLOBALS['pagecraft_test_missing_schema_column'] = '';
    $GLOBALS['pagecraft_test_missing_schema_index'] = '';
    $GLOBALS['wp_rewrite'] = new PagecraftTestRewrite();
    $GLOBALS['wpdb'] = new PagecraftTestWpdb();
}

/** @return array<string,mixed> */
function pagecraft_test_keyset_envelope(?string $keyId = null, ?string $releasePublic = null): array
{
    $keyId ??= 'release-unit-v1';
    if ($releasePublic === null) {
        $releasePair = sodium_crypto_sign_seed_keypair(str_repeat("\x22", SODIUM_CRYPTO_SIGN_SEEDBYTES));
        $releasePublic = sodium_crypto_sign_publickey($releasePair);
    }
    $keyset = [
        'format' => 'pagecraft.keyset.v1',
        'generatedAt' => gmdate('c', time() - 60),
        'expiresAt' => gmdate('c', time() + DAY_IN_SECONDS),
        'keys' => [[
            'id' => $keyId,
            'algorithm' => 'Ed25519',
            'publicKey' => Support::base64UrlEncode($releasePublic),
            'notBefore' => gmdate('c', time() - 60),
            'notAfter' => gmdate('c', time() + DAY_IN_SECONDS),
        ]],
    ];
    $canonical = \Pagecraft\Connector\CanonicalJson::encode($keyset);
    $signature = sodium_crypto_sign_detached("pagecraft-keyset-v1\0" . $canonical, $GLOBALS['pagecraft_test_root_secret']);
    return [
        'keyset' => Support::base64UrlEncode($canonical),
        'signature' => Support::base64UrlEncode($signature),
        'rootKeyId' => 'pagecraft-root-v1',
    ];
}
