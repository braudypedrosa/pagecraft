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
