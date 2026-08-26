<?php
/**
 * Native WordPress post fallback.
 *
 * @package Pagecraft
 */
?>
<article id="post-<?php the_ID(); ?>" <?php post_class( 'pagecraft-entry' ); ?>>
	<header class="pagecraft-entry-header">
		<?php
		if ( is_singular() ) {
			the_title( '<h1 class="pagecraft-entry-title">', '</h1>' );
		} else {
			the_title( '<h2 class="pagecraft-entry-title"><a href="' . esc_url( get_permalink() ) . '" rel="bookmark">', '</a></h2>' );
		}
		?>
		<div class="pagecraft-entry-meta">
			<?php
			printf(
				/* translators: 1: Post date. 2: Post author. */
				esc_html__( '%1$s by %2$s', 'pagecraft' ),
				esc_html( get_the_date() ),
				esc_html( get_the_author() )
			);
			?>
		</div>
	</header>

	<?php if ( has_post_thumbnail() ) : ?>
		<div class="pagecraft-entry-thumbnail"><?php the_post_thumbnail( 'large' ); ?></div>
	<?php endif; ?>

	<div class="pagecraft-entry-content">
		<?php
		if ( is_singular() ) {
			the_content();
		} else {
			the_excerpt();
		}
		?>
	</div>
</article>
