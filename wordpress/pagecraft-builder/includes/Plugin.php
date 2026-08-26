<?php

declare(strict_types=1);

namespace Pagecraft\Builder;

final class Plugin
{
    private static ?self $instance = null;
    private bool $booted = false;

    public static function instance(): self
    {
        return self::$instance ??= new self();
    }

    private function __construct()
    {
    }

    public function boot(): void
    {
        if ($this->booted) {
            return;
        }
        $this->booted = true;

        load_plugin_textdomain('pagecraft-builder', false, dirname(plugin_basename(PAGECRAFT_BUILDER_FILE)) . '/languages');
        add_action('init', [ManagedPage::class, 'register']);
        add_action('init', [GlobalElement::class, 'register']);
        (new RestController())->register();
        (new Admin())->register();
        do_action('pagecraft_builder_loaded', PAGECRAFT_BUILDER_VERSION);
    }
}
