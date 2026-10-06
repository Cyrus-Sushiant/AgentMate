<?php
/**
 * rescue.php's work, once WordPress is loaded with SHORTINIT: the database and options are there,
 * plugins and themes are not. Only the rescue routes are answered.
 *
 * @package AgentMate\Connector
 */

namespace AgentMate\Connector\Guard;

use AgentMate\Connector\Auth\SiteMove;
use AgentMate\Connector\Crypto\SiteKeys;
use AgentMate\Connector\Env\WordPressEnvironment;
use AgentMate\Connector\Http\Dispatcher;
use AgentMate\Connector\Http\Transport;
use AgentMate\Connector\Plugin;
use AgentMate\Connector\Routes\DeployHandlers;
use AgentMate\Connector\Routes\Handlers;
use AgentMate\Connector\Storage\WpdbStorage;

final class Rescue
{
    const CONFIG = 'rescue-config.php';

    public static function serve(string $pluginDir): void
    {
        global $wpdb;
        if (!defined('AGENTMATE_CONNECTOR_FILE')) {
            define('AGENTMATE_CONNECTOR_FILE', $pluginDir . '/agentmate-connector.php');
        }
        if (!self::active($pluginDir)) {
            // A deactivated connector answers nothing, here as everywhere else.
            http_response_code(404);
            exit;
        }
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- the call is authenticated by its signature.
        $route = isset($_GET['route']) && is_string($_GET['route']) ? sanitize_text_field(wp_unslash($_GET['route'])) : '';
        if (!in_array($route, DeployHandlers::rescueRoutes(), true)) {
            $route = '';
        }
        $storage = new WpdbStorage($wpdb);
        $env = new WordPressEnvironment(true);
        // A copy of the site must not answer with the original's key here either.
        $keys = SiteKeys::load((string) get_option('home'), function (string $from, string $to) use ($storage) {
            SiteMove::apply($storage, time(), $from, $to);
        });
        $dispatcher = new Dispatcher($storage, $env, $keys, Handlers::rescue($storage, $env), array(Plugin::class, 'logError'));
        Transport::emit($dispatcher->handle(Transport::incoming($route)));
        exit;
    }

    private static function active(string $pluginDir): bool
    {
        $basename = basename($pluginDir) . '/agentmate-connector.php';
        $active = get_option('active_plugins');
        if (is_array($active) && in_array($basename, $active, true)) {
            return true;
        }
        if (is_multisite()) {
            $network = get_site_option('active_sitewide_plugins');
            return is_array($network) && isset($network[$basename]);
        }
        return false;
    }

    /** Tells rescue.php where WordPress is, in case the plugin folder is not in the usual place. */
    public static function writeConfig(string $pluginDir): void
    {
        $path = $pluginDir . '/' . self::CONFIG;
        $content = "<?php\n// Written by AgentMate Connector so rescue.php can find WordPress. Safe to delete.\nreturn array('abspath' => " . var_export(ABSPATH, true) . ");\n";
        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
        if (is_file($path) && file_get_contents($path) === $content) {
            return;
        }
        if (is_writable($pluginDir)) {
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
            @file_put_contents($path, $content); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
        }
    }
}
