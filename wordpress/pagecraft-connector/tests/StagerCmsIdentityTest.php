<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\Stager;
use ReflectionMethod;

final class StagerCmsIdentityTest extends ConnectorTestCase
{
    public function test_cms_item_ids_are_site_global_across_collections(): void
    {
        $method = new ReflectionMethod(Stager::class, 'validateCmsIdentities');
        $result = $method->invoke(new Stager(), ['collections' => [
            ['collectionId' => 'posts', 'items' => [['itemId' => 'shared-item']]],
            ['collectionId' => 'authors', 'items' => [['itemId' => 'shared-item']]],
        ]]);

        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame('pagecraft_artifact_cms_item_duplicate', $result->get_error_code());
    }

    public function test_distinct_site_global_item_ids_are_accepted(): void
    {
        $method = new ReflectionMethod(Stager::class, 'validateCmsIdentities');
        $result = $method->invoke(new Stager(), ['collections' => [
            ['collectionId' => 'posts', 'items' => [['itemId' => 'post-one']]],
            ['collectionId' => 'authors', 'items' => [['itemId' => 'author-one']]],
        ]]);

        $this->assertTrue($result);
    }
}
