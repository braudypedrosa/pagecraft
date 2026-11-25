<?php
/* WordPress package check for curated template releases, run in place of interactive
   WordPress QA while WordPress is CI-only (user decision, 20 Nov 2026: "Count CI for
   WordPress"). It is the generic form of the plugin's own tests/site-package.php: the same
   Pagecraft Builder classes open each package, recognise it as a site package, select every
   page and require compiled HTML and CSS for it, and confirm selection leaves the full
   document intact. It does not install WordPress or exercise the editor.

   php template-package-wp-check.php <plugin-checkout> <package.zip>... */
declare(strict_types=1);

if ($argc < 3) throw new RuntimeException('Usage: template-package-wp-check.php <plugin-checkout> <package.zip>...');
define('ABSPATH', $argv[1] . '/');
require $argv[1] . '/pagecraft-builder/includes/Autoload.php';
\Pagecraft\Builder\Autoload::register();

$failed = 0;
foreach (array_slice($argv, 2) as $file) {
    try {
        $package = \Pagecraft\Builder\PortablePagePackage::fromFile($file);
        if (!$package->isSite()) throw new RuntimeException('not recognised as a site package');
        $pages = $package->pages();
        if (!$pages) throw new RuntimeException('no pages');
        $before = json_decode($package->fullDocumentJson(), true, 512, JSON_THROW_ON_ERROR);
        $slugs = [];
        foreach ($pages as $page) {
            $id = (string) $page->id;
            $package->selectPage($id);
            if ((string) $package->page()->id !== $id) throw new RuntimeException("page $id: selection used the wrong identity");
            $selected = json_decode($package->documentJson(), true, 512, JSON_THROW_ON_ERROR);
            if (count($selected['pages'] ?? []) !== 1 || ($selected['pages'][0]['id'] ?? '') !== $id) throw new RuntimeException("page $id: not page-scoped");
            if ($package->compiledHtml() === '' || $package->pageCss() === '') throw new RuntimeException("page $id: missing compiled output");
            $slugs[] = (string) ($selected['pages'][0]['slug'] ?? $id);
        }
        $after = json_decode($package->fullDocumentJson(), true, 512, JSON_THROW_ON_ERROR);
        if ($after !== $before) throw new RuntimeException('full document changed by page selection');
        printf("PASS %s sha256:%s pages:%d (%s)\n", basename(dirname($file, 3)) . '/' . basename(dirname($file, 2)), hash_file('sha256', $file), count($pages), implode(', ', $slugs));
    } catch (Throwable $error) {
        $failed++;
        printf("FAIL %s: %s\n", $file, $error->getMessage());
    }
}
exit($failed ? 1 : 0);
