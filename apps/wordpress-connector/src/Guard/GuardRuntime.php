<?php
/**
 * What the guard mu-plugin does once it sees a pending deploy, a rescue call or WP-CLI. It runs
 * before regular plugins load, so a plugin a deploy broke cannot stop it.
 *
 * @package AgentMate\Connector
 */

namespace AgentMate\Connector\Guard;

use AgentMate\Connector\Cli\RescueCommand;
use AgentMate\Connector\Files\Paths;
use AgentMate\Connector\Http\Transport;
use AgentMate\Connector\Plugin;
use AgentMate\Connector\Protocol;

final class GuardRuntime
{
    const FATAL = array(E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR, E_RECOVERABLE_ERROR);

    /** @var array{d: string, t: int, f: string[]}|null */
    private static $state = null;

    public static function run(string $pluginDir, string $rawState, bool $maybeRescue): void
    {
        if (!defined('AGENTMATE_CONNECTOR_FILE')) {
            define('AGENTMATE_CONNECTOR_FILE', $pluginDir . '/agentmate-connector.php');
        }
        if (defined('WP_CLI') && WP_CLI && class_exists('WP_CLI')) {
            \WP_CLI::add_command('agentmate rescue', RescueCommand::class);
        }
        self::$state = GuardState::decode($rawState);
        if (self::$state !== null) {
            register_shutdown_function(array(self::class, 'shutdown'));
            if (time() > self::$state['t']) {
                self::safely(function () {
                    Plugin::deployService()->checkPending();
                });
            }
        }
        if ($maybeRescue) {
            $route = self::rescueRoute();
            if ($route !== null) {
                self::serve($route);
            }
        }
    }

    /** Rolls the deploy back when PHP died of a fatal error in a file it changed. */
    public static function shutdown(): void
    {
        $error = error_get_last();
        if (self::$state === null || !is_array($error) || !in_array($error['type'], self::FATAL, true)) {
            return;
        }
        $file = (string) $error['file'];
        $real = realpath($file);
        foreach (self::$state['f'] as $changed) {
            if (Paths::same($changed, $file) || ($real !== false && Paths::same($changed, $real))) {
                self::safely(function () use ($file) {
                    Plugin::deployService()->onFatal($file);
                });
                return;
            }
        }
    }

    /**
     * The rescue route this request is for, from a REST URL, ?rest_route= or admin-ajax.
     */
    public static function rescueRoute(): ?string
    {
        // phpcs:disable WordPress.Security.NonceVerification.Recommended -- the call is authenticated by its signature.
        $pattern = '#^/' . preg_quote(Protocol::REST_NAMESPACE, '#') . '(/rescue/(?:status|rollback))/?$#D';
        if (isset($_GET['rest_route']) && is_string($_GET['rest_route']) && preg_match($pattern, sanitize_text_field(wp_unslash($_GET['rest_route'])), $match) === 1) {
            return $match[1];
        }
        $uri = isset($_SERVER['REQUEST_URI']) ? rawurldecode(esc_url_raw(wp_unslash($_SERVER['REQUEST_URI']))) : '';
        $path = (string) wp_parse_url($uri, PHP_URL_PATH);
        if (preg_match('#/' . preg_quote(Protocol::REST_NAMESPACE, '#') . '(/rescue/(?:status|rollback))/?$#D', $path, $match) === 1) {
            return $match[1];
        }
        $isAjax = substr($path, -strlen('/admin-ajax.php')) === '/admin-ajax.php';
        $action = isset($_GET['action']) && is_string($_GET['action']) ? sanitize_text_field(wp_unslash($_GET['action'])) : '';
        $route = isset($_GET['route']) && is_string($_GET['route']) ? sanitize_text_field(wp_unslash($_GET['route'])) : '';
        // phpcs:enable WordPress.Security.NonceVerification.Recommended
        if ($isAjax && $action === Protocol::AJAX_ACTION && in_array($route, array('/rescue/status', '/rescue/rollback'), true)) {
            return $route;
        }
        return null;
    }

    private static function serve(string $route): void
    {
        if (!defined('DONOTCACHEPAGE')) {
            define('DONOTCACHEPAGE', true);
        }
        $response = Plugin::rescueDispatcher()->handle(Transport::incoming($route));
        Transport::emit($response);
        exit;
    }

    private static function safely(callable $work): void
    {
        try {
            $work();
        } catch (\Throwable $error) {
            Plugin::logError($error);
        }
    }
}
