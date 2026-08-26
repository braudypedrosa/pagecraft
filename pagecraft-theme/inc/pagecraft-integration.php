<?php
/**
 * Safe integration boundary between the theme and Pagecraft Connector.
 *
 * The theme remains usable when the connector is absent, inactive, upgrading,
 * or unable to resolve a managed release.
 *
 * @package Pagecraft
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Return the active normalized Pagecraft release, if the connector provides it.
 *
 * @return array<string, mixed>|null
 */
function pagecraft_theme_get_active_release(): ?array {
	if ( ! function_exists( 'pagecraft_get_active_release' ) ) {
		return null;
	}

	try {
		$release = pagecraft_get_active_release();
	} catch ( Throwable $error ) {
		do_action( 'pagecraft_theme_integration_error', $error, 'active_release' );
		return null;
	}

	return is_array( $release ) ? $release : null;
}

/**
 * Determine whether it is safe to ask the connector to resolve this request.
 */
function pagecraft_theme_should_resolve_route(): bool {
	if ( is_admin() || wp_doing_ajax() ) {
		return false;
	}

	if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
		return false;
	}

	if ( is_feed() || is_trackback() || is_robots() || is_favicon() ) {
		return false;
	}

	return true;
}

/**
 * Resolve and cache the current Pagecraft-managed route body.
 *
 * Null means the connector does not manage the route. An empty string is still
 * a managed route and therefore must not fall through to native content.
 */
function pagecraft_theme_get_managed_route_html(): ?string {
	static $resolved = false;
	static $html     = null;

	if ( $resolved ) {
		return $html;
	}

	$resolved = true;

	if ( ! pagecraft_theme_should_resolve_route() ) {
		return null;
	}

	if ( null === pagecraft_theme_get_active_release() || ! function_exists( 'pagecraft_render_route' ) ) {
		return null;
	}

	try {
		$rendered = pagecraft_render_route( null );
	} catch ( Throwable $error ) {
		do_action( 'pagecraft_theme_integration_error', $error, 'render_route' );
		return null;
	}

	if ( is_string( $rendered ) ) {
		$html = $rendered;
	}

	return $html;
}

/**
 * Return connector-managed content for a stable WordPress post shell.
 */
function pagecraft_theme_get_managed_content( ?int $post_id = null ): string {
	if ( ! function_exists( 'pagecraft_render_managed_content' ) ) {
		return '';
	}

	try {
		$rendered = pagecraft_render_managed_content( $post_id );
	} catch ( Throwable $error ) {
		do_action( 'pagecraft_theme_integration_error', $error, 'render_managed_content' );
		return '';
	}

	return is_string( $rendered ) ? $rendered : '';
}

/**
 * Select the minimal managed-route document when the connector owns the URL.
 */
function pagecraft_theme_select_managed_template( string $template ): string {
	if ( null !== pagecraft_theme_get_managed_route_html() ) {
		$managed_template = PAGECRAFT_THEME_DIR . '/pagecraft-managed.php';

		if ( is_readable( $managed_template ) ) {
			return $managed_template;
		}
	}

	return $template;
}
add_filter( 'template_include', 'pagecraft_theme_select_managed_template', 99 );

/**
 * Scope fallback presentation so it cannot impose a design on managed routes.
 *
 * @param string[] $classes Existing body classes.
 * @return string[]
 */
function pagecraft_theme_body_classes( array $classes ): array {
	$classes[] = null !== pagecraft_theme_get_managed_route_html()
		? 'pagecraft-theme-managed'
		: 'pagecraft-theme-fallback';

	return array_values( array_unique( $classes ) );
}
add_filter( 'body_class', 'pagecraft_theme_body_classes', 20 );
