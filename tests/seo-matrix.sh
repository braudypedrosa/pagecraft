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

YOAST_VERSION="${YOAST_VERSION:-23.5}"
RANK_MATH_VERSION="${RANK_MATH_VERSION:-1.0.225}"
STAGING_PORT="${STAGING_PORT:-8088}"
PRODUCTION_PORT="${PRODUCTION_PORT:-8089}"

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

if ! command -v curl >/dev/null 2>&1; then
	fail 'curl is required.'
fi

if ! command -v php >/dev/null 2>&1 || ! php -r 'exit(class_exists("DOMDocument") ? 0 : 1);'; then
	fail 'PHP with the DOM extension is required.'
fi

ensure_plugin_version() {
	local target="$1"
	local slug="$2"
	local version="$3"
	local installed=''

	if wp_run "${target}" plugin is-installed "${slug}" >/dev/null 2>&1; then
		installed="$(wp_run "${target}" plugin get "${slug}" --field=version | tr -d '\r')"
	fi

	if [[ "${installed}" != "${version}" ]]; then
		wp_run "${target}" plugin install "${slug}" --version="${version}" --force >/dev/null
	fi
}

deactivate_seo_plugins() {
	local target="$1"
	wp_run "${target}" plugin deactivate wordpress-seo seo-by-rank-math --quiet >/dev/null 2>&1 || true
}

set_seo_mode() {
	local target="$1"
	local mode="$2"

	deactivate_seo_plugins "${target}"

	case "${mode}" in
		fallback)
			;;
		yoast)
			wp_run "${target}" plugin activate wordpress-seo --quiet >/dev/null
			;;
		rank-math)
			wp_run "${target}" plugin activate seo-by-rank-math --quiet >/dev/null
			;;
		conflict)
			wp_run "${target}" plugin activate wordpress-seo seo-by-rank-math --quiet >/dev/null
			;;
		*)
			fail "unknown SEO mode ${mode}"
			;;
	esac
}

assert_doctor() {
	local target="$1"
	local expected_adapter="$2"
	local expected_ok="$3"
	local expected_error="${4:-}"
	local output=''
	local status=0

	set +e
	output="$(wp_run "${target}" pagecraft doctor --format=json 2>/dev/null)"
	status=$?
	set -e

	if [[ -z "${output}" ]]; then
		fail "${target} doctor returned no JSON for ${expected_adapter} mode"
	fi

	printf '%s' "${output}" | php -r '
	$payload = json_decode(stream_get_contents(STDIN), true, 64, JSON_THROW_ON_ERROR);
	$adapter = $payload["seo"]["adapter"] ?? null;
	$ok = $payload["seo"]["ok"] ?? null;
	$error = $payload["seo"]["error_code"] ?? "";
	if ($adapter !== $argv[1]) {
		fwrite(STDERR, "Expected SEO adapter {$argv[1]}, got " . var_export($adapter, true) . "\n");
		exit(1);
	}
	$expectedOk = $argv[2] === "true";
	if ($ok !== $expectedOk) {
		fwrite(STDERR, "Unexpected SEO health result.\n");
		exit(1);
	}
	if ($error !== $argv[3]) {
		fwrite(STDERR, "Expected SEO error {$argv[3]}, got {$error}.\n");
		exit(1);
	}
	' "${expected_adapter}" "${expected_ok}" "${expected_error}" || fail "${target} doctor JSON did not match ${expected_adapter} mode"

	if [[ "${expected_ok}" == 'true' && "${status}" != '0' ]]; then
		fail "${target} doctor failed in healthy ${expected_adapter} mode"
	fi

	if [[ "${expected_ok}" == 'false' ]] && wp_run "${target}" pagecraft doctor >/dev/null 2>&1; then
		fail "${target} human-readable doctor did not block ${expected_adapter} mode"
	fi
}

assert_managed_seo() {
	local target="$1"
	local port="$2"
	local route="$3"
	local html=''

	html="$(curl --fail --silent --show-error --location --max-time 10 "http://localhost:${port}${route}")" || fail "${target} managed route was unavailable"

	printf '%s' "${html}" | php -r '
	libxml_use_internal_errors(true);
	$document = new DOMDocument();
	if (!$document->loadHTML(stream_get_contents(STDIN))) {
		fwrite(STDERR, "Could not parse managed route HTML.\n");
		exit(1);
	}
	$xpath = new DOMXPath($document);
	$canonical = $xpath->query("//link[contains(concat(\" \", normalize-space(@rel), \" \"), \" canonical \")]");
	$description = $xpath->query("//meta[translate(@name, \"ABCDEFGHIJKLMNOPQRSTUVWXYZ\", \"abcdefghijklmnopqrstuvwxyz\") = \"description\"]");
	$openGraph = $xpath->query("//meta[translate(@property, \"ABCDEFGHIJKLMNOPQRSTUVWXYZ\", \"abcdefghijklmnopqrstuvwxyz\") = \"og:title\"]");
	if (!$canonical || $canonical->length !== 1) {
		fwrite(STDERR, "Expected exactly one canonical link.\n");
		exit(1);
	}
	if (!$description || $description->length !== 1) {
		fwrite(STDERR, "Expected exactly one meta description.\n");
		exit(1);
	}
	if (!$openGraph || $openGraph->length !== 1) {
		fwrite(STDERR, "Expected exactly one Open Graph title.\n");
		exit(1);
	}
	if ($canonical->item(0)->getAttribute("href") !== $argv[1]) {
		fwrite(STDERR, "Managed route canonical did not match its WordPress origin.\n");
		exit(1);
	}
	' "http://localhost:${port}${route}" || fail "${target} managed SEO tags were missing or duplicated"
}

for target in staging production; do
	wp_run "${target}" plugin is-active pagecraft-connector >/dev/null 2>&1 || fail "Pagecraft Connector is inactive on ${target}"
	ensure_plugin_version "${target}" wordpress-seo "${YOAST_VERSION}"
	ensure_plugin_version "${target}" seo-by-rank-math "${RANK_MATH_VERSION}"
done

for target in staging production; do
	if [[ "${target}" == 'staging' ]]; then
		target_port="${STAGING_PORT}"
	else
		target_port="${PRODUCTION_PORT}"
	fi
	target_route="$(wp_run "${target}" option get pagecraft_test_connected_fixture --format=json 2>/dev/null \
		| php -r '$value=json_decode(stream_get_contents(STDIN),true,64,JSON_THROW_ON_ERROR); echo $value["test_route"] ?? "";' | tr -d '\r')"
	[[ -n "${target_route}" ]] || fail "${target} Connected fixture route is unavailable"

	set_seo_mode "${target}" fallback
	assert_doctor "${target}" fallback true
	assert_managed_seo "${target}" "${target_port}" "${target_route}"

	set_seo_mode "${target}" yoast
	assert_doctor "${target}" yoast true
	assert_managed_seo "${target}" "${target_port}" "${target_route}"

	set_seo_mode "${target}" rank-math
	assert_doctor "${target}" rank-math true
	assert_managed_seo "${target}" "${target_port}" "${target_route}"

	set_seo_mode "${target}" conflict
	assert_doctor "${target}" conflict false pagecraft_seo_conflict

	# Leave the local target in a healthy deterministic state.
	set_seo_mode "${target}" fallback
	assert_doctor "${target}" fallback true
done

echo 'SEO fallback, Yoast, Rank Math, and blocking-conflict checks passed.'
