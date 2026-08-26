<?php
/**
 * Accessible footer for native WordPress fallback requests.
 *
 * @package Pagecraft
 */
?>
	<?php if ( ! pagecraft_theme_render_global( 'footer' ) ) : ?>
	<footer class="pagecraft-site-footer">
		<div class="pagecraft-shell-inner">
			<p>
				<?php
				printf(
					/* translators: 1: Current year. 2: Site title. */
					esc_html__( '%1$s %2$s', 'pagecraft' ),
					esc_html( wp_date( 'Y' ) ),
					esc_html( get_bloginfo( 'name' ) )
				);
				?>
			</p>
		</div>
	</footer>
	<?php endif; ?>
</div>
<?php wp_footer(); ?>
</body>
</html>
