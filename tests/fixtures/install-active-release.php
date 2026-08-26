<?php
/**
 * Verify and activate the shared signed Connected WordPress artifact locally.
 *
 * The project release/keyset and exact artifact bytes are verified here. The
 * deployment binding is intentionally target-local because the shared golden
 * vector has one immutable test envelope, while Docker exercises both setup
 * profiles. Target-envelope clone/origin/profile rejection remains covered by
 * the connector's cross-runtime PHPUnit suite.
 *
 * Usage: wp eval-file install-active-release.php <environment>
 */

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	exit( 1 );
}

if ( ! function_exists( 'pagecraft_get_active_release' ) ) {
	WP_CLI::error( 'Pagecraft Connector must be active before installing the shared release fixture.' );
}

$environment = isset( $args[0] ) ? sanitize_key( (string) $args[0] ) : 'staging';
$profile     = 'production' === $environment ? 'existing-theme' : 'pagecraft-theme';
$fixture     = '/opt/pagecraft-shared/wordpress-artifact-v1.json';

// Docker volumes outlive source revisions. Re-run the connector's idempotent
// activation/upgrade path so a previously active checkout cannot mask schema,
// option, capability, or scheduling changes in the release under test.
Pagecraft\Connector\Activation::activate();

if ( ! is_readable( $fixture ) ) {
	WP_CLI::error( 'The shared signed WordPress golden artifact is not mounted.' );
}

$fail = static function ( string $message, ?WP_Error $error = null ): void {
	if ( $error instanceof WP_Error ) {
		$message .= ' [' . $error->get_error_code() . '] ' . $error->get_error_message();
	}
	WP_CLI::error( $message );
};

try {
	$vector = json_decode( (string) file_get_contents( $fixture ), true, 128, JSON_THROW_ON_ERROR );
} catch ( Throwable $error ) {
	$fail( 'The shared WordPress golden vector is invalid JSON: ' . $error->getMessage() );
}

if ( ! is_array( $vector ) || ! is_array( $vector['artifact'] ?? null ) || ! is_array( $vector['desired'] ?? null ) ) {
	$fail( 'The shared WordPress golden vector is incomplete.' );
}

$release_part = $vector['desired']['release'] ?? null;
if ( ! is_array( $release_part ) || ! is_array( $vector['keysetEnvelope'] ?? null ) ) {
	$fail( 'The shared WordPress golden vector has no signed release/keyset.' );
}

try {
	$keyset        = Pagecraft\Connector\RootTrust::verifyKeysetEnvelope( $vector['keysetEnvelope'], 'http://localhost:8787' );
	$manifest_raw  = Pagecraft\Connector\Support::base64UrlDecode( (string) ( $release_part['manifest'] ?? '' ) );
	$signature     = Pagecraft\Connector\Support::base64UrlDecode( (string) ( $release_part['signature'] ?? '' ) );
	$manifest      = Pagecraft\Connector\Support::decodeObject( $manifest_raw );
	$artifact_json = Pagecraft\Connector\CanonicalJson::encode( $vector['artifact'] );
	Pagecraft\Connector\CanonicalJson::decode( $manifest_raw );
} catch ( Throwable $error ) {
	$fail( 'The shared release trust material is invalid: ' . $error->getMessage() );
}

$release_key_id = (string) ( $release_part['keyId'] ?? '' );
$release_key    = null;
foreach ( (array) ( $keyset['keys'] ?? array() ) as $candidate ) {
	if ( is_array( $candidate ) && hash_equals( $release_key_id, (string) ( $candidate['id'] ?? '' ) ) ) {
		$release_key = $candidate;
		break;
	}
}

if ( ! is_array( $release_key )
	|| ( $not_before = strtotime( (string) ( $release_key['notBefore'] ?? '' ) ) ) === false
	|| ( $not_after = strtotime( (string) ( $release_key['notAfter'] ?? '' ) ) ) === false
	|| $not_before > time()
	|| $not_after <= time() ) {
	$fail( 'The shared release signing key is missing or inactive.' );
}

try {
	$public_key = Pagecraft\Connector\Support::base64UrlDecode( (string) $release_key['publicKey'] );
} catch ( Throwable $error ) {
	$fail( 'The shared release public key is invalid: ' . $error->getMessage() );
}

$message  = Pagecraft\Connector\ReleaseVerifier::RELEASE_PREFIX . $manifest_raw;
$verified = function_exists( 'sodium_crypto_sign_verify_detached' )
	? sodium_crypto_sign_verify_detached( $signature, $message, $public_key )
	: ( class_exists( 'ParagonIE_Sodium_Compat' )
		? ParagonIE_Sodium_Compat::crypto_sign_verify_detached( $signature, $message, $public_key )
		: false );
if ( ! $verified ) {
	$fail( 'The shared project release signature did not verify.' );
}

if ( strlen( $artifact_json ) !== (int) ( $manifest['artifactBytes'] ?? -1 )
	|| ! Pagecraft\Connector\Support::hashEquals(
		(string) ( $manifest['artifactHash'] ?? '' ),
		hash( 'sha256', $artifact_json )
	) ) {
	$fail( 'The canonical shared artifact does not match the signed project release.' );
}

$target_origin   = Pagecraft\Connector\Support::normalizeOrigin( home_url( '/' ) );
$home_path       = wp_parse_url( home_url( '/' ), PHP_URL_PATH );
$target_path     = '/' . trim( is_string( $home_path ) ? $home_path : '/', '/' );
$target_path     = '/' === $target_path ? '/' : $target_path . '/';
$installation_id = 'docker-installation-' . $environment;
$connection_id   = 'docker-connection-' . $environment;
$artifact_hash   = strtolower( (string) $manifest['artifactHash'] );
$deployment_id   = (string) $manifest['releaseId'] . ':docker:' . $environment . ':' . substr( $artifact_hash, 0, 16 );

update_option( 'pagecraft_installation_id', $installation_id, false );
update_option(
	'pagecraft_connection',
	array(
		'api_origin'      => 'http://localhost:8787',
		'connection_id'   => $connection_id,
		'site_id'         => (string) $manifest['siteId'],
		'target_origin'   => $target_origin,
		'target_path'     => $target_path,
		'installation_id' => $installation_id,
		'environment'     => 'production' === $environment ? 'production' : 'staging',
		'profile'         => $profile,
		'scopes'          => array( 'release:read', 'deploy:ack', 'cms:write', 'editor:open' ),
		'connected_at'    => Pagecraft\Connector\Support::utcNow(),
		'origin_changed'  => false,
	),
	false
);
update_option( 'pagecraft_mode', 'connected', false );

// Exercise the registered reconciliation heartbeat rather than fabricating a
// healthy timestamp. The test connection has no bearer credential, so this
// bounded tick records a safe failed reconciliation while proving cron wiring.
$next_sync = wp_next_scheduled( Pagecraft\Connector\Cron::SYNC_HOOK );
if ( ! is_int( $next_sync ) || $next_sync < time() - 5 * MINUTE_IN_SECONDS || $next_sync > time() + 30 * MINUTE_IN_SECONDS ) {
	wp_clear_scheduled_hook( Pagecraft\Connector\Cron::SYNC_HOOK );
	wp_schedule_event( time() + 5 * MINUTE_IN_SECONDS, 'pagecraft_fifteen_minutes', Pagecraft\Connector\Cron::SYNC_HOOK );
}
do_action( Pagecraft\Connector\Cron::SYNC_HOOK );

global $wpdb;
$legacy_release = 'fixture-' . $environment;
if ( get_option( 'pagecraft_active_release_id', '' ) === $legacy_release ) {
	update_option( 'pagecraft_active_release_id', '', false );
}
$wpdb->delete( $wpdb->prefix . 'pagecraft_routes', array( 'release_id' => $legacy_release ), array( '%s' ) );
$wpdb->delete( $wpdb->prefix . 'pagecraft_redirects', array( 'release_id' => $legacy_release ), array( '%s' ) );
$wpdb->delete( $wpdb->prefix . 'pagecraft_releases', array( 'release_id' => $legacy_release ), array( '%s' ) );
$legacy_page = get_page_by_path( 'managed', OBJECT, 'page' );
if ( $legacy_page instanceof WP_Post
	&& get_post_meta( $legacy_page->ID, '_pagecraft_source_id', true ) === 'fixture-page-' . $environment ) {
	wp_delete_post( $legacy_page->ID, true );
}

$repository = new Pagecraft\Connector\ReleaseRepository();
$existing   = $repository->find( $deployment_id );
if ( is_array( $existing ) && 'failed' === (string) $existing['status'] ) {
	$wpdb->delete( $wpdb->prefix . 'pagecraft_releases', array( 'deployment_id' => $deployment_id ), array( '%s' ) );
	$existing = null;
}
$latest          = $repository->latest();
$target_sequence = is_array( $existing )
	? (int) $existing['sequence']
	: max( 1, (int) ( $latest['sequence'] ?? 0 ) + 1 );
$deployment      = array(
	'connectionId'   => $connection_id,
	'installationId' => $installation_id,
	'targetOrigin'    => $target_origin,
	'targetPath'      => $target_path,
	'environment'     => 'production' === $environment ? 'production' : 'staging',
	'profile'         => $profile,
	'targetSequence'  => $target_sequence,
	'releaseId'       => (string) $manifest['releaseId'],
	'artifactHash'    => $artifact_hash,
);

$manifest['connectionId']      = $connection_id;
$manifest['installationId']    = $installation_id;
$manifest['targetOrigin']      = $target_origin;
$manifest['targetPath']        = $target_path;
$manifest['environment']       = $deployment['environment'];
$manifest['profile']           = $profile;
$manifest['sequence']          = $target_sequence;
$manifest['deploymentId']      = $deployment_id;
$manifest['_manifestHash']     = hash( 'sha256', $manifest_raw );
$manifest['_deploymentHash']   = hash( 'sha256', Pagecraft\Connector\CanonicalJson::encode( $deployment ) );
$manifest['_releaseCanonical'] = $manifest_raw;
$manifest['_releaseKeyId']     = $release_key_id;
$manifest['_artifactFormat']   = (string) ( $vector['artifact']['format'] ?? '' );
$manifest['_apiOrigin']        = 'http://localhost:8787';

$temporary = wp_tempnam( 'pagecraft-wordpress-artifact.json' );
if ( ! is_string( $temporary ) || file_put_contents( $temporary, $artifact_json, LOCK_EX ) !== strlen( $artifact_json ) ) {
	$fail( 'WordPress could not create the canonical artifact staging file.' );
}

$staging_directory = '';
try {
	$staged = ( new Pagecraft\Connector\Stager() )->stageCanonicalArtifact( $temporary, $manifest );
	if ( is_wp_error( $staged ) ) {
		$fail( 'The shared artifact did not pass connector staging.', $staged );
	}
	$staging_directory = (string) $staged['directory'];
	$artifact           = $staged['artifact'];

	$approvals = new Pagecraft\Connector\ScriptApprovals();
	$verifier  = new Pagecraft\Connector\ReleaseVerifier( new Pagecraft\Connector\Connection(), $approvals );
	$pending   = $verifier->inspectArtifactScripts( $artifact );
	if ( is_wp_error( $pending ) ) {
		$fail( 'The shared runtime inventory is invalid.', $pending );
	}
	$admins   = get_users( array( 'role' => 'administrator', 'number' => 1, 'fields' => 'ids' ) );
	$admin_id = isset( $admins[0] ) ? (int) $admins[0] : 0;
	foreach ( $pending as $fingerprint ) {
		if ( ! $approvals->approve( (string) $fingerprint, $admin_id ) ) {
			$fail( 'A declared shared-fixture runtime fingerprint could not be approved locally.' );
		}
	}
	$remaining = $verifier->inspectArtifactScripts( $artifact );
	if ( is_wp_error( $remaining ) || array() !== $remaining ) {
		$fail( 'The shared fixture still has unapproved or invalid runtime after explicit local approval.', is_wp_error( $remaining ) ? $remaining : null );
	}

	$manifest = Pagecraft\Connector\Sync::mergeArtifact( $manifest, $artifact, array() );
	$mapper   = new Pagecraft\Connector\Mapper( $repository );

	if ( 'pagecraft-theme' === $profile ) {
		$root_owner = ( new Pagecraft\Connector\RouteOwnership() )->owner( '/' );
		if ( is_array( $root_owner ) && true === ( $root_owner['replaceable'] ?? false ) ) {
			if ( ! $mapper->setDecision( '/', 'replace' ) ) {
				$fail( 'The Docker target could not record its explicit Pagecraft Theme homepage decision.' );
			}
		}
	}

	// The shared signed deployment envelope intentionally targets /site. Probe
	// the same artifact through Mapper with that exact path so Docker also
	// exercises subdirectory public-link localization without changing either
	// running WordPress installation's own home URL.
	try {
		$golden_envelope = Pagecraft\Connector\Support::decodeObject(
			Pagecraft\Connector\Support::base64UrlDecode( (string) ( $vector['desired']['deployment']['envelope'] ?? '' ) )
		);
	} catch ( Throwable $error ) {
		$fail( 'The shared deployment envelope could not drive the subdirectory localization probe: ' . $error->getMessage() );
	}
	$golden_target_path = (string) ( $golden_envelope['targetPath'] ?? '' );
	if ( '/site' !== rtrim( $golden_target_path, '/' ) ) {
		$fail( 'The shared deployment envelope no longer exercises the /site target path.' );
	}
	$subdirectory_probe               = $manifest;
	$subdirectory_probe['targetPath'] = $golden_target_path;
	$subdirectory_probe               = $mapper->localizeManifest( $subdirectory_probe );
	if ( is_wp_error( $subdirectory_probe ) ) {
		$fail( 'The shared artifact failed its signed /site public-link localization probe.', $subdirectory_probe );
	}
	$subdirectory_link_count = 0;
	foreach ( (array) ( $subdirectory_probe['pages'] ?? array() ) as $probe_page ) {
		if ( ! is_array( $probe_page ) || true === ( $probe_page['_pagecraftSkip'] ?? false ) ) {
			continue;
		}
		$probe_html = (string) ( $probe_page['bodyHtml'] ?? '' )
			. (string) ( $probe_page['headHtml'] ?? '' )
			. (string) ( $probe_page['_shared']['headerHtml'] ?? '' )
			. (string) ( $probe_page['_shared']['footerHtml'] ?? '' );
		if ( preg_match_all( '/\b(?:href|src|poster|cite|action|formaction)="\/site(?:\/|[?#"])/i', $probe_html, $probe_matches ) ) {
			$subdirectory_link_count += count( $probe_matches[0] );
		}
	}
	if ( $subdirectory_link_count < 1 ) {
		$fail( 'The signed /site probe did not localize any target-neutral public HTML URLs.' );
	}

	$mapping_preflight = $mapper->preflight( $manifest );
	if ( is_wp_error( $mapping_preflight ) ) {
		$fail( 'The shared fixture failed target-local route preflight.', $mapping_preflight );
	}
	$localized = $mapper->localizeManifest( $manifest );
	if ( is_wp_error( $localized ) ) {
		$fail( 'The shared fixture could not be localized for this WordPress target.', $localized );
	}
	$manifest = $localized;

	$skip_network = static fn (): bool => false;
	add_filter( 'pagecraft_connector_run_network_preflight', $skip_network, 999 );
	$preflight = apply_filters( 'pagecraft_connector_preflight', true, $manifest, $artifact );
	remove_filter( 'pagecraft_connector_run_network_preflight', $skip_network, 999 );
	if ( is_wp_error( $preflight ) ) {
		$fail( 'The shared fixture failed WordPress integration preflight.', $preflight );
	}
	if ( true !== $preflight ) {
		$fail( 'A WordPress integration rejected the shared fixture.' );
	}

	$stored = $repository->stage( $manifest );
	if ( is_wp_error( $stored ) ) {
		$fail( 'The shared release record could not be staged.', $stored );
	}
	$routes = $mapper->apply( $manifest, $staged['files'] );
	if ( is_wp_error( $routes ) ) {
		$repository->setError( $deployment_id, $routes->get_error_code(), $routes->get_error_message() );
		$fail( 'The shared release could not be mapped into versioned WordPress candidates.', $routes );
	}
	$stored = $repository->replaceRoutes( $deployment_id, $routes );
	if ( is_wp_error( $stored ) ) {
		$fail( 'The shared release routes could not be stored.', $stored );
	}
	$stored = $repository->replaceRedirects( $deployment_id, (array) ( $manifest['redirects'] ?? array() ) );
	if ( is_wp_error( $stored ) ) {
		$fail( 'The shared release redirects could not be stored.', $stored );
	}
	$repository->markInstalled( $deployment_id, false );
	$activated = $repository->activate( $deployment_id );
	if ( is_wp_error( $activated ) ) {
		$fail( 'The shared release could not be activated atomically.', $activated );
	}

	$component_classes = array(
		'section' => 'pagecraft-section', 'row' => 'pagecraft-row', 'list' => 'pagecraft-list',
		'slider' => 'pagecraft-slider', 'column' => 'pagecraft-column', 'box' => 'pagecraft-box',
		'heading' => 'pagecraft-heading', 'text' => 'pagecraft-wysiwyg', 'quote' => 'pagecraft-quote',
		'image' => 'pagecraft-figure', 'gallery' => 'pagecraft-gallery', 'video' => 'pagecraft-video',
		'icon' => 'pagecraft-icon', 'tabs' => 'pagecraft-tabs', 'table' => 'pagecraft-table-wrap',
		'code' => 'pagecraft-code', 'crumbs' => 'pagecraft-crumbs', 'button' => 'pagecraft-button',
		'nav' => 'pagecraft-nav-menu', 'form' => 'pagecraft-form', 'accordion' => 'pagecraft-accordion',
		'embed' => 'pagecraft-embed', 'spacer' => 'pagecraft-spacer', 'divider' => 'pagecraft-divider',
	);
	$component_markers = array();
	$runtime_count     = 0;
	$responsive_count  = 0;
	foreach ( (array) ( $artifact['routes'] ?? array() ) as $route ) {
		if ( ! is_array( $route ) ) {
			continue;
		}
		$body = (string) ( $route['bodyHtml'] ?? '' );
		foreach ( $component_classes as $component => $class ) {
			if ( preg_match(
				'/\bid="pc-matrix-' . preg_quote( $component, '/' ) . '"[^>]*\bclass="[^"]*\b' . preg_quote( $class, '/' ) . '\b/i',
				$body
			) ) {
				$component_markers[] = $component;
			}
		}
		$runtime_count    += '' !== trim( (string) ( $route['runtime'] ?? '' ) ) ? 1 : 0;
		$responsive_count += str_contains( (string) ( $route['css'] ?? '' ), '@media' ) ? 1 : 0;
	}
	$runtime_count += '' !== trim( (string) ( $artifact['shared']['runtime'] ?? '' ) ) ? 1 : 0;
	$responsive_count += str_contains( (string) ( $artifact['shared']['css'] ?? '' ), '@media' ) ? 1 : 0;
	$component_markers = array_values( array_unique( $component_markers ) );
	sort( $component_markers, SORT_STRING );

	$test_route = '';
	foreach ( $routes as $route ) {
		if ( ! is_array( $route ) || '/' === (string) ( $route['route_path'] ?? '/' ) ) {
			continue;
		}
		$body  = (string) ( $route['body_html'] ?? '' );
		$score = ( str_contains( $body, 'id="pc-matrix-section"' ) ? 2 : 0 )
			+ ( str_contains( $body, 'PAGECRAFT_FORM_ENDPOINT:contact-form' ) ? 1 : 0 );
		if ( '' === $test_route || $score > 0 ) {
			$test_route = (string) $route['route_path'];
		}
		if ( $score >= 3 ) {
			break;
		}
	}
	if ( '' === $test_route ) {
		$fail( 'The shared component fixture must expose at least one non-home managed route in both profiles.' );
	}

	$cms_collections = (array) ( $manifest['cms']['collections'] ?? array() );
	$cms_items       = 0;
	foreach ( $cms_collections as $collection ) {
		if ( is_array( $collection ) ) {
			$cms_items += count( (array) ( $collection['items'] ?? array() ) );
		}
	}
	update_option(
		'pagecraft_test_connected_fixture',
		array(
			'deployment_id'    => $deployment_id,
			'release_id'       => (string) $manifest['releaseId'],
			'artifact_hash'    => $artifact_hash,
			'profile'          => $profile,
			'test_route'       => $test_route,
			'route_count'      => count( $routes ),
			'asset_count'      => count( (array) ( $artifact['assets'] ?? array() ) ),
			'form_count'       => count( (array) ( $manifest['forms'] ?? array() ) ),
			'cms_collections'  => count( $cms_collections ),
			'cms_items'        => $cms_items,
			'runtime_count'    => $runtime_count,
			'responsive_count' => $responsive_count,
			'subdirectory_links' => $subdirectory_link_count,
			'components'       => $component_markers,
		),
		false
	);
} finally {
	if ( is_file( $temporary ) ) {
		wp_delete_file( $temporary );
	}
	if ( '' !== $staging_directory ) {
		( new Pagecraft\Connector\Stager() )->removeDirectory( $staging_directory );
	}
}

WP_CLI::success( 'Signed Connected release activated through staging/mapping for ' . $environment . '.' );
