<?php
/**
 * Native WordPress page content fallback.
 *
 * @package Pagecraft
 */

?>
<article id="post-<?php the_ID(); ?>" <?php post_class( 'pagecraft-entry' ); ?>>
	<header class="pagecraft-entry-header">
		<?php the_title( '<h1 class="pagecraft-entry-title">', '</h1>' ); ?>
	</header>

	<?php if ( has_post_thumbnail() ) : ?>
		<div class="pagecraft-entry-thumbnail"><?php the_post_thumbnail( 'large' ); ?></div>
	<?php endif; ?>

	<div class="pagecraft-entry-content">
		<?php the_content(); ?>
	</div>
</article>
