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
 * Resolve one of the two revision-backed global element posts without requiring the plugin.
 */
function pagecraft_theme_global_post_id( string $kind ): int {
	if ( ! in_array( $kind, array( 'header', 'footer' ), true ) ) {
		return 0;
	}
	$post = get_page_by_path( 'pagecraft-' . $kind, OBJECT, 'pagecraft_global' );
	return is_object( $post ) && isset( $post->ID ) ? (int) $post->ID : 0;
}

/**
 * Render a stored global region through an explicit landmark.
 */
function pagecraft_theme_render_global( string $kind ): bool {
	$post_id = pagecraft_theme_global_post_id( $kind );
	if ( $post_id <= 0 ) {
		return false;
	}
	$content = get_post_field( 'post_content', $post_id );
	if ( ! is_string( $content ) || '' === trim( $content ) ) {
		return false;
	}
	$content = pagecraft_theme_bind_native_menus( $content, $kind );
	$tag = 'header' === $kind ? 'header' : 'footer';
	printf(
		'<%1$s class="pagecraft-global pagecraft-global-%2$s" data-pagecraft-global="%2$s">%3$s</%1$s>',
		esc_attr( $tag ),
		esc_attr( $kind ),
		$content // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- sanitized before persistence.
	);
	return true;
}

/**
 * Keep page-backed menu items dynamic while preserving an imported Pagecraft anchor.
 *
 * @param object $item WordPress menu item.
 * @return object
 */
function pagecraft_theme_menu_item_anchor( object $item ): object {
	if ( ! isset( $item->ID, $item->url ) || 'post_type' !== ( $item->type ?? '' ) ) {
		return $item;
	}
	$anchor = sanitize_title( (string) get_post_meta( (int) $item->ID, '_pagecraft_menu_anchor', true ) );
	if ( '' !== $anchor ) {
		$item->url = strtok( (string) $item->url, '#' ) . '#' . $anchor;
	}
	return $item;
}
add_filter( 'wp_setup_nav_menu_item', 'pagecraft_theme_menu_item_anchor', 20 );

/**
 * Replace a compiled Pagecraft menu list with the native menu assigned to its stable location.
 * Pagecraft keeps the surrounding nav, toggle, classes and generated CSS; WordPress supplies
 * the current menu items and URLs.
 */
function pagecraft_theme_bind_native_menus( string $content, string $kind ): string {
	$locations = get_nav_menu_locations();
	$seen = 0;
	$bound = preg_replace_callback(
		'#<nav\b([^>]*)\bdata-nav\b([^>]*)>([\s\S]*?)</nav>#i',
		static function ( array $match ) use ( $kind, $locations, &$seen ): string {
			$attributes = $match[1] . ' data-nav' . $match[2];
			$location = '';
			if ( preg_match( '/\bdata-pagecraft-menu-location=(?:"([a-z0-9_-]+)"|\'([a-z0-9_-]+)\')/i', $attributes, $declared ) ) {
				$location = (string) ( $declared[1] ?: $declared[2] );
			} elseif ( 'header' === $kind ) {
				$location = 0 === $seen ? 'primary' : 'utility';
			} elseif ( 0 === $seen ) {
				$location = 'footer';
			}
			$seen++;
			$menu_id = (int) ( $locations[ $location ] ?? 0 );
			if ( $menu_id <= 0 ) {
				return $match[0];
			}
			if ( ! str_contains( $attributes, 'data-pagecraft-menu-location=' ) ) {
				$attributes .= ' data-pagecraft-menu-location="' . esc_attr( $location ) . '"';
			}
			$toggle = '';
			if ( preg_match( '#<button\b[^>]*\bdata-nav-t\b[^>]*>[\s\S]*?</button>#i', $match[3], $button ) ) {
				$toggle = $button[0];
			}
			$list_id = 'pagecraft-native-menu-' . $menu_id;
			if ( preg_match( '/<ul\b[^>]*\bid=(?:"([^"]+)"|\'([^\']+)\')/i', $match[3], $list ) ) {
				$list_id = sanitize_html_class( (string) ( $list[1] ?: $list[2] ), $list_id );
			}
			$menu = wp_nav_menu(
				array(
					'menu'        => $menu_id,
					'container'   => false,
					'depth'       => 0,
					'fallback_cb' => false,
					'echo'        => false,
					'items_wrap'  => '<ul id="' . esc_attr( $list_id ) . '" class="pagecraft-nav-list" data-nav-l>%3$s</ul>',
				)
			);
			if ( ! is_string( $menu ) || '' === trim( $menu ) ) {
				return $match[0];
			}
			return '<nav' . $attributes . '>' . $toggle . $menu . '</nav>';
		},
		$content
	);
	return is_string( $bound ) ? $bound : $content;
}

/**
 * Convert a persisted upload-relative descriptor to a same-site URL.
 */
function pagecraft_theme_generated_asset_url( string $path, string $hash, string $extension ): string {
	if ( ! preg_match( '#^pagecraft/(?:global|page|runtime)-([a-f0-9]{64})\.(css|js)$#', $path, $match )
		|| ! hash_equals( $match[1], $hash ) || $match[2] !== $extension ) {
		return '';
	}
	$uploads = wp_upload_dir();
	if ( ! is_array( $uploads ) || ! empty( $uploads['error'] )
		|| ! is_string( $uploads['basedir'] ?? null ) || ! is_string( $uploads['baseurl'] ?? null ) ) {
		return '';
	}
	$file = trailingslashit( $uploads['basedir'] ) . $path;
	if ( ! is_file( $file ) || ! is_readable( $file ) ) {
		return '';
	}
	return trailingslashit( $uploads['baseurl'] ) . $path;
}

/**
 * Load only the immutable assets referenced by the active globals and current native page.
 */
function pagecraft_theme_enqueue_generated_assets(): void {
	$global_ids = array_filter(
		array( pagecraft_theme_global_post_id( 'header' ), pagecraft_theme_global_post_id( 'footer' ) )
	);
	$page_id = pagecraft_theme_is_managed_page() ? (int) get_queried_object_id() : 0;
	$styles = array();
	$runtimes = array();
	$remember_style = static function ( int $post_id, string $prefix ) use ( &$styles ): void {
		if ( $post_id <= 0 ) {
			return;
		}
		$path = (string) get_post_meta( $post_id, $prefix . '_path', true );
		$hash = (string) get_post_meta( $post_id, $prefix . '_hash', true );
		$url = pagecraft_theme_generated_asset_url( $path, $hash, 'css' );
		if ( '' !== $url ) {
			unset( $styles[ $hash ] );
			$styles[ $hash ] = $url;
		}
	};
	/* Project foundation first, active global presentation second, page-only rules last. */
	$remember_style( $page_id, '_pagecraft_global_css' );
	foreach ( array_unique( $global_ids ) as $post_id ) {
		$remember_style( $post_id, '_pagecraft_global_css' );
	}
	$remember_style( $page_id, '_pagecraft_page_css' );

	foreach ( array_unique( array_filter( array_merge( $global_ids, array( $page_id ) ) ) ) as $post_id ) {
		$runtime_path = (string) get_post_meta( $post_id, '_pagecraft_runtime_path', true );
		$runtime_hash = (string) get_post_meta( $post_id, '_pagecraft_runtime_hash', true );
		$runtime_url = pagecraft_theme_generated_asset_url( $runtime_path, $runtime_hash, 'js' );
		if ( '' !== $runtime_url ) {
			$runtimes[ $runtime_hash ] = $runtime_url;
		}
	}
	foreach ( $styles as $hash => $url ) {
		wp_enqueue_style( 'pagecraft-generated-' . substr( $hash, 0, 12 ), $url, array(), substr( $hash, 0, 12 ) );
	}
	foreach ( $runtimes as $hash => $url ) {
		wp_enqueue_script(
			'pagecraft-runtime-' . substr( $hash, 0, 12 ),
			$url,
			array(),
			substr( $hash, 0, 12 ),
			array( 'in_footer' => true, 'strategy' => 'defer' )
		);
	}

	/* Backward compatibility for v1 page packages created before split asset files existed. */
	if ( pagecraft_theme_is_managed_page() && array() === $styles ) {
		$post_id = (int) get_queried_object_id();
		$css = get_post_meta( $post_id, '_pagecraft_compiled_css', true );
		if ( is_string( $css ) && '' !== trim( $css ) ) {
			$handle = 'pagecraft-managed-legacy';
			wp_register_style( $handle, false, array(), substr( hash( 'sha256', $css ), 0, 12 ) );
			wp_enqueue_style( $handle );
			wp_add_inline_style( $handle, $css );
		}
	}
}
add_action( 'wp_enqueue_scripts', 'pagecraft_theme_enqueue_generated_assets', 20 );
