<?php
/**
 * Plugin Name: Pagecraft Connector
 * Plugin URI: https://build.itspagecraft.com/
 * Update URI: https://build.itspagecraft.com/updates/pagecraft-connector
 * Description: Securely synchronizes signed Pagecraft releases into WordPress while Pagecraft remains the source of truth.
 * Version: 0.1.0
 * Requires at least: 6.6
 * Requires PHP: 8.1
 * Author: Pagecraft
 * License: GPL-3.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-3.0.html
 * Text Domain: pagecraft-connector
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

define('PAGECRAFT_CONNECTOR_VERSION', '0.1.0');
define('PAGECRAFT_CONNECTOR_FILE', __FILE__);
define('PAGECRAFT_CONNECTOR_DIR', plugin_dir_path(__FILE__));
define('PAGECRAFT_CONNECTOR_URL', plugin_dir_url(__FILE__));

require_once PAGECRAFT_CONNECTOR_DIR . 'includes/Autoload.php';
\Pagecraft\Connector\Autoload::register();

register_activation_hook(__FILE__, [\Pagecraft\Connector\Activation::class, 'activate']);
register_deactivation_hook(__FILE__, [\Pagecraft\Connector\Activation::class, 'deactivate']);

add_action('plugins_loaded', static function (): void {
    if (is_multisite() || version_compare(PHP_VERSION, '8.1', '<') || version_compare((string) get_bloginfo('version'), '6.6', '<')) {
        add_action('admin_notices', static function (): void {
            echo '<div class="notice notice-error"><p>' . esc_html__('Pagecraft Connector requires a single-site WordPress 6.6+ installation and PHP 8.1 or later.', 'pagecraft-connector') . '</p></div>';
        });
        return;
    }

    \Pagecraft\Connector\Plugin::instance()->boot();
});

/**
 * Return the active Pagecraft release, or null when no release is active.
 *
 * @return array<string,mixed>|null
 */
function pagecraft_get_active_release(): ?array
{
    if (!class_exists(\Pagecraft\Connector\Plugin::class)) {
        return null;
    }

    return \Pagecraft\Connector\Plugin::instance()->releases()->active();
}

/**
 * Render the body HTML for a managed route.
 *
 * When no path is supplied, the current request path is resolved. Null means that Pagecraft
 * does not own the route and WordPress should continue with its normal template hierarchy.
 */
function pagecraft_render_route(?string $path = null): ?string
{
    if (!class_exists(\Pagecraft\Connector\Plugin::class)) {
        return null;
    }

    return \Pagecraft\Connector\Plugin::instance()->renderer()->renderRoute($path);
}

/**
 * Render active Pagecraft content for a managed WordPress post.
 *
 * @param int|null $post_id Defaults to the current post.
 */
function pagecraft_render_managed_content(?int $post_id = null): string
{
    if (!class_exists(\Pagecraft\Connector\Plugin::class)) {
        return '';
    }

    return \Pagecraft\Connector\Plugin::instance()->renderer()->renderManagedContent($post_id);
}
