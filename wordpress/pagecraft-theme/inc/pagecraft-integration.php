<?php
/**
 * Safe integration boundary between the theme and Pagecraft Builder.
 *
 * @package Pagecraft
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Determine whether the current native WordPress page carries a Pagecraft document.
 */
function pagecraft_theme_is_managed_page( ?int $post_id = null ): bool {
	$resolved = $post_id ?? (int) get_queried_object_id();
	if ( $resolved <= 0 || 'page' !== get_post_type( $resolved ) ) {
		return false;
	}

	if ( function_exists( 'pagecraft_builder_is_managed_page' ) ) {
		return pagecraft_builder_is_managed_page( $resolved );
	}

	return '' !== get_post_meta( $resolved, '_pagecraft_document', true );
}

/**
 * Scope fallback presentation so it cannot impose a design on managed routes.
 *
 * @param string[] $classes Existing body classes.
 * @return string[]
 */
function pagecraft_theme_body_classes( array $classes ): array {
	$classes[] = pagecraft_theme_is_managed_page()
		? 'pagecraft-theme-managed'
		: 'pagecraft-theme-fallback';

	return array_values( array_unique( $classes ) );
}
add_filter( 'body_class', 'pagecraft_theme_body_classes', 20 );

/**
 * Keep the last imported page styled when Pagecraft Builder is deactivated.
 *
 * Issue #6 promotes generated styles to content-hashed files. This metadata fallback is still
 * intentional: imported native content must never become blank or completely unstyled merely
 * because the editing plugin is unavailable.
 */
function pagecraft_theme_enqueue_managed_fallback(): void {
	$post_id = (int) get_queried_object_id();
	if ( ! pagecraft_theme_is_managed_page( $post_id ) ) {
		return;
	}

	$css = get_post_meta( $post_id, '_pagecraft_compiled_css', true );
	if ( ! is_string( $css ) || '' === trim( $css ) ) {
		return;
	}

	$handle = 'pagecraft-managed-page';
	wp_register_style( $handle, false, [], substr( hash( 'sha256', $css ), 0, 12 ) );
	wp_enqueue_style( $handle );
	wp_add_inline_style( $handle, $css );
}
add_action( 'wp_enqueue_scripts', 'pagecraft_theme_enqueue_managed_fallback', 20 );
