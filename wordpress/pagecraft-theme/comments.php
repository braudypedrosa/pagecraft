<?php
/**
 * Native WordPress comments fallback.
 *
 * @package Pagecraft
 */

if ( post_password_required() ) {
	return;
}
?>
<section id="comments" class="pagecraft-comments">
	<?php if ( have_comments() ) : ?>
		<h2>
			<?php
			printf(
				/* translators: %s: Number of comments. */
				esc_html( _n( '%s comment', '%s comments', get_comments_number(), 'pagecraft' ) ),
				esc_html( number_format_i18n( get_comments_number() ) )
			);
			?>
		</h2>
		<ol class="pagecraft-comments-list">
			<?php wp_list_comments( array( 'style' => 'ol' ) ); ?>
		</ol>
		<?php the_comments_navigation(); ?>
	<?php endif; ?>

	<?php comment_form(); ?>
</section>
