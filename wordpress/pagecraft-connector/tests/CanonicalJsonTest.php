<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\CanonicalJson;
use RuntimeException;

final class CanonicalJsonTest extends ConnectorTestCase
{
    public function test_objects_are_sorted_and_strings_remain_utf8(): void
    {
        $this->assertSame(
            '{"a":[true,null,"café"],"z":1}',
            CanonicalJson::encode(['z' => 1, 'a' => [true, null, 'café']])
        );
    }

    public function test_alternative_serialization_is_rejected(): void
    {
        $this->expectException(RuntimeException::class);
        CanonicalJson::decode('{"z":1, "a":2}');
    }

    public function test_floating_point_numbers_are_rejected(): void
    {
        $this->expectException(RuntimeException::class);
        CanonicalJson::encode(['notDeterministicAcrossRuntimes' => 1.5]);
    }
}
