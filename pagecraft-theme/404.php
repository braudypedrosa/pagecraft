<?php
/**
 * Native WordPress not-found fallback.
 *
 * @package Pagecraft
 */

get_header();
?>
<main id="primary" class="pagecraft-fallback-main">
	<section class="pagecraft-empty-state">
		<header class="pagecraft-content-header">
			<h1 class="pagecraft-content-title"><?php esc_html_e( 'Page not found', 'pagecraft' ); ?></h1>
		</header>
		<p><?php esc_html_e( 'The page may have moved or no longer exists. Try searching the site instead.', 'pagecraft' ); ?></p>
		<?php get_search_form(); ?>
	</section>
</main>
<?php
get_footer();
