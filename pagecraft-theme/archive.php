<?php
/**
 * Native WordPress archive fallback.
 *
 * @package Pagecraft
 */

get_header();
?>
<main id="primary" class="pagecraft-fallback-main">
	<header class="pagecraft-content-header">
		<?php the_archive_title( '<h1 class="pagecraft-content-title">', '</h1>' ); ?>
		<?php the_archive_description( '<div class="pagecraft-content-description">', '</div>' ); ?>
	</header>

	<?php if ( have_posts() ) : ?>
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
