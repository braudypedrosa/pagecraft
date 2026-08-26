<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\Support;

final class RequestRouteTest extends ConnectorTestCase
{
    public function test_root_install_normalizes_request_path_and_query(): void
    {
        $GLOBALS['pagecraft_test_home'] = 'https://wp.example';

        $this->assertSame('/about/', Support::requestRoute('/about/?preview=1'));
        $this->assertSame('/', Support::requestRoute('/?query=1'));
    }

    public function test_subdirectory_install_strips_only_the_exact_home_path_boundary(): void
    {
        $GLOBALS['pagecraft_test_home'] = 'https://wp.example/subdir';

        $this->assertSame('/about/', Support::requestRoute('/subdir/about/?preview=1'));
        $this->assertSame('/', Support::requestRoute('/subdir/'));
        $this->assertSame('/subdirectory/about/', Support::requestRoute('/subdirectory/about/'));
        $this->assertSame('/subdirish/', Support::requestRoute('/subdirish/'));
    }
}
