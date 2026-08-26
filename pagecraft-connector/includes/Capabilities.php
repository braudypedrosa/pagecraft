<?php

declare(strict_types=1);

namespace Pagecraft\Connector;

final class Capabilities
{
    public const VIEW = 'pagecraft_view_status';
    public const SYNC = 'pagecraft_sync';
    public const MANAGE = 'pagecraft_manage_connection';
    public const ROLLBACK = 'pagecraft_rollback';
    public const APPROVE_SCRIPTS = 'pagecraft_approve_scripts';

    /** @var list<string> */
    public const ALL = [self::VIEW, self::SYNC, self::MANAGE, self::ROLLBACK, self::APPROVE_SCRIPTS];

    public static function install(): void
    {
        $admin = get_role('administrator');
        if (!$admin) {
            return;
        }
        foreach (self::ALL as $capability) {
            $admin->add_cap($capability);
        }
    }
}
