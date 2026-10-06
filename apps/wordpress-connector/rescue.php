<?php
/**
 * AgentMate Connector rescue endpoint: the last way back when a deploy broke something that loads
 * before the guard (another mu-plugin, say). It loads WordPress with SHORTINIT, so no plugin,
 * mu-plugin or theme runs, and answers only /rescue/status and /rescue/rollback, with the same
 * signed requests and replies as every other route: POST rescue.php?route=/rescue/status.
 *
 * @package AgentMate\Connector
 */

// phpcs:disable WordPress.Security.ValidatedSanitizedInput, WordPress.Security.NonceVerification -- checked by the signature, like every route.

if (!isset($_SERVER['REQUEST_METHOD']) || 'POST' !== $_SERVER['REQUEST_METHOD']) {
    http_response_code(405);
    header('Allow: POST');
    exit;
}

$agentmate_connector_load = null;
$agentmate_connector_config = __DIR__ . '/rescue-config.php';
if (is_file($agentmate_connector_config)) {
    $agentmate_connector_settings = include $agentmate_connector_config;
    if (is_array($agentmate_connector_settings) && isset($agentmate_connector_settings['abspath']) && is_string($agentmate_connector_settings['abspath'])
        && is_file(rtrim($agentmate_connector_settings['abspath'], '/\\') . '/wp-load.php')) {
        $agentmate_connector_load = rtrim($agentmate_connector_settings['abspath'], '/\\') . '/wp-load.php';
    }
}
if (null === $agentmate_connector_load) {
    // The usual layout: wp-content/plugins/<this folder>/rescue.php.
    $agentmate_connector_up = __DIR__;
    for ($agentmate_connector_level = 0; $agentmate_connector_level < 6 && null === $agentmate_connector_load; $agentmate_connector_level++) {
        $agentmate_connector_up = dirname($agentmate_connector_up);
        if (is_file($agentmate_connector_up . '/wp-load.php')) {
            $agentmate_connector_load = $agentmate_connector_up . '/wp-load.php';
        }
    }
}
if (null === $agentmate_connector_load) {
    http_response_code(503);
    exit;
}

define('SHORTINIT', true);
require $agentmate_connector_load;
require_once __DIR__ . '/src/Autoloader.php';
\AgentMate\Connector\Autoloader::register(__DIR__ . '/src');
\AgentMate\Connector\Guard\Rescue::serve(__DIR__);
