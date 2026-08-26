<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\RootTrust;
use RuntimeException;

final class RootTrustTest extends ConnectorTestCase
{
    public function test_a_root_signed_release_keyset_is_accepted(): void
    {
        $verified = RootTrust::verifyKeysetEnvelope(\pagecraft_test_keyset_envelope(), 'http://localhost:8787');
        $this->assertSame('pagecraft.keyset.v1', $verified['format']);
        $this->assertSame('release-unit-v1', $verified['keys'][0]['id']);
        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $verified['_fingerprint']);
    }

    public function test_tampering_with_a_keyset_signature_is_rejected(): void
    {
        $envelope = \pagecraft_test_keyset_envelope();
        $envelope['signature'] = str_repeat('A', 86);
        $this->expectException(RuntimeException::class);
        RootTrust::verifyKeysetEnvelope($envelope, 'http://localhost:8787');
    }
}
