<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

final class Plugin
{
    private static ?self $instance = null;
    private bool $booted = false;

    private Connection $connection;
    private ReleaseRepository $releases;
    private ScriptApprovals $scripts;
    private HttpClient $http;
    private ReleaseVerifier $verifier;
    private Mapper $mapper;
    private ManagedPages $managedPages;
    private CmsWriteback $cmsWriteback;
    private Forms $forms;
    private Seo $seo;
    private Renderer $renderer;
    private Sync $sync;
    private RestApi $rest;
    private Cron $cron;
    private Preflight $preflight;
    private Admin $admin;
    private SiteHealth $health;
    private Updater $updater;
    private Revocation $revocation;
    private PairingConfirmation $pairingConfirmation;
    private ContentIndex $contentIndex;

    public static function instance(): self
    {
        return self::$instance ??= new self();
    }

    private function __construct()
    {
        $this->connection = new Connection();
        $this->releases = new ReleaseRepository();
        $this->scripts = new ScriptApprovals();
        $this->http = new HttpClient($this->connection);
        $this->pairingConfirmation = new PairingConfirmation($this->connection, $this->http);
        $this->revocation = new Revocation($this->connection, $this->http);
        $this->contentIndex = new ContentIndex($this->connection, $this->http);
        $this->verifier = new ReleaseVerifier($this->connection, $this->scripts);
        $this->mapper = new Mapper($this->releases);
        $this->managedPages = new ManagedPages($this->connection);
        $this->cmsWriteback = new CmsWriteback($this->connection, $this->http, $this->releases);
        $this->forms = new Forms($this->connection);
        $this->seo = new Seo($this->releases, $this->connection);
        $this->renderer = new Renderer($this->releases, $this->scripts, $this->forms, $this->seo, $this->connection);
        $this->sync = new Sync($this->connection, $this->http, $this->verifier, $this->releases, $this->mapper);
        $this->rest = new RestApi($this->connection, $this->verifier, $this->sync, $this->forms);
        $this->cron = new Cron($this->sync, $this->releases, $this->forms, $this->cmsWriteback);
        $this->preflight = new Preflight($this->connection, $this->mapper, $this->cron);
        $this->admin = new Admin($this->connection, $this->releases, $this->sync, $this->scripts, $this->http, $this->forms, $this->mapper, $this->preflight, $this->revocation, $this->pairingConfirmation);
        $this->health = new SiteHealth($this->connection, $this->releases, $this->cron, $this->verifier, $this->preflight);
        $this->updater = new Updater($this->connection, $this->http);
    }

    public function boot(): void
    {
        if ($this->booted) {
            return;
        }
        $this->booted = true;

        load_plugin_textdomain('pagecraft-connector', false, dirname(plugin_basename(PAGECRAFT_CONNECTOR_FILE)) . '/languages');
        $schemaReady = Schema::ready();
        if ((string) get_option('pagecraft_schema_version', '') !== Schema::VERSION || !$schemaReady) {
            $schemaReady = Schema::install();
        }
        if (!$schemaReady) {
            // No sync, webhook, CMS, renderer, or cron hook may run against a
            // partially migrated schema. A later request retries installation.
            add_action('admin_notices', static function (): void {
                echo '<div class="notice notice-error"><p>'
                    . esc_html__('Pagecraft Connector could not verify its database schema. Connected operations remain disabled and setup will retry on the next request.', 'pagecraft-connector')
                    . '</p></div>';
            });
            return;
        }

        $this->connection->hooks();
        $this->pairingConfirmation->hooks();
        $this->revocation->hooks();
        $this->contentIndex->hooks();
        $this->mapper->hooks();
        $this->managedPages->hooks();
        $this->cmsWriteback->hooks();
        $this->forms->hooks();
        $this->seo->hooks();
        $this->renderer->hooks();
        $this->rest->hooks();
        $this->cron->hooks();
        $this->preflight->hooks();
        $this->admin->hooks();
        $this->health->hooks();
        $this->updater->hooks();

        if (defined('WP_CLI') && WP_CLI && class_exists('WP_CLI')) {
            CliCommand::register($this->sync, $this->releases, $this->connection, $this->seo, $this->scripts, $this->preflight, $this->revocation);
        }
    }

    public function connection(): Connection
    {
        return $this->connection;
    }

    public function releases(): ReleaseRepository
    {
        return $this->releases;
    }

    public function renderer(): Renderer
    {
        return $this->renderer;
    }
}
