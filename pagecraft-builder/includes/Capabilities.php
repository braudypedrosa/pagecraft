<?php

declare(strict_types=1);

namespace Pagecraft\Builder;

final class Capabilities
{
    public const EDIT = 'edit_pagecraft_pages';
    public const IMPORT = 'import_pagecraft_pages';
    public const MANAGE = 'manage_pagecraft_settings';

    /** @var list<string> */
    public const ALL = [self::EDIT, self::IMPORT, self::MANAGE];

    public static function install(): void
    {
        if (
            is_multisite()
            || version_compare(PHP_VERSION, '8.1', '<')
            || version_compare((string) get_bloginfo('version'), '6.6', '<')
        ) {
            deactivate_plugins(plugin_basename(PAGECRAFT_BUILDER_FILE));
            wp_die(esc_html__('Pagecraft Builder requires a single-site WordPress 6.6+ installation and PHP 8.1 or later.', 'pagecraft-builder'));
        }

        $administrator = get_role('administrator');
        if (!$administrator) {
            return;
        }

        foreach (self::ALL as $capability) {
            $administrator->add_cap($capability);
        }

        update_option('pagecraft_builder_version', PAGECRAFT_BUILDER_VERSION, false);
    }
}
