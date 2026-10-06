<?php
/**
 * Puts the guard into the mu-plugins folder, with the connector's folder written into it, and
 * takes it out again on deactivation.
 *
 * @package AgentMate\Connector
 */

namespace AgentMate\Connector\Guard;

final class GuardInstaller
{
    const FILE = '00-agentmate-connector-guard.php';
    const PLACEHOLDER = "\$agentmate_connector_dir = '';";
    const MARKER = 'Plugin Name: AgentMate Connector Guard';

    public static function path(): string
    {
        return rtrim(WPMU_PLUGIN_DIR, '/\\') . '/' . self::FILE;
    }

    /** The guard's source with this connector's folder filled in. */
    public static function render(string $pluginDir): string
    {
        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- the plugin's own template.
        $template = (string) file_get_contents($pluginDir . '/guard/' . self::FILE);
        $line = '$agentmate_connector_dir = ' . var_export(rtrim($pluginDir, '/\\'), true) . ';';
        return str_replace(self::PLACEHOLDER, $line, $template);
    }

    public static function isCurrent(string $pluginDir): bool
    {
        $path = self::path();
        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
        return is_file($path) && file_get_contents($path) === self::render($pluginDir);
    }

    /** Writes the guard when it is missing or out of date. False when mu-plugins is not writable. */
    public static function install(string $pluginDir): bool
    {
        if (!is_file($pluginDir . '/guard/' . self::FILE)) {
            return false;
        }
        if (self::isCurrent($pluginDir)) {
            return true;
        }
        $dir = rtrim(WPMU_PLUGIN_DIR, '/\\');
        if (!is_dir($dir) && !wp_mkdir_p($dir)) {
            return false;
        }
        $path = self::path();
        if (is_file($path) && strpos((string) file_get_contents($path), self::MARKER) === false) { // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
            // Someone else's file under our name; leave it alone.
            return false;
        }
        $temp = $path . '.' . bin2hex(random_bytes(4)) . '.tmp';
        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
        if (file_put_contents($temp, self::render($pluginDir)) === false) {
            return false;
        }
        // phpcs:ignore WordPress.WP.AlternativeFunctions.rename_rename
        if (!@rename($temp, $path)) { // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
            @unlink($path); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
            // phpcs:ignore WordPress.WP.AlternativeFunctions.rename_rename
            if (!@rename($temp, $path)) { // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
                @unlink($temp); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
                return false;
            }
        }
        return true;
    }

    public static function uninstall(): void
    {
        $path = self::path();
        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
        if (is_file($path) && strpos((string) file_get_contents($path), self::MARKER) !== false) {
            @unlink($path); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
        }
    }
}
