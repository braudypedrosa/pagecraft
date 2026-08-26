<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\Connection;
use Pagecraft\Connector\Forms;
use ReflectionMethod;

final class FormsValidationTest extends ConnectorTestCase
{
    public function test_signed_fields_validate_and_privacy_email_is_explicit(): void
    {
        $result = $this->validate([
            'pagecraft_form_id' => 'contact',
            'pagecraft_route' => '/',
            'pagecraft_form_token' => 'token',
            'pagecraft_company' => '',
            'name' => 'Braudy',
            'email' => 'Braudy@example.com',
            'topic' => 'Support',
            'consent' => 'yes',
        ], $this->definition());

        $this->assertIsArray($result);
        $this->assertSame('braudy@example.com', $result['privacy_email']);
        $this->assertSame(['name', 'email', 'topic', 'consent'], array_keys($result['payload']));
    }

    /** @dataProvider invalidInputs */
    public function test_unknown_array_reserved_required_and_typed_values_are_rejected(array $input, string $code): void
    {
        $result = $this->validate($input, $this->definition());
        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame($code, $result->get_error_code());
    }

    /** @return iterable<string,array{array<string,mixed>,string}> */
    public static function invalidInputs(): iterable
    {
        $base = [
            'pagecraft_form_id' => 'contact',
            'pagecraft_route' => '/',
            'pagecraft_form_token' => 'token',
            'pagecraft_company' => '',
            'name' => 'Braudy',
            'email' => 'braudy@example.com',
            'topic' => 'Support',
            'consent' => 'yes',
        ];
        yield 'unknown' => [$base + ['surprise' => 'value'], 'pagecraft_form_unknown_field'];
        yield 'array' => [array_replace($base, ['name' => ['Braudy']]), 'pagecraft_form_array_field'];
        yield 'reserved' => [$base + ['action' => 'admin'], 'pagecraft_form_reserved_field'];
        yield 'required' => [array_replace($base, ['email' => '']), 'pagecraft_form_required'];
        yield 'email' => [array_replace($base, ['email' => 'not-email']), 'pagecraft_form_email'];
        yield 'select' => [array_replace($base, ['topic' => 'Unknown']), 'pagecraft_form_option'];
        yield 'checkbox' => [array_replace($base, ['consent' => 'maybe']), 'pagecraft_form_checkbox'];
        yield 'length' => [array_replace($base, ['name' => str_repeat('x', 2001)]), 'pagecraft_form_field_too_large'];
    }

    public function test_email_named_field_is_not_used_for_privacy_without_signed_marker(): void
    {
        $definition = $this->definition();
        unset($definition['fields'][1]['privacy']);
        $result = $this->validate([
            'name' => 'Braudy',
            'email' => 'braudy@example.com',
            'topic' => 'Sales',
            'consent' => 'yes',
        ], $definition);

        $this->assertIsArray($result);
        $this->assertSame('', $result['privacy_email']);
    }

    public function test_tel_and_number_fields_match_the_builder_contract(): void
    {
        $definition = ['fields' => [
            ['name' => 'phone', 'type' => 'tel', 'required' => true],
            ['name' => 'quantity', 'type' => 'number', 'required' => true],
        ]];
        $valid = $this->validate(['phone' => '+63 (917) 555-0123', 'quantity' => '12.5'], $definition);
        $this->assertIsArray($valid);
        $this->assertSame('+63 (917) 555-0123', $valid['payload']['phone']);
        $this->assertSame('12.5', $valid['payload']['quantity']);

        $badPhone = $this->validate(['phone' => 'call me', 'quantity' => '2'], $definition);
        $this->assertInstanceOf(\WP_Error::class, $badPhone);
        $this->assertSame('pagecraft_form_tel', $badPhone->get_error_code());

        $badNumber = $this->validate(['phone' => '+639175550123', 'quantity' => '12 apples'], $definition);
        $this->assertInstanceOf(\WP_Error::class, $badNumber);
        $this->assertSame('pagecraft_form_number', $badNumber->get_error_code());
        $this->assertIsArray(Forms::validateDefinitions([[
            'id' => 'quote', 'routePath' => '/', 'method' => 'POST', 'fields' => $definition['fields'],
        ]]));
    }

    public function test_stored_email_hash_comes_only_from_signed_privacy_marker(): void
    {
        $definition = [
            'id' => 'contact',
            'routePath' => '/',
            'method' => 'POST',
            'fields' => [['name' => 'email', 'type' => 'email', 'required' => true]],
        ];
        $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = 'deployment-unit';
        $GLOBALS['pagecraft_test_options']['admin_email'] = 'admin@example.com';
        $GLOBALS['pagecraft_test_active_release'] = ['manifest' => ['forms' => [$definition]]];
        $GLOBALS['wpdb']->routeBodies['deployment-unit|/'] = '<form data-pagecraft-form="contact"></form>';
        $forms = new Forms(new Connection());
        $prepared = $forms->prepareHtml('<form data-pagecraft-form="contact"><input name="email"></form>', '/');
        preg_match('/name="pagecraft_form_token" value="([a-f0-9]+)"/', $prepared, $token);

        $result = $forms->submit([
            'pagecraft_form_id' => 'contact',
            'pagecraft_route' => '/',
            'pagecraft_form_token' => (string) ($token[1] ?? ''),
            'pagecraft_company' => '',
            'email' => 'braudy@example.com',
        ], ['REMOTE_ADDR' => '127.0.0.1', 'HTTP_USER_AGENT' => 'PHPUnit']);

        $this->assertIsArray($result, is_wp_error($result) ? $result->get_error_message() : '');
        $this->assertNull($GLOBALS['wpdb']->formInserts[0]['email_hash']);

        pagecraft_test_reset_wordpress();
        $definition['fields'][0]['privacy'] = 'email';
        $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = 'deployment-unit';
        $GLOBALS['pagecraft_test_options']['admin_email'] = 'admin@example.com';
        $GLOBALS['pagecraft_test_active_release'] = ['manifest' => ['forms' => [$definition]]];
        $GLOBALS['wpdb']->routeBodies['deployment-unit|/'] = '<form data-pagecraft-form="contact"></form>';
        $forms = new Forms(new Connection());
        $prepared = $forms->prepareHtml('<form data-pagecraft-form="contact"><input name="email"></form>', '/');
        preg_match('/name="pagecraft_form_token" value="([a-f0-9]+)"/', $prepared, $token);

        $result = $forms->submit([
            'pagecraft_form_id' => 'contact',
            'pagecraft_route' => '/',
            'pagecraft_form_token' => (string) ($token[1] ?? ''),
            'pagecraft_company' => '',
            'email' => 'braudy@example.com',
        ], ['REMOTE_ADDR' => '127.0.0.1', 'HTTP_USER_AGENT' => 'PHPUnit']);

        $this->assertIsArray($result, is_wp_error($result) ? $result->get_error_message() : '');
        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', (string) $GLOBALS['wpdb']->formInserts[0]['email_hash']);
    }

    /** @dataProvider invalidDefinitionProvider */
    public function test_release_definition_validator_rejects_cross_runtime_contract_drift(array $definition, string $code): void
    {
        $result = Forms::validateDefinitions([$definition]);
        $this->assertInstanceOf(\WP_Error::class, $result);
        $this->assertSame($code, $result->get_error_code());
    }

    /** @return iterable<string,array{array<string,mixed>,string}> */
    public static function invalidDefinitionProvider(): iterable
    {
        $base = [
            'id' => 'contact', 'routePath' => '/', 'method' => 'POST',
            'fields' => [['name' => 'email', 'type' => 'email', 'required' => true, 'privacy' => 'email']],
        ];
        yield 'case insensitive reserved prefix' => [array_replace($base, [
            'fields' => [['name' => 'PageCraft_token', 'type' => 'text', 'required' => false]],
        ]), 'pagecraft_form_definition_field'];
        yield 'case insensitive duplicate field' => [array_replace($base, [
            'fields' => [
                ['name' => 'Email', 'type' => 'email', 'required' => false],
                ['name' => 'email', 'type' => 'email', 'required' => false],
            ],
        ]), 'pagecraft_form_definition_field'];
        yield 'non boolean required' => [array_replace($base, [
            'fields' => [['name' => 'email', 'type' => 'email', 'required' => 1]],
        ]), 'pagecraft_form_definition_field'];
        yield 'select without options' => [array_replace($base, [
            'fields' => [['name' => 'topic', 'type' => 'select', 'required' => false]],
        ]), 'pagecraft_form_definition_options'];
        yield 'duplicate option' => [array_replace($base, [
            'fields' => [['name' => 'topic', 'type' => 'select', 'required' => false, 'options' => ['Sales', 'Sales']]],
        ]), 'pagecraft_form_definition_options'];
        yield 'multiple privacy email fields' => [array_replace($base, [
            'fields' => [
                ['name' => 'email', 'type' => 'email', 'required' => false, 'privacy' => 'email'],
                ['name' => 'backup', 'type' => 'email', 'required' => false, 'privacy' => 'email'],
            ],
        ]), 'pagecraft_form_definition_field'];
        yield 'remote route' => [array_replace($base, ['routePath' => 'https://evil.example/']), 'pagecraft_form_definition'];
        yield 'non post method' => [array_replace($base, ['method' => 'GET']), 'pagecraft_form_definition'];
    }

    /** @param array<string,mixed> $input @param array<string,mixed> $definition */
    private function validate(array $input, array $definition): array|\WP_Error
    {
        return (new ReflectionMethod(Forms::class, 'validatePayload'))->invoke(new Forms(new Connection()), $input, $definition);
    }

    /** @return array<string,mixed> */
    private function definition(): array
    {
        return ['fields' => [
            ['name' => 'name', 'type' => 'text', 'required' => true],
            ['name' => 'email', 'type' => 'email', 'required' => true, 'privacy' => 'email'],
            ['name' => 'topic', 'type' => 'select', 'required' => true, 'options' => ['Sales', 'Support']],
            ['name' => 'consent', 'type' => 'checkbox', 'required' => true, 'options' => ['yes']],
        ]];
    }
}
