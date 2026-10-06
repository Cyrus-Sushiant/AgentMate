<?php
/**
 * `wp agentmate status`.
 *
 * @package AgentMate\Connector
 */

namespace AgentMate\Connector\Cli;

use AgentMate\Connector\Guard\GuardInstaller;
use AgentMate\Connector\Info\StatusChecks;
use AgentMate\Connector\Plugin;

/**
 * Checks what this site allows and what protects a deploy here.
 */
final class StatusCommand
{
    /**
     * Runs the same checks as the Status tab in wp-admin, including a loopback request.
     *
     * ## OPTIONS
     *
     * [--format=<format>]
     * : How to print them.
     * ---
     * default: table
     * options:
     *   - table
     *   - json
     *   - csv
     *   - yaml
     * ---
     *
     * ## EXAMPLES
     *
     *     wp agentmate status
     *
     * @when after_wp_load
     *
     * @param string[] $args
     * @param array<string, string|bool> $assoc
     */
    public function __invoke($args, $assoc): void
    {
        if (!function_exists('get_plugin_data')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        $header = get_plugin_data(AGENTMATE_CONNECTOR_FILE, false, false);
        $checks = StatusChecks::run(Plugin::environment(), Plugin::storage(), array(
            'headerVersion' => isset($header['Version']) ? (string) $header['Version'] : null,
            'guardCurrent' => GuardInstaller::isCurrent(dirname(AGENTMATE_CONNECTOR_FILE)),
        ));
        $rows = array();
        foreach ($checks as $check) {
            $rows[] = array(
                'check' => $check['label'],
                'result' => $check['ok'] === true ? 'ok' : ($check['ok'] === false ? 'problem' : 'note'),
                'detail' => $check['detail'],
            );
        }
        \WP_CLI\Utils\format_items(isset($assoc['format']) ? (string) $assoc['format'] : 'table', $rows, array('check', 'result', 'detail'));
    }
}
