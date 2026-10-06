<?php
/**
 * Wires the plugin into WordPress and builds its services on first use, so ordinary page loads
 * pay for nothing but a few hook registrations.
 *
 * @package AgentMate\Connector
 */

namespace AgentMate\Connector;

use AgentMate\Connector\Admin\AdminPage;
use AgentMate\Connector\Audit\AuditLog;
use AgentMate\Connector\Auth\KeyService;
use AgentMate\Connector\Auth\SiteMove;
use AgentMate\Connector\Cli\ConnectionsCommand;
use AgentMate\Connector\Cli\DeploysCommand;
use AgentMate\Connector\Cli\KeyCommand;
use AgentMate\Connector\Cli\RescueCommand;
use AgentMate\Connector\Cli\StatusCommand;
use AgentMate\Connector\Crypto\SiteKeys;
use AgentMate\Connector\Deploy\DeployService;
use AgentMate\Connector\Env\Environment;
use AgentMate\Connector\Env\WordPressEnvironment;
use AgentMate\Connector\Http\Dispatcher;
use AgentMate\Connector\Http\Transport;
use AgentMate\Connector\Routes\Handlers;
use AgentMate\Connector\Storage\Storage;
use AgentMate\Connector\Storage\WpdbStorage;

final class Plugin
{
    /** @var Storage|null */
    private static $storage = null;

    /** @var Environment|null */
    private static $environment = null;

    /** @var SiteKeys|null */
    private static $keys = null;

    public static function boot(): void
    {
        if (Transport::looksLikeOurs()) {
            Transport::prepareEarly();
        }
        add_action('plugins_loaded', array(self::class, 'init'));
    }

    public static function init(): void
    {
        $cli = defined('WP_CLI') && WP_CLI && class_exists('WP_CLI');
        // The schema check reads an option that is not autoloaded, so visitors' page views skip it.
        if (is_admin() || $cli || Transport::looksLikeOurs()) {
            Activator::maybeUpgrade();
        }
        Transport::register();
        if (is_admin()) {
            AdminPage::register();
        }
        if ($cli) {
            \WP_CLI::add_command('agentmate key', KeyCommand::class);
            \WP_CLI::add_command('agentmate connections', ConnectionsCommand::class);
            \WP_CLI::add_command('agentmate deploys', DeploysCommand::class);
            \WP_CLI::add_command('agentmate status', StatusCommand::class);
            // The guard registers `wp agentmate rescue` so it works even with --skip-plugins;
            // without a guard the plugin does it.
            if (!defined('AGENTMATE_CONNECTOR_GUARD')) {
                \WP_CLI::add_command('agentmate rescue', RescueCommand::class);
            }
        }
    }

    public static function storage(): Storage
    {
        if (self::$storage === null) {
            global $wpdb;
            self::$storage = new WpdbStorage($wpdb);
        }
        return self::$storage;
    }

    public static function environment(): Environment
    {
        if (self::$environment === null) {
            self::$environment = new WordPressEnvironment();
        }
        return self::$environment;
    }

    public static function siteKeys(): SiteKeys
    {
        if (self::$keys === null) {
            $home = is_multisite() ? get_blog_option(get_main_site_id(), 'home') : get_option('home');
            self::$keys = SiteKeys::load((string) $home, array(self::class, 'siteMoved'));
        }
        return self::$keys;
    }

    /** The site key was renewed because the address changed: nothing paired with the old one works. */
    public static function siteMoved(string $from, string $to): void
    {
        SiteMove::apply(self::storage(), time(), $from, $to);
    }

    public static function audit(): AuditLog
    {
        return new AuditLog(self::storage());
    }

    public static function keyService(): KeyService
    {
        return new KeyService(self::storage(), self::environment(), self::siteKeys(), self::audit());
    }

    public static function dispatcher(): Dispatcher
    {
        $storage = self::storage();
        $env = self::environment();
        return new Dispatcher($storage, $env, self::siteKeys(), Handlers::all($storage, $env), array(self::class, 'logError'));
    }

    /** Only the rescue routes, for the guard (before regular plugins load). */
    public static function rescueDispatcher(): Dispatcher
    {
        $storage = self::storage();
        $env = self::environment();
        return new Dispatcher($storage, $env, self::siteKeys(), Handlers::rescue($storage, $env), array(self::class, 'logError'));
    }

    public static function deployService(): DeployService
    {
        return new DeployService(self::storage(), self::environment(), self::audit());
    }

    public static function logError(\Throwable $error): void
    {
        // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- the site owner's only window into a failed call.
        error_log('AgentMate Connector: ' . get_class($error) . ': ' . $error->getMessage() . ' in ' . $error->getFile() . ':' . $error->getLine());
    }
}
