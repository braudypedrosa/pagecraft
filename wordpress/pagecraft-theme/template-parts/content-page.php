<?php
/**
 * Native WordPress page content fallback.
 *
 * @package Pagecraft
 */

?>
<?php $pagecraft_managed = pagecraft_theme_is_managed_page( (int) get_the_ID() ); ?>
<article id="post-<?php the_ID(); ?>" <?php post_class( $pagecraft_managed ? 'pagecraft-managed-page' : 'pagecraft-entry' ); ?>>
	<?php if ( $pagecraft_managed ) : ?>
		<div class="pagecraft-managed-content">
			<?php the_content(); ?>
		</div>
	<?php else : ?>
		<header class="pagecraft-entry-header">
			<?php the_title( '<h1 class="pagecraft-entry-title">', '</h1>' ); ?>
		</header>

		<?php if ( has_post_thumbnail() ) : ?>
			<div class="pagecraft-entry-thumbnail"><?php the_post_thumbnail( 'large' ); ?></div>
		<?php endif; ?>

		<div class="pagecraft-entry-content">
			<?php the_content(); ?>
		</div>
	<?php endif; ?>
</article>
