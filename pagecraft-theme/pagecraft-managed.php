<?php
/**
 * Minimal document for a Pagecraft-managed route.
 *
 * Pagecraft owns the rendered body. The connector owns managed-route metadata
 * through wp_head hooks. This theme supplies only the WordPress lifecycle and
 * an accessible skip target.
 *
 * @package Pagecraft
 */

$pagecraft_route_html = pagecraft_theme_get_managed_route_html();
?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<a class="pagecraft-skip-link" href="#pagecraft-managed-content"><?php esc_html_e( 'Skip to content', 'pagecraft' ); ?></a>
<div id="pagecraft-managed-content" tabindex="-1">
	<?php
	// The connector returns trusted, sanitized release HTML for the active route.
	echo null !== $pagecraft_route_html ? $pagecraft_route_html : ''; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	?>
</div>
<?php wp_footer(); ?>
</body>
</html>
