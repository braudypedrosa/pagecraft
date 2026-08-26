<?php

declare(strict_types=1);

namespace Pagecraft\Connector\Tests;

use Pagecraft\Connector\Connection;
use Pagecraft\Connector\Forms;

final class FormsHtmlTest extends ConnectorTestCase
{
    public function test_wordpress_form_token_preserves_the_exact_signed_identifier(): void
    {
        $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = 'deployment-unit';
        $GLOBALS['pagecraft_test_active_release'] = ['manifest' => ['forms' => [[
            'id' => 'contact.form:1',
            'routePath' => '/contact/',
            'method' => 'POST',
            'fields' => [['name' => 'email', 'type' => 'email', 'required' => true, 'privacy' => 'email']],
        ]]]];
        $html = '<form action="%%PAGECRAFT_FORM_ENDPOINT:contact.form:1%%" method="POST" data-pagecraft-form-mode="wordpress"><input name="email"></form>';
        $prepared = (new Forms(new Connection()))->prepareHtml($html, '/contact/');

        $this->assertStringContainsString('/wp-json/pagecraft/v1/forms/contact.form%3A1', $prepared);
        $this->assertStringContainsString('name="pagecraft_form_id" value="contact.form:1"', $prepared);
        $this->assertStringContainsString('name="pagecraft_form_token"', $prepared);
        $this->assertStringContainsString('name="pagecraft_company"', $prepared);
    }

    public function test_external_form_markup_is_left_unchanged(): void
    {
        $html = '<form data-pagecraft-form="lead" data-pagecraft-form-mode="external" action="https://forms.example/lead" method="post"></form>';
        $this->assertSame($html, (new Forms(new Connection()))->prepareHtml($html, '/'));
    }

    public function test_unquoted_managed_action_and_method_are_replaced_once_with_local_transport(): void
    {
        $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = 'deployment-unit';
        $GLOBALS['pagecraft_test_active_release'] = ['manifest' => ['forms' => [[
            'id' => 'contact',
            'routePath' => '/contact/',
            'method' => 'POST',
            'fields' => [['name' => 'email', 'type' => 'email', 'required' => true, 'privacy' => 'email']],
        ]]]];
        $html = '<form action=%%PAGECRAFT_FORM_ENDPOINT:contact%% method=post data-pagecraft-form-mode=wordpress><input name=email></form>';

        $prepared = (new Forms(new Connection()))->prepareHtml($html, '/contact/');
        preg_match('/<form\b[^>]*>/i', $prepared, $opening);

        $this->assertSame(1, preg_match_all('/\saction\s*=/i', (string) ($opening[0] ?? '')));
        $this->assertSame(1, preg_match_all('/\smethod\s*=/i', (string) ($opening[0] ?? '')));
        $this->assertStringContainsString('/wp-json/pagecraft/v1/forms/contact', (string) ($opening[0] ?? ''));
        $this->assertStringContainsString('method="post"', (string) ($opening[0] ?? ''));
        $this->assertStringNotContainsString('%%PAGECRAFT_FORM_ENDPOINT:', $prepared);
        $this->assertMatchesRegularExpression('/name="pagecraft_form_token" value="[a-f0-9]{64}"/', $prepared);
        $this->assertStringContainsString('name="pagecraft_form_id" value="contact"', $prepared);
    }

    public function test_quoted_greater_than_in_form_attribute_is_preserved_without_truncating_transport_rewrite(): void
    {
        $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = 'deployment-unit';
        $GLOBALS['pagecraft_test_active_release'] = ['manifest' => ['forms' => [[
            'id' => 'contact',
            'routePath' => '/contact/',
            'method' => 'POST',
            'fields' => [['name' => 'email', 'type' => 'email', 'required' => true, 'privacy' => 'email']],
        ]]]];
        $html = '<form action="%%PAGECRAFT_FORM_ENDPOINT:contact%%" method=post aria-label="Contact > Sales" data-pagecraft-form-mode=wordpress><input name=email></form>';

        $prepared = (new Forms(new Connection()))->prepareHtml($html, '/contact/');
        $openingEnd = strpos($prepared, '><input type="hidden"');
        $opening = $openingEnd === false ? '' : substr($prepared, 0, $openingEnd + 1);

        $this->assertStringContainsString('aria-label="Contact > Sales"', $opening);
        $this->assertSame(1, preg_match_all('/\saction\s*=/i', $opening));
        $this->assertSame(1, preg_match_all('/\smethod\s*=/i', $opening));
        $this->assertStringContainsString('/wp-json/pagecraft/v1/forms/contact', $opening);
        $this->assertStringNotContainsString('%%PAGECRAFT_FORM_ENDPOINT:', $prepared);
        $this->assertStringContainsString('<input name=email></form>', $prepared);
    }

    public function test_form_lookalikes_in_comments_and_raw_text_are_not_rewritten(): void
    {
        $GLOBALS['pagecraft_test_options']['pagecraft_active_release_id'] = 'deployment-unit';
        $GLOBALS['pagecraft_test_active_release'] = ['manifest' => ['forms' => [[
            'id' => 'contact',
            'routePath' => '/contact/',
            'method' => 'POST',
            'fields' => [['name' => 'email', 'type' => 'email', 'required' => true, 'privacy' => 'email']],
        ]]]];
        $lookalike = '<form action=%%PAGECRAFT_FORM_ENDPOINT:contact%% method=post data-pagecraft-form-mode=wordpress>';
        $html = '<!-- ' . $lookalike . ' -->'
            . '<title>' . $lookalike . '</title>'
            . '<textarea>' . $lookalike . '</textarea>'
            . '<script type=application/json>{"example":"' . $lookalike . '"}</script>'
            . '<style>.example::after{content:"' . $lookalike . '"}</style>'
            . $lookalike . '<input name=email></form>';

        $prepared = (new Forms(new Connection()))->prepareHtml($html, '/contact/');

        $this->assertSame(5, substr_count($prepared, $lookalike));
        $this->assertSame(1, substr_count($prepared, '/wp-json/pagecraft/v1/forms/contact'));
        $this->assertSame(1, substr_count($prepared, 'name="pagecraft_form_token"'));
        $this->assertStringContainsString('<!-- ' . $lookalike . ' -->', $prepared);
        $this->assertStringContainsString('<textarea>' . $lookalike . '</textarea>', $prepared);
    }

    public function test_unsigned_managed_form_reference_is_left_inert(): void
    {
        $html = '<form action="%%PAGECRAFT_FORM_ENDPOINT:unknown%%" method="post" data-pagecraft-form-mode="wordpress"></form>';
        $this->assertSame($html, (new Forms(new Connection()))->prepareHtml($html, '/'));
    }
}
