<?php
/**
 * One authenticated route. It runs only after the request's signature, nonce, scope and kill
 * switches have all checked out.
 *
 * @package AgentMate\Connector
 */

namespace AgentMate\Connector\Routes;

interface Handler
{
    public function handle(RequestContext $context): Result;
}
