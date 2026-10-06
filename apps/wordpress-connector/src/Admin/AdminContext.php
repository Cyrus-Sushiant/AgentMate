<?php
/**
 * Who is acting in wp-admin, and whether their form is genuine. WordPress answers in production;
 * tests answer with a fake.
 *
 * @package AgentMate\Connector
 */

namespace AgentMate\Connector\Admin;

interface AdminContext
{
    public function can(string $capability): bool;

    /** True when the posted nonce is valid for this action. */
    public function nonceOk(string $action): bool;

    public function userId(): int;

    public function ip(): string;

    public function multisite(): bool;
}
