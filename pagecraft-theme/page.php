<?php
/**
 * Native WordPress page fallback.
 *
 * @package Pagecraft
 */

get_header();
?>
<main id="primary" class="pagecraft-fallback-main">
	<?php
	while ( have_posts() ) :
		the_post();
		get_template_part( 'template-parts/content', 'page' );

		if ( comments_open() || get_comments_number() ) {
			comments_template();
		}
	endwhile;
	?>
</main>
<?php
get_footer();
