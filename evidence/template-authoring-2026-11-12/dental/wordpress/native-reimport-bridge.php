<?php
$target='/Users/braudypedorsa/.codex/worktrees/pagecraft-template-authoring/pagecraft/evidence/template-authoring-2026-11-12/dental/package/dental-clinic-a2-0.1.0-r19.pagecraft-site.zip';
$hash='05faa8a606ae9e383ffa10083d5484b96856529c06a6128dfbff7030db66f456';
if (realpath(ABSPATH)!=='/private/tmp/pagecraft-dental-wp-qa-vo13a2hi/wordpress' || get_option('siteurl')!=='http://127.0.0.1:4397' || wp_get_current_user()->user_login!=='site-reviewer' || !current_user_can('manage_options') || !hash_equals($hash,hash_file('sha256',$target))) throw new RuntimeException('Site, account or hash mismatch');
$package=\Pagecraft\Builder\PortablePagePackage::fromFile($target); $source=(string)$package->provenance()->sourceId;
if ($source!=='template:dental-clinic-a2:0.1.0' || (int)$package->provenance()->sourceVersion!==19) throw new RuntimeException('Wrong package source');
$getPages=function()use($source){return get_posts(['post_type'=>'page','post_status'=>'any','numberposts'=>-1,'fields'=>'ids','meta_key'=>\Pagecraft\Builder\ManagedPage::SOURCE_PROJECT_ID,'meta_value'=>$source,'orderby'=>'ID','order'=>'ASC']);};
$before=$getPages(); if ($before!==[17,18,19,20,21,22] || (int)wp_count_posts('attachment')->inherit!==12 || get_post_status(2)!=='publish' || get_post_status(3)!=='draft') throw new RuntimeException('Unexpected QA baseline; refusing reimport');
$heading=function($nodes)use(&$heading){foreach($nodes as $n){if(($n['type']??'')==='heading')return $n['props']['text']??''; $child=$heading($n['children']??[]);if($child!=='')return $child;}return '';};
$old=json_decode((string)get_post_meta(17,\Pagecraft\Builder\ManagedPage::DOCUMENT,true),true,512,JSON_THROW_ON_ERROR);
$sourceDoc=json_decode($package->fullDocumentJson(),true,512,JSON_THROW_ON_ERROR);
$expected=$heading($sourceDoc['pages'][0]['tree']??[]); $beforeHeading=$heading($old['pages'][0]['tree']??[]);
$result=(new \Pagecraft\Builder\WholeProjectImporter())->import($package,['status'=>'draft','replace_site'=>false,'set_homepage'=>false]);
$after=$getPages(); $new=json_decode((string)get_post_meta(17,\Pagecraft\Builder\ManagedPage::DOCUMENT,true),true,512,JSON_THROW_ON_ERROR); $afterHeading=$heading($new['pages'][0]['tree']??[]);
$out=['packageSha256'=>$package->packageHash(),'result'=>$result,'beforePageIds'=>$before,'afterPageIds'=>$after,'attachmentCount'=>(int)wp_count_posts('attachment')->inherit,'beforeHeading'=>$beforeHeading,'afterHeading'=>$afterHeading,'sourceHeading'=>$expected,'baselinePages'=>[2=>get_post_status(2),3=>get_post_status(3)],'pageStatuses'=>array_combine($after,array_map('get_post_status',$after)),'defaultHeader'=>get_option(\Pagecraft\Builder\GlobalElement::DEFAULT_HEADER),'defaultFooter'=>get_option(\Pagecraft\Builder\GlobalElement::DEFAULT_FOOTER)];
echo wp_json_encode($out,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES);
if ($result['created']!==0 || $result['updated']!==6 || $result['absent']!==0 || $after!==$before || $out['attachmentCount']!==12 || $afterHeading!==$expected || in_array(false,array_map(fn($status)=>$status==='draft',$out['pageStatuses']),true)) throw new RuntimeException('Reimport verification failed; inspect output and site');
