<?php
/** Import one new industry candidate in the isolated, backed-up QA clone. */
if (get_option('home') !== 'http://pagecraft-template-acceptance-2026-10-08.local') {
    throw new RuntimeException('Wrong WordPress QA environment');
}
$user = get_user_by('login', 'pagecraftqa');
if (!$user || !user_can($user, 'manage_options')) throw new RuntimeException('Missing routed QA account');
wp_set_current_user($user->ID);
$package = \Pagecraft\Builder\PortablePagePackage::fromFile($args[0]);
if (!hash_equals($args[1], $package->packageHash())) throw new RuntimeException('Package hash mismatch');
// The retained QA clone is reused between cases. Its original design override is
// backed up separately; remove independent editor experiments before this case.
delete_option('pagecraft_design_stylesheet_v1');
$result = (new \Pagecraft\Builder\WholeProjectImporter())->import($package, [
    'status' => 'publish', 'replace_site' => true, 'set_homepage' => false,
]);
$project = $result['projectId'];
$globals = [];
foreach (['header', 'footer'] as $kind) {
    $globals[$kind] = \Pagecraft\Builder\GlobalElement::findForSource($project, $kind);
    if ($globals[$kind] < 1) throw new RuntimeException('Missing imported global');
    update_option($kind === 'header' ? \Pagecraft\Builder\GlobalElement::DEFAULT_HEADER : \Pagecraft\Builder\GlobalElement::DEFAULT_FOOTER, $globals[$kind], false);
}
$pages = [];
foreach (get_posts(['post_type'=>'page', 'post_status'=>'any', 'posts_per_page'=>-1,
    'meta_key'=>\Pagecraft\Builder\ManagedPage::SOURCE_PROJECT_ID, 'meta_value'=>$project]) as $post) {
    foreach (['header', 'footer'] as $kind) {
        update_post_meta($post->ID, $kind === 'header' ? \Pagecraft\Builder\GlobalElement::PAGE_HEADER_MODE : \Pagecraft\Builder\GlobalElement::PAGE_FOOTER_MODE, 'selected');
        update_post_meta($post->ID, $kind === 'header' ? \Pagecraft\Builder\GlobalElement::PAGE_HEADER_ID : \Pagecraft\Builder\GlobalElement::PAGE_FOOTER_ID, $globals[$kind]);
    }
    $pages[] = ['id'=>$post->ID, 'name'=>$post->post_title, 'url'=>get_permalink($post->ID),
        'editor'=>admin_url('admin.php?page=pagecraft-editor&post='.$post->ID)];
}
echo wp_json_encode(['packageSha256'=>$package->packageHash(), 'result'=>$result, 'pages'=>$pages,
    'wordpress'=>get_bloginfo('version'), 'php'=>PHP_VERSION], JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES);
