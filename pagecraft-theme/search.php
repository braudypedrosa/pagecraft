<?php
/**
 * Native WordPress search fallback.
 *
 * @package Pagecraft
 */

get_header();
?>
<main id="primary" class="pagecraft-fallback-main">
	<header class="pagecraft-content-header">
		<h1 class="pagecraft-content-title">
			<?php
			printf(
				/* translators: %s: Search query. */
				esc_html__( 'Search results for: %s', 'pagecraft' ),
				'<span>' . esc_html( get_search_query() ) . '</span>'
			);
			?>
		</h1>
	</header>

	<?php if ( have_posts() ) : ?>
		<?php
		while ( have_posts() ) :
			the_post();
			get_template_part( 'template-parts/content', 'search' );
		endwhile;
		?>
		<div class="pagecraft-posts-navigation">
			<?php the_posts_pagination(); ?>
		</div>
	<?php else : ?>
		<?php get_template_part( 'template-parts/content', 'none' ); ?>
	<?php endif; ?>
</main>
<?php
get_footer();
