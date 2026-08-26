<?php
/**
 * Native WordPress fallback index.
 *
 * @package Pagecraft
 */

get_header();
?>
<main id="primary" class="pagecraft-fallback-main">
	<?php if ( have_posts() ) : ?>
		<header class="pagecraft-content-header">
			<h1 class="pagecraft-content-title"><?php esc_html_e( 'Latest posts', 'pagecraft' ); ?></h1>
		</header>

		<?php
		while ( have_posts() ) :
			the_post();
			get_template_part( 'template-parts/content', get_post_type() );
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
