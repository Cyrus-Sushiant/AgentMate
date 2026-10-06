<?php
/**
 * Removes everything the plugin made: its tables, options and private data folder. Themes and
 * plugins it deployed stay as they are.
 *
 * @package AgentMate\Connector
 */

if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

require_once __DIR__ . '/src/Autoloader.php';
\AgentMate\Connector\Autoloader::register(__DIR__ . '/src');

use AgentMate\Connector\Schema;
use AgentMate\Connector\Support\DataDir;
use AgentMate\Connector\Support\Options;

global $wpdb;

$agentmate_data_dir = null;
$agentmate_name = Options::get(DataDir::OPTION);
if (defined('AGENTMATE_CONNECTOR_DATA_DIR')) {
    $agentmate_data_dir = null; // A folder the owner picked is theirs to remove.
} elseif (is_string($agentmate_name) && preg_match(DataDir::NAME, $agentmate_name) === 1) {
    $agentmate_data_dir = WP_CONTENT_DIR . '/' . $agentmate_name;
}

foreach (Schema::TABLES as $agentmate_table) {
    // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared -- fixed table names from Schema, no input.
    $wpdb->query('DROP TABLE IF EXISTS ' . Schema::table($wpdb->base_prefix, $agentmate_table));
}

foreach (array('agentmate_connector_site_key', 'agentmate_connector_data_dir', 'agentmate_connector_db_version') as $agentmate_option) {
    Options::delete($agentmate_option);
}
\AgentMate\Connector\Guard\GuardInstaller::uninstall();
\AgentMate\Connector\Guard\GuardState::delete();
@unlink(__DIR__ . '/' . \AgentMate\Connector\Guard\Rescue::CONFIG); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged

if ($agentmate_data_dir !== null && is_dir($agentmate_data_dir) && !is_link($agentmate_data_dir)) {
    $agentmate_files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($agentmate_data_dir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($agentmate_files as $agentmate_file) {
        $agentmate_path = $agentmate_file->getPathname();
        if ($agentmate_file->isDir() && !$agentmate_file->isLink()) {
            @rmdir($agentmate_path); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.WP.AlternativeFunctions.file_system_operations_rmdir
        } else {
            @unlink($agentmate_path); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
        }
    }
    @rmdir($agentmate_data_dir); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.WP.AlternativeFunctions.file_system_operations_rmdir
}
