<?php
/**
 * Native WordPress page content fallback.
 *
 * @package Pagecraft
 */

$pagecraft_managed_content = pagecraft_theme_get_managed_content( get_the_ID() );
?>
<article id="post-<?php the_ID(); ?>" <?php post_class( 'pagecraft-entry' ); ?>>
	<header class="pagecraft-entry-header">
		<?php the_title( '<h1 class="pagecraft-entry-title">', '</h1>' ); ?>
	</header>

	<?php if ( has_post_thumbnail() ) : ?>
		<div class="pagecraft-entry-thumbnail"><?php the_post_thumbnail( 'large' ); ?></div>
	<?php endif; ?>

	<div class="pagecraft-entry-content">
		<?php if ( '' !== $pagecraft_managed_content ) : ?>
			<?php
			// The connector returns trusted, sanitized active-release HTML.
			echo $pagecraft_managed_content; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			?>
		<?php else : ?>
			<?php the_content(); ?>
		<?php endif; ?>
	</div>
</article>
