<?php

declare(strict_types=1);

if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

/*
 * Imported pages are native WordPress content owned by this site. Deliberately delete nothing:
 * page posts, revisions, Pagecraft source metadata, generated CSS, and media must survive
 * uninstall so the Pagecraft Theme can keep rendering the last imported fallback.
 */
