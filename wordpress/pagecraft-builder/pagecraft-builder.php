<?php
/**
 * Plugin Name: Pagecraft Builder
 * Plugin URI: https://build.itspagecraft.com/
 * Description: Imports and edits Pagecraft content as independently owned native WordPress pages.
 * Version: 0.2.0
 * Requires at least: 6.6
 * Requires PHP: 8.1
 * Author: Pagecraft
 * License: GPL-3.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-3.0.html
 * Text Domain: pagecraft-builder
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

define('PAGECRAFT_BUILDER_VERSION', '0.2.0');
define('PAGECRAFT_BUILDER_FILE', __FILE__);
define('PAGECRAFT_BUILDER_DIR', plugin_dir_path(__FILE__));
define('PAGECRAFT_BUILDER_URL', plugin_dir_url(__FILE__));

require_once PAGECRAFT_BUILDER_DIR . 'includes/Autoload.php';
\Pagecraft\Builder\Autoload::register();

register_activation_hook(__FILE__, [\Pagecraft\Builder\Capabilities::class, 'install']);

add_action('plugins_loaded', static function (): void {
    if (is_multisite() || version_compare(PHP_VERSION, '8.1', '<') || version_compare((string) get_bloginfo('version'), '6.6', '<')) {
        add_action('admin_notices', static function (): void {
            echo '<div class="notice notice-error"><p>'
                . esc_html__('Pagecraft Builder requires a single-site WordPress 6.6+ installation and PHP 8.1 or later.', 'pagecraft-builder')
                . '</p></div>';
        });
        return;
    }

    \Pagecraft\Builder\Plugin::instance()->boot();
});

/**
 * Determine whether a native WordPress page is managed by Pagecraft Builder.
 */
function pagecraft_builder_is_managed_page(?int $post_id = null): bool
{
    $resolved = $post_id ?? (int) get_the_ID();
    return \Pagecraft\Builder\ManagedPage::isManaged($resolved);
}

/**
 * Import a validated Pagecraft page package into native WordPress ownership.
 *
 * New-page import is the default. A caller requesting replacement must provide both a target
 * Pagecraft page ID and explicit confirmation; the importer creates a revision before writing.
 *
 * @param array<string, mixed> $options Import ownership and replacement options.
 */
function pagecraft_builder_import_page_package(
    string $package_file,
    array $options = []
): \Pagecraft\Builder\PageImportResult {
    $package = \Pagecraft\Builder\PortablePagePackage::fromFile($package_file);
    return (new \Pagecraft\Builder\PageImporter())->import($package, $options);
}

/**
 * Explicitly replace the local global header and footer from a page package.
 *
 * Page import never calls this automatically. Site import and the Pagecraft global editor use
 * this separate boundary so importing one page cannot unexpectedly replace site navigation.
 *
 * @return array{header:int,footer:int}
 */
function pagecraft_builder_import_global_elements(string $package_file): array
{
    $package = \Pagecraft\Builder\PortablePagePackage::fromFile($package_file);
    $repository = new \Pagecraft\Builder\GlobalElement();
    return [
        'header' => $repository->import($package, 'header'),
        'footer' => $repository->import($package, 'footer'),
    ];
}
