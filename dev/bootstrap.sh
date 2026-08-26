#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/compose.yml"

if [[ -f "${SCRIPT_DIR}/.env" ]]; then
	set -a
	# shellcheck disable=SC1091
	source "${SCRIPT_DIR}/.env"
	set +a
fi

STAGING_PORT="${STAGING_PORT:-8088}"
PRODUCTION_PORT="${PRODUCTION_PORT:-8089}"
WP_ADMIN_USER="${WP_ADMIN_USER:-pagecraft}"
WP_ADMIN_PASSWORD="${WP_ADMIN_PASSWORD:-pagecraft-dev}"
WP_ADMIN_EMAIL="${WP_ADMIN_EMAIL:-pagecraft@example.test}"
PAGECRAFT_INSTALL_RELEASE_FIXTURE="${PAGECRAFT_INSTALL_RELEASE_FIXTURE:-1}"
PAGECRAFT_ACTIVATE_CONNECTOR="${PAGECRAFT_ACTIVATE_CONNECTOR:-1}"
PAGECRAFT_TEST_ROOT_PUBLIC_KEY="${PAGECRAFT_TEST_ROOT_PUBLIC_KEY:-AYrtOA8MouvyuMBywFi5i6jY90dxxYch28ujLoSRm0g}"

compose() {
	if [[ -f "${SCRIPT_DIR}/.env" ]]; then
		docker compose --env-file "${SCRIPT_DIR}/.env" --file "${COMPOSE_FILE}" "$@"
	else
		docker compose --file "${COMPOSE_FILE}" "$@"
	fi
}

wp_run() {
	local target="$1"
	shift
	compose run --rm --no-deps "${target}-cli" "$@"
}

wait_for_core() {
	local target="$1"
	local attempt

	for attempt in $(seq 1 60); do
		if wp_run "${target}" core version >/dev/null 2>&1; then
			return 0
		fi
		sleep 2
	done

	echo "WordPress files were not ready for ${target}." >&2
	return 1
}

install_site() {
	local target="$1"
	local port="$2"
	local title="$3"
	local active_theme="$4"

	if ! wp_run "${target}" core is-installed >/dev/null 2>&1; then
		wp_run "${target}" core install \
			--url="http://localhost:${port}" \
			--title="${title}" \
			--admin_user="${WP_ADMIN_USER}" \
			--admin_password="${WP_ADMIN_PASSWORD}" \
			--admin_email="${WP_ADMIN_EMAIL}" \
			--skip-email
	fi

	wp_run "${target}" option update home "http://localhost:${port}" >/dev/null
	wp_run "${target}" option update siteurl "http://localhost:${port}" >/dev/null
	wp_run "${target}" option update permalink_structure '/%postname%/' >/dev/null
	wp_run "${target}" rewrite flush --hard >/dev/null
	wp_run "${target}" theme activate "${active_theme}" >/dev/null
	wp_run "${target}" eval-file /opt/pagecraft-tests/fixtures/install-native-content.php "${target}" >/dev/null

	if [[ "${PAGECRAFT_ACTIVATE_CONNECTOR}" == "1" ]] && wp_run "${target}" plugin is-installed pagecraft-connector >/dev/null 2>&1; then
		wp_run "${target}" config set PAGECRAFT_CONNECTOR_ALLOW_INSECURE_LOOPBACK true --raw --quiet >/dev/null
		wp_run "${target}" config set PAGECRAFT_CONNECTOR_ALLOW_LOCAL_ROOT_OVERRIDE true --raw --quiet >/dev/null
		wp_run "${target}" config set PAGECRAFT_CONNECTOR_LOCAL_ROOT_PUBLIC_KEY "${PAGECRAFT_TEST_ROOT_PUBLIC_KEY}" --quiet >/dev/null
		wp_run "${target}" plugin activate pagecraft-connector >/dev/null

		if [[ "${PAGECRAFT_INSTALL_RELEASE_FIXTURE}" == "1" ]]; then
			wp_run "${target}" eval-file /opt/pagecraft-tests/fixtures/install-active-release.php "${target}" >/dev/null
		fi
	fi
}

if ! command -v docker >/dev/null 2>&1; then
	echo 'Docker is required.' >&2
	exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
	echo 'Docker Compose is required.' >&2
	exit 1
fi

compose up -d staging-db production-db staging-wordpress production-wordpress

wait_for_core staging
wait_for_core production

install_site staging "${STAGING_PORT}" 'Pagecraft staging' pagecraft
install_site production "${PRODUCTION_PORT}" 'Pagecraft production' twentytwentyfour

STAGING_PORT="${STAGING_PORT}" PRODUCTION_PORT="${PRODUCTION_PORT}" \
	bash "${SCRIPT_DIR}/../tests/smoke.sh"

echo
echo "Staging:    http://localhost:${STAGING_PORT} (Pagecraft theme mode)"
echo "Production: http://localhost:${PRODUCTION_PORT} (existing-theme mode)"
echo "Admin user: ${WP_ADMIN_USER}"
echo "Admin password: ${WP_ADMIN_PASSWORD}"
