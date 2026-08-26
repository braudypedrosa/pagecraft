#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/../dev/compose.yml"

if [[ -f "${SCRIPT_DIR}/../dev/.env" ]]; then
	set -a
	# shellcheck disable=SC1091
	source "${SCRIPT_DIR}/../dev/.env"
	set +a
fi

STAGING_PORT="${STAGING_PORT:-8088}"
PRODUCTION_PORT="${PRODUCTION_PORT:-8089}"
PAGECRAFT_RUN_SEO_MATRIX="${PAGECRAFT_RUN_SEO_MATRIX:-1}"
PAGECRAFT_INSTALL_RELEASE_FIXTURE="${PAGECRAFT_INSTALL_RELEASE_FIXTURE:-1}"
PAGECRAFT_TEST_ROOT_PUBLIC_KEY="${PAGECRAFT_TEST_ROOT_PUBLIC_KEY:-AYrtOA8MouvyuMBywFi5i6jY90dxxYch28ujLoSRm0g}"

compose() {
	if [[ -f "${SCRIPT_DIR}/../dev/.env" ]]; then
		docker compose --env-file "${SCRIPT_DIR}/../dev/.env" --file "${COMPOSE_FILE}" "$@"
	else
		docker compose --file "${COMPOSE_FILE}" "$@"
	fi
}

wp_run() {
	local target="$1"
	shift
	compose run --rm --no-deps "${target}-cli" "$@"
}

fail() {
	echo "FAIL: $*" >&2
	exit 1
}

assert_contains() {
	local haystack="$1"
	local needle="$2"
	local context="$3"

	if [[ "${haystack}" != *"${needle}"* ]]; then
		fail "${context} did not contain ${needle}"
	fi
}

assert_before() {
	local html="$1"
	local before="$2"
	local after="$3"
	local context="$4"

	if ! printf '%s' "${html}" | php -r '
		$html = stream_get_contents(STDIN);
		$before = strpos($html, $argv[1]);
		$after = strpos($html, $argv[2]);
		exit($before !== false && $after !== false && $before < $after ? 0 : 1);
	' -- "${before}" "${after}"; then
		fail "${context} did not preserve required document order"
	fi
}

assert_component_matrix() {
	local html="$1"
	local context="$2"
	printf '%s' "${html}" | php -r '
	libxml_use_internal_errors(true);
	$document = new DOMDocument();
	if (!$document->loadHTML(stream_get_contents(STDIN))) {
		fwrite(STDERR, "Could not parse the managed component document.\n");
		exit(1);
	}
	$xpath = new DOMXPath($document);
	$classes = [
		"section"=>"pagecraft-section", "row"=>"pagecraft-row", "list"=>"pagecraft-list",
		"slider"=>"pagecraft-slider", "column"=>"pagecraft-column", "box"=>"pagecraft-box",
		"heading"=>"pagecraft-heading", "text"=>"pagecraft-wysiwyg", "quote"=>"pagecraft-quote",
		"image"=>"pagecraft-figure", "gallery"=>"pagecraft-gallery", "video"=>"pagecraft-video",
		"icon"=>"pagecraft-icon", "tabs"=>"pagecraft-tabs", "table"=>"pagecraft-table-wrap",
		"code"=>"pagecraft-code", "crumbs"=>"pagecraft-crumbs", "button"=>"pagecraft-button",
		"nav"=>"pagecraft-nav-menu", "form"=>"pagecraft-form", "accordion"=>"pagecraft-accordion",
		"embed"=>"pagecraft-embed", "spacer"=>"pagecraft-spacer", "divider"=>"pagecraft-divider",
	];
	$missing = [];
	foreach ($classes as $component => $class) {
		$nodes = $xpath->query("//*[@id=\"pc-matrix-{$component}\"]");
		$node = $nodes && $nodes->length === 1 ? $nodes->item(0) : null;
		$tokens = $node instanceof DOMElement ? preg_split("/\\s+/", trim($node->getAttribute("class"))) : [];
		if (!$node instanceof DOMElement || !in_array($class, $tokens ?: [], true)) $missing[] = $component;
	}
	if ($missing !== []) {
		fwrite(STDERR, "Public component matrix is missing: " . implode(", ", $missing) . "\n");
		exit(1);
	}
	$synthetic = $xpath->query("//*[@data-pagecraft-component]");
	if ($synthetic && $synthetic->length > 0) {
		fwrite(STDERR, "Synthetic component labels are not accepted as integration evidence.\n");
		exit(1);
	}
	$contracts = [
		"//*[@id=\"pc-matrix-slider\" and @data-slides and @role=\"group\"]",
		"//*[@id=\"pc-matrix-tabs\" and @data-tabs]//*[@role=\"tablist\"]//*[@role=\"tab\"]",
		"//*[@id=\"pc-matrix-tabs\" and @data-tabs]//*[@role=\"tabpanel\"]",
		"//*[@id=\"pc-matrix-nav\" and @data-nav]//*[@data-nav-t and @aria-expanded]",
		"//*[@id=\"pc-matrix-nav\" and @data-nav]//*[@data-nav-l]",
		"//*[@id=\"pc-matrix-accordion\"]//details/summary",
		"//form[@id=\"pc-matrix-form\" and @data-pagecraft-form-mode=\"wordpress\"]",
		"//*[@id=\"pc-matrix-video\"]//button[contains(@data-embed, \"https://www.youtube.com/embed/aqz-KE-bpKQ\") and @data-pagecraft-embed-provider=\"youtube\"]",
		"//*[@id=\"pc-matrix-embed\"]//iframe[contains(@src, \"https://player.vimeo.com/video/76979871\") and @data-pagecraft-embed-provider=\"vimeo\"]",
	];
	foreach ($contracts as $query) {
		$nodes = $xpath->query($query);
		if (!$nodes || $nodes->length < 1) {
			fwrite(STDERR, "A real Core interaction contract is missing: {$query}\n");
			exit(1);
		}
	}
	' || fail "${context} did not expose the complete component matrix"
}

fetch() {
	local url="$1"
	local attempt

	for attempt in $(seq 1 30); do
		if curl --fail --silent --show-error --location --max-time 10 "${url}"; then
			return 0
		fi
		sleep 1
	done

	return 1
}

assert_exact_managed_url() {
	local url="$1"
	local context="$2"
	local effective
	effective="$(curl --fail --silent --show-error --location --output /dev/null --max-time 10 --write-out '%{url_effective}' "${url}")" \
		|| fail "${context} was unavailable"
	[[ "${effective}" == "${url}" ]] || fail "${context} redirected to ${effective} instead of preserving its exact signed route"
}

debug_log_size() {
	local target="$1"
	compose exec -T "${target}-wordpress" sh -c '
		path=/var/www/html/wp-content/debug.log
		if [ -f "$path" ]; then wc -c < "$path"; else echo 0; fi
	' | tr -d '[:space:]'
}

check_debug_log() {
	local target="$1"
	local offset="$2"
	[[ "${offset}" =~ ^[0-9]+$ ]] || fail "${target} debug-log baseline was invalid"
	wp_run "${target}" eval '
	$path = WP_CONTENT_DIR . "/debug.log";
	if (!is_readable($path)) {
		echo "clean\n";
		return;
	}
	$log = (string) file_get_contents($path);
	$offset = '"${offset}"';
	if ($offset > strlen($log)) { $offset = 0; }
	$log = substr($log, $offset);
	if (preg_match("/PHP (Fatal error|Parse error)/i", $log)) {
		WP_CLI::error("WordPress debug.log contains a new fatal or parse error.");
	}
	echo "clean\n";
	' >/dev/null
}

configure_local_connector_trust() {
	local target="$1"
	wp_run "${target}" config set PAGECRAFT_CONNECTOR_ALLOW_INSECURE_LOOPBACK true --raw --quiet >/dev/null
	wp_run "${target}" config set PAGECRAFT_CONNECTOR_ALLOW_LOCAL_ROOT_OVERRIDE true --raw --quiet >/dev/null
	wp_run "${target}" config set PAGECRAFT_CONNECTOR_LOCAL_ROOT_PUBLIC_KEY "${PAGECRAFT_TEST_ROOT_PUBLIC_KEY}" --quiet >/dev/null
}

fixture_route() {
	local target="$1"
	wp_run "${target}" option get pagecraft_test_connected_fixture --format=json 2>/dev/null \
		| php -r '$value=json_decode(stream_get_contents(STDIN),true,64,JSON_THROW_ON_ERROR); echo $value["test_route"] ?? "";'
}

fixture_marker() {
	local target="$1"
	wp_run "${target}" eval '
	$release = pagecraft_get_active_release();
	if (!is_array($release)) { WP_CLI::error("No active connected fixture."); }
	echo Pagecraft\Connector\Support::releaseMarker((string) $release["deployment_id"], (string) $release["artifact_hash"]);
	' 2>/dev/null
}

assert_connected_fixture_state() {
	local target="$1"
	wp_run "${target}" eval '
	$fixture = get_option("pagecraft_test_connected_fixture", []);
	$release = pagecraft_get_active_release();
	if (!is_array($fixture) || !is_array($release)) { WP_CLI::error("Connected fixture state is unavailable."); }
	if (!hash_equals((string) ($fixture["deployment_id"] ?? ""), (string) ($release["deployment_id"] ?? ""))) {
		WP_CLI::error("The active pointer does not match the staged Connected fixture.");
	}
	foreach (["route_count", "asset_count", "form_count", "cms_collections", "cms_items", "runtime_count", "responsive_count", "subdirectory_links"] as $field) {
		if ((int) ($fixture[$field] ?? 0) < 1) { WP_CLI::error("Connected component fixture has no " . $field . "."); }
	}
	$expected = ["section","row","list","slider","column","box","heading","text","quote","image","gallery","video","icon","tabs","table","code","crumbs","button","nav","form","accordion","embed","spacer","divider"];
	$actual = array_values(array_filter((array) ($fixture["components"] ?? []), "is_string"));
	$missing = array_values(array_diff($expected, $actual));
	if ($missing !== []) { WP_CLI::error("Connected component matrix is missing: " . implode(", ", $missing)); }
	global $wpdb;
	$activeCms = (int) $wpdb->get_var($wpdb->prepare(
		"SELECT COUNT(*) FROM {$wpdb->prefix}pagecraft_objects WHERE deployment_id = %s AND source_type = %s AND state = %s",
		(string) $release["deployment_id"], "cms", "active"
	));
	if ($activeCms < (int) $fixture["cms_items"]) { WP_CLI::error("Not every signed CMS item became an active versioned mapping."); }
	echo "connected-fixture-ok\n";
	' >/dev/null
}

mark_fixture_verified() {
	local target="$1"
	wp_run "${target}" eval '
	$release = pagecraft_get_active_release();
	$result = is_array($release) ? (new Pagecraft\Connector\ReleaseRepository())->markVerified((string) $release["deployment_id"]) : new WP_Error("missing", "Missing active release.");
	if (is_wp_error($result)) { WP_CLI::error($result->get_error_message()); }
	echo "verified\n";
	' >/dev/null
}

if ! command -v curl >/dev/null 2>&1; then
	fail 'curl is required.'
fi

staging_debug_offset="$(debug_log_size staging)"
production_debug_offset="$(debug_log_size production)"
staging_theme="$(wp_run staging theme list --status=active --field=name | tr -d '\r')"
production_theme="$(wp_run production theme list --status=active --field=name | tr -d '\r')"

[[ "${staging_theme}" == 'pagecraft' ]] || fail "staging active theme was ${staging_theme}, expected pagecraft"
[[ "${production_theme}" == 'twentytwentyfour' ]] || fail "production active theme was ${production_theme}, expected twentytwentyfour"

staging_native="$(fetch "http://localhost:${STAGING_PORT}/wordpress-owned/")"
production_native="$(fetch "http://localhost:${PRODUCTION_PORT}/wordpress-owned/")"

assert_contains "${staging_native}" 'data-pagecraft-native-fixture="staging"' 'staging native page'
assert_contains "${staging_native}" 'pagecraft-theme-fallback' 'staging native page body'
assert_contains "${production_native}" 'data-pagecraft-native-fixture="production"' 'production native page'

staging_connector=0
production_connector=0
if wp_run staging plugin is-active pagecraft-connector >/dev/null 2>&1; then
	staging_connector=1
fi
if wp_run production plugin is-active pagecraft-connector >/dev/null 2>&1; then
	production_connector=1
fi

if [[ "${staging_connector}" == '1' || "${production_connector}" == '1' ]]; then
	[[ "${staging_connector}" == '1' && "${production_connector}" == '1' ]] || fail 'connector must be active in both targets or neither target'

	if [[ "${PAGECRAFT_INSTALL_RELEASE_FIXTURE}" == '1' ]]; then
		for target in staging production; do
			configure_local_connector_trust "${target}"
			wp_run "${target}" eval-file /opt/pagecraft-tests/fixtures/install-active-release.php "${target}" >/dev/null
		done
	fi

	for target in staging production; do
		wp_run "${target}" eval '
		$required = ["pagecraft_get_active_release", "pagecraft_render_route", "pagecraft_render_managed_content"];
		foreach ($required as $function) {
			if (!function_exists($function)) {
				WP_CLI::error("Missing connector API: " . $function);
			}
		}
		$release = pagecraft_get_active_release();
		if (!is_array($release) || empty($release["release_id"])) {
			WP_CLI::error("No active fixture release.");
		}
		echo "api-ok\n";
		' >/dev/null
	done

	assert_connected_fixture_state staging
	assert_connected_fixture_state production
	staging_route="$(fixture_route staging | tr -d '\r')"
	production_route="$(fixture_route production | tr -d '\r')"
	[[ -n "${staging_route}" && -n "${production_route}" ]] || fail 'Connected fixture did not expose managed component routes'
	staging_managed="$(fetch "http://localhost:${STAGING_PORT}${staging_route}")"
	production_managed="$(fetch "http://localhost:${PRODUCTION_PORT}${production_route}")"
	assert_exact_managed_url "http://localhost:${STAGING_PORT}${staging_route}" 'staging managed route'
	assert_exact_managed_url "http://localhost:${PRODUCTION_PORT}${production_route}" 'production managed route'
	staging_marker="$(fixture_marker staging | tr -d '\r')"
	production_marker="$(fixture_marker production | tr -d '\r')"

	assert_contains "${staging_managed}" "data-pagecraft-release-root=\"${staging_marker}\"" 'staging exact release marker'
	assert_contains "${staging_managed}" 'pagecraft-theme-managed' 'staging managed route body'
	assert_contains "${production_managed}" "data-pagecraft-release-root=\"${production_marker}\"" 'production exact release marker'
	assert_contains "${staging_managed}" '/wp-json/pagecraft/v1/forms/' 'staging managed WordPress form transport'
	assert_contains "${production_managed}" '/wp-json/pagecraft/v1/forms/' 'production managed WordPress form transport'
	assert_contains "${staging_managed}" 'name="pagecraft_form_token"' 'staging managed WordPress form token'
	assert_contains "${production_managed}" 'name="pagecraft_form_token"' 'production managed WordPress form token'
	assert_contains "${staging_managed}" '@media' 'staging responsive signed CSS'
	assert_contains "${production_managed}" '@media' 'production responsive signed CSS'
	assert_contains "${staging_managed}" '<script' 'staging approved signed runtime'
	assert_contains "${production_managed}" '<script' 'production approved signed runtime'
	assert_before "${staging_managed}" '<style data-pagecraft-route>' '<script>window.pagecraftGoldenHeadOrder=true</script>' 'staging CSS before approved head runtime'
	assert_before "${production_managed}" '<style data-pagecraft-route>' '<script>window.pagecraftGoldenHeadOrder=true</script>' 'production CSS before approved head runtime'
	[[ "${staging_managed}" != *'pc-asset://'* ]] || fail 'staging managed route retained unresolved signed asset tokens'
	[[ "${production_managed}" != *'pc-asset://'* ]] || fail 'production managed route retained unresolved signed asset tokens'
	assert_component_matrix "${staging_managed}" 'staging managed route'
	assert_component_matrix "${production_managed}" 'production managed route'
	mark_fixture_verified staging
	mark_fixture_verified production

	if [[ "${PAGECRAFT_RUN_SEO_MATRIX}" == '1' ]]; then
		STAGING_PORT="${STAGING_PORT}" PRODUCTION_PORT="${PRODUCTION_PORT}" \
			bash "${SCRIPT_DIR}/seo-matrix.sh"
	fi
else
	echo 'Connector is inactive; managed-route checks skipped.'
fi

check_debug_log staging "${staging_debug_offset}"
check_debug_log production "${production_debug_offset}"

echo 'WordPress theme-mode and existing-theme smoke checks passed.'
