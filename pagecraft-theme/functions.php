<?php
/**
 * Pagecraft theme functions.
 *
 * @package Pagecraft
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'PAGECRAFT_THEME_VERSION', '0.2.0' );
define( 'PAGECRAFT_THEME_DIR', get_template_directory() );

require_once PAGECRAFT_THEME_DIR . '/inc/pagecraft-integration.php';

/**
 * Configure theme defaults and WordPress features.
 */
function pagecraft_theme_setup(): void {
	load_theme_textdomain( 'pagecraft', PAGECRAFT_THEME_DIR . '/languages' );

	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'responsive-embeds' );
	add_theme_support( 'wp-block-styles' );
	add_theme_support( 'align-wide' );
	add_theme_support( 'editor-styles' );
	add_editor_style( 'style.css' );
	add_theme_support(
		'html5',
		array(
			'comment-form',
			'comment-list',
			'gallery',
			'caption',
			'style',
			'script',
			'navigation-widgets',
		)
	);
	add_theme_support(
		'custom-logo',
		array(
			'height'      => 96,
			'width'       => 320,
			'flex-height' => true,
			'flex-width'  => true,
		)
	);

	register_nav_menus(
		array(
			'primary' => __( 'Primary navigation', 'pagecraft' ),
			'footer'  => __( 'Footer navigation', 'pagecraft' ),
			'utility' => __( 'Utility navigation', 'pagecraft' ),
		)
	);
}
add_action( 'after_setup_theme', 'pagecraft_theme_setup' );

/**
 * Set a readable default content width for native WordPress fallbacks.
 */
function pagecraft_theme_set_content_width(): void {
	$GLOBALS['content_width'] = apply_filters( 'pagecraft_theme_content_width', 736 );
}
add_action( 'after_setup_theme', 'pagecraft_theme_set_content_width', 0 );

/**
 * Load the theme stylesheet. Managed routes remain visually owned by Pagecraft;
 * nearly all fallback styling is scoped to the fallback body class.
 */
function pagecraft_theme_enqueue_assets(): void {
	wp_enqueue_style(
		'pagecraft-theme',
		get_stylesheet_uri(),
		array(),
		PAGECRAFT_THEME_VERSION
	);
}
add_action( 'wp_enqueue_scripts', 'pagecraft_theme_enqueue_assets' );
