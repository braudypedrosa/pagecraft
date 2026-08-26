<?php
/**
 * Accessible header for native WordPress fallback requests.
 *
 * @package Pagecraft
 */
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
<a class="pagecraft-skip-link" href="#<?php echo pagecraft_theme_is_managed_page() ? 'pagecraft-main' : 'primary'; ?>"><?php esc_html_e( 'Skip to content', 'pagecraft' ); ?></a>
<div class="pagecraft-fallback-shell">
	<?php if ( ! pagecraft_theme_render_global( 'header' ) ) : ?>
	<header class="pagecraft-site-header">
		<div class="pagecraft-shell-inner">
			<div class="pagecraft-site-branding">
				<?php if ( has_custom_logo() ) : ?>
					<?php the_custom_logo(); ?>
				<?php endif; ?>
				<div>
					<p class="pagecraft-site-title">
						<a href="<?php echo esc_url( home_url( '/' ) ); ?>" rel="home"><?php bloginfo( 'name' ); ?></a>
					</p>
					<?php if ( get_bloginfo( 'description', 'display' ) ) : ?>
						<p class="pagecraft-site-description"><?php bloginfo( 'description' ); ?></p>
					<?php endif; ?>
				</div>
			</div>

			<nav class="pagecraft-primary-navigation" aria-label="<?php esc_attr_e( 'Primary navigation', 'pagecraft' ); ?>">
				<?php
				wp_nav_menu(
					array(
						'theme_location' => 'primary',
						'container'      => false,
						'depth'          => 2,
						'fallback_cb'    => 'wp_page_menu',
					)
				);
				?>
			</nav>
		</div>
	</header>
	<?php endif; ?>
