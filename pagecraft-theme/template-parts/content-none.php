<?php
/**
 * Empty native WordPress fallback.
 *
 * @package Pagecraft
 */
?>
<section class="pagecraft-empty-state">
	<header class="pagecraft-content-header">
		<h1 class="pagecraft-content-title"><?php esc_html_e( 'Nothing found', 'pagecraft' ); ?></h1>
	</header>
	<?php if ( is_search() ) : ?>
		<p><?php esc_html_e( 'No results matched your search. Try a different phrase.', 'pagecraft' ); ?></p>
		<?php get_search_form(); ?>
	<?php else : ?>
		<p><?php esc_html_e( 'There is no content here yet.', 'pagecraft' ); ?></p>
	<?php endif; ?>
</section>
