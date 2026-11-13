<?php
$target='/Users/braudypedorsa/.codex/worktrees/pagecraft-template-authoring/pagecraft/evidence/template-authoring-2026-11-12/dental/package/dental-clinic-a2-0.1.0-r19.pagecraft-site.zip';
$hash='05faa8a606ae9e383ffa10083d5484b96856529c06a6128dfbff7030db66f456';
if (realpath(ABSPATH)!=='/private/tmp/pagecraft-dental-wp-qa-vo13a2hi/wordpress' || get_option('siteurl')!=='http://127.0.0.1:4397' || wp_get_current_user()->user_login!=='site-reviewer' || !current_user_can('manage_options')) throw new RuntimeException('QA environment or administrator mismatch');
if (!hash_equals($hash,hash_file('sha256',$target))) throw new RuntimeException('Package checksum mismatch');
$original=get_posts(['post_type'=>'page','post_status'=>'any','numberposts'=>-1,'fields'=>'ids','orderby'=>'ID','order'=>'ASC']);
if ($original!==[2,3] || get_option(\Pagecraft\Builder\WholeProjectImporter::LINKED_PROJECT,[])) throw new RuntimeException('Site no longer has the expected fresh baseline');
$package=\Pagecraft\Builder\PortablePagePackage::fromFile($target);
if (!$package->isSite() || count($package->pages())!==6 || $package->provenance()->sourceId!=='template:dental-clinic-a2:0.1.0' || (int)$package->provenance()->sourceVersion!==19) throw new RuntimeException('Unexpected package identity');
$result=(new \Pagecraft\Builder\WholeProjectImporter())->import($package,['status'=>'draft','replace_site'=>false,'set_homepage'=>false]);
if ($result['created']!==6 || $result['updated']!==0 || $result['absent']!==0) throw new RuntimeException('Unexpected native import result; inspect site before retry');
$globalIds=[];
foreach (['header','footer'] as $kind) {
  $id=\Pagecraft\Builder\GlobalElement::findForSource($result['projectId'],$kind);
  if ($id<1) throw new RuntimeException('Imported global missing; inspect before retry');
  $globalIds[$kind]=$id;
  update_option($kind==='header' ? \Pagecraft\Builder\GlobalElement::DEFAULT_HEADER : \Pagecraft\Builder\GlobalElement::DEFAULT_FOOTER,$id,false);
}
$posts=get_posts(['post_type'=>'page','post_status'=>'any','numberposts'=>-1,'meta_key'=>\Pagecraft\Builder\ManagedPage::SOURCE_PROJECT_ID,'meta_value'=>$result['projectId'],'orderby'=>'ID','order'=>'ASC']);
$pages=[];
foreach ($posts as $post) {
  if ($post->post_status!=='draft') throw new RuntimeException('Unexpected page status');
  $pages[]=['id'=>$post->ID,'title'=>$post->post_title,'status'=>$post->post_status,'sourceId'=>get_post_meta($post->ID,\Pagecraft\Builder\ManagedPage::SOURCE_PAGE_ID,true),'previewUrl'=>get_preview_post_link($post->ID),'editorUrl'=>admin_url('admin.php?page=pagecraft-editor&post='.$post->ID)];
}
if (count($pages)!==6 || get_post_status(2)!=='publish' || get_post_status(3)!=='draft') throw new RuntimeException('Baseline or imported page count changed unexpectedly');
$contract=json_decode(file_get_contents(WP_PLUGIN_DIR.'/pagecraft-builder/assets/pagecraft-editor-contract.json'),true,512,JSON_THROW_ON_ERROR);
echo wp_json_encode(['site'=>get_option('siteurl'),'packageSha256'=>$package->packageHash(),'importResult'=>$result,'globals'=>$globalIds,'pages'=>$pages,'attachmentCount'=>(int)wp_count_posts('attachment')->inherit,'baselinePages'=>[['id'=>2,'status'=>get_post_status(2)],['id'=>3,'status'=>get_post_status(3)]],'frontPage'=>get_option('page_on_front'),'editorContract'=>$contract],JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES);
