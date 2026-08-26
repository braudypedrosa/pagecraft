<?php
/**
 * Install idempotent WordPress-owned content for Docker smoke tests.
 *
 * Usage: wp eval-file install-native-content.php <environment>
 */

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	exit( 1 );
}

$environment = isset( $args[0] ) ? sanitize_key( (string) $args[0] ) : 'local';

/**
 * Create or update a fixture page by path.
 */
$upsert_page = static function ( string $path, string $title, string $content ): int {
	$existing = get_page_by_path( $path, OBJECT, 'page' );
	$post_id  = $existing instanceof WP_Post ? $existing->ID : 0;
	$result   = wp_insert_post(
		array(
			'ID'           => $post_id,
			'post_type'    => 'page',
			'post_status'  => 'publish',
			'post_name'    => $path,
			'post_title'   => $title,
			'post_content' => $content,
		),
		true
	);

	if ( is_wp_error( $result ) ) {
		WP_CLI::error( $result->get_error_message() );
	}

	return (int) $result;
};

$home_id = $upsert_page(
	'home',
	ucfirst( $environment ) . ' native home',
	'<!-- wp:heading --><h2 class="wp-block-heading">Native WordPress home</h2><!-- /wp:heading -->' .
	'<!-- wp:paragraph --><p data-pagecraft-native-fixture="' . esc_attr( $environment ) . '">This page is owned by WordPress and must survive Pagecraft synchronization.</p><!-- /wp:paragraph -->'
);

$native_id = $upsert_page(
	'wordpress-owned',
	'WordPress-owned content',
	'<!-- wp:heading --><h2 class="wp-block-heading">WordPress-owned fixture</h2><!-- /wp:heading -->' .
	'<!-- wp:paragraph --><p data-pagecraft-native-fixture="' . esc_attr( $environment ) . '">This content is outside Pagecraft ownership.</p><!-- /wp:paragraph -->'
);

update_post_meta( $home_id, '_pagecraft_fixture_owner', 'wordpress' );
update_post_meta( $native_id, '_pagecraft_fixture_owner', 'wordpress' );
update_option( 'show_on_front', 'page' );
update_option( 'page_on_front', $home_id );

$post = get_page_by_path( 'native-post', OBJECT, 'post' );
wp_insert_post(
	array(
		'ID'           => $post instanceof WP_Post ? $post->ID : 0,
		'post_type'    => 'post',
		'post_status'  => 'publish',
		'post_name'    => 'native-post',
		'post_title'   => 'Native WordPress post',
		'post_content' => '<!-- wp:paragraph --><p>Native post fixture.</p><!-- /wp:paragraph -->',
	)
);

if ( wp_get_theme()->get_stylesheet() === 'pagecraft' ) {
	$menu = wp_get_nav_menu_object( 'Fixture navigation' );
	if ( ! $menu ) {
		$menu_id = wp_create_nav_menu( 'Fixture navigation' );
	} else {
		$menu_id = (int) $menu->term_id;
	}

	$menu_items = wp_get_nav_menu_items( $menu_id );
	if ( empty( $menu_items ) ) {
		wp_update_nav_menu_item(
			$menu_id,
			0,
			array(
				'menu-item-object-id' => $home_id,
				'menu-item-object'    => 'page',
				'menu-item-type'      => 'post_type',
				'menu-item-status'    => 'publish',
			)
		);
		wp_update_nav_menu_item(
			$menu_id,
			0,
			array(
				'menu-item-object-id' => $native_id,
				'menu-item-object'    => 'page',
				'menu-item-type'      => 'post_type',
				'menu-item-status'    => 'publish',
			)
		);
	}

	$locations            = get_theme_mod( 'nav_menu_locations', array() );
	$locations['primary'] = $menu_id;
	set_theme_mod( 'nav_menu_locations', $locations );
}

WP_CLI::success( 'Native fixtures installed for ' . $environment . '.' );
