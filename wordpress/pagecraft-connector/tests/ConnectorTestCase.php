<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use PHPUnit\Framework\TestCase;

abstract class ConnectorTestCase extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        \pagecraft_test_reset_wordpress();
    }
}
