<?php
/**
 * Route => handler maps, built the same way for the plugin, the guard, rescue.php and the tests.
 *
 * @package AgentMate\Connector
 */

namespace AgentMate\Connector\Routes;

use AgentMate\Connector\Audit\AuditLog;
use AgentMate\Connector\Deploy\DeployService;
use AgentMate\Connector\Env\Environment;
use AgentMate\Connector\Files\AtomicWriter;
use AgentMate\Connector\Storage\Storage;
use AgentMate\Connector\Update\ConnectorUpdater;

final class Handlers
{
    /**
     * Every route the plugin serves.
     *
     * @param callable|null $rename how the connector update moves folders; tests make it fail
     * @return array<string, Handler>
     */
    public static function all(Storage $storage, Environment $env, ?AtomicWriter $writer = null, ?callable $rename = null): array
    {
        $audit = new AuditLog($storage);
        $read = new ReadHandlers($storage, $env, $audit);
        $service = new DeployService($storage, $env, $audit, $writer);
        $deploy = new DeployHandlers($service);
        $update = new UpdateHandlers(new ConnectorUpdater($env, $audit, $service, $rename));
        $map = array();
        foreach (ReadHandlers::routes() as $route) {
            $map[$route] = $read;
        }
        foreach (DeployHandlers::routes() as $route) {
            $map[$route] = $deploy;
        }
        foreach (UpdateHandlers::routes() as $route) {
            $map[$route] = $update;
        }
        return $map;
    }

    /**
     * Only /rescue/status and /rescue/rollback, for the guard and rescue.php.
     *
     * @return array<string, Handler>
     */
    public static function rescue(Storage $storage, Environment $env): array
    {
        $deploy = new DeployHandlers(new DeployService($storage, $env, new AuditLog($storage)));
        $map = array();
        foreach (DeployHandlers::rescueRoutes() as $route) {
            $map[$route] = $deploy;
        }
        return $map;
    }
}
