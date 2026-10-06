<?php
/**
 * Answers routes this build of the connector does not serve yet, after full authentication.
 *
 * @package AgentMate\Connector
 */

namespace AgentMate\Connector\Routes;

use AgentMate\Connector\Http\ApiError;

final class NotYetHandler implements Handler
{
    public function handle(RequestContext $context): Result
    {
        throw new ApiError('badRequest', 'This version of AgentMate Connector does not handle ' . $context->route . ' yet.', array(), 501);
    }
}
