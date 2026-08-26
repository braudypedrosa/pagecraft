<?php

declare(strict_types=1);

namespace Pagecraft\Builder;

final class PortablePagePackage
{
    public const FORMAT = 'pagecraft.page-package.v1';
    public const SCHEMA_VERSION = 13;
    public const MAX_ARCHIVE_BYTES = 314572800;
    public const MAX_FILES = 5000;
    public const MAX_PATH_BYTES = 240;
    public const MAX_FILE_BYTES = 104857600;
    public const MAX_EXPANDED_BYTES = 524288000;
    public const MAX_MANIFEST_BYTES = 2097152;
    public const MAX_DOCUMENT_BYTES = 52428800;

    /** @var array<string, \stdClass> */
    private array $records = [];
    private \ZipArchive $archive;
    private \stdClass $manifest;
    private \stdClass $document;
    private \stdClass $provenance;
    private \stdClass $dependencies;
    private string $archiveHash;
    private string $compiledPath;
    /** @var list<string> */
    private array $stylePaths = [];

    private function __construct()
    {
    }

    public static function fromFile(string $path): self
    {
        if (!class_exists(\ZipArchive::class)) {
            throw new PackageException('The PHP ZIP extension is required to import a Pagecraft package.');
        }
        if (!is_file($path) || !is_readable($path)) {
            throw new PackageException('The Pagecraft package could not be read.');
        }
        $archiveBytes = filesize($path);
        if ($archiveBytes === false || $archiveBytes < 22 || $archiveBytes > self::MAX_ARCHIVE_BYTES) {
            throw new PackageException('The Pagecraft package exceeds the archive-size limit or is incomplete.');
        }

        $package = new self();
        $package->archive = new \ZipArchive();
        $opened = $package->archive->open($path, \ZipArchive::RDONLY);
        if ($opened !== true) {
            throw new PackageException('The Pagecraft package is not a readable ZIP archive.');
        }
        $package->archiveHash = (string) hash_file('sha256', $path);
        $package->validateArchive();
        return $package;
    }

    public function __destruct()
    {
        if (isset($this->archive)) {
            $this->archive->close();
        }
    }

    public function manifest(): \stdClass
    {
        return $this->manifest;
    }

    public function document(): \stdClass
    {
        return $this->document;
    }

    public function documentJson(): string
    {
        return $this->readText('source/document.json');
    }

    public function page(): \stdClass
    {
        return $this->document->pages[0];
    }

    public function provenance(): \stdClass
    {
        return $this->provenance;
    }

    public function dependencies(): \stdClass
    {
        return $this->dependencies;
    }

    public function packageHash(): string
    {
        return $this->archiveHash;
    }

    public function compiledHtml(): string
    {
        return $this->readText($this->compiledPath);
    }

    public function compiledCss(): string
    {
        $parts = [];
        foreach ($this->stylePaths as $path) {
            $parts[] = $this->readText($path);
        }
        return implode("\n", array_filter($parts, static fn (string $part): bool => $part !== ''));
    }

    private function validateArchive(): void
    {
        if ($this->archive->numFiles < 2 || $this->archive->numFiles > self::MAX_FILES) {
            throw new PackageException('The Pagecraft package exceeds the file-count limit or is incomplete.');
        }

        $seen = [];
        $expanded = 0;
        for ($index = 0; $index < $this->archive->numFiles; $index++) {
            $stat = $this->archive->statIndex($index, \ZipArchive::FL_UNCHANGED);
            if (!is_array($stat) || !isset($stat['name'], $stat['size'], $stat['comp_size'], $stat['comp_method'])) {
                throw new PackageException('The Pagecraft package contains malformed ZIP metadata.');
            }
            $name = (string) $stat['name'];
            self::assertSafePath($name);
            $folded = strtolower($name);
            if (isset($seen[$folded])) {
                throw new PackageException('The Pagecraft package contains a duplicate path: ' . $name);
            }
            $seen[$folded] = true;
            $size = (int) $stat['size'];
            if ($size < 0 || $size > self::MAX_FILE_BYTES) {
                throw new PackageException('A Pagecraft package file exceeds the size limit: ' . $name);
            }
            $expanded += $size;
            if ($expanded > self::MAX_EXPANDED_BYTES) {
                throw new PackageException('The Pagecraft package exceeds the expanded-size limit.');
            }
            if (!in_array((int) $stat['comp_method'], [\ZipArchive::CM_STORE, \ZipArchive::CM_DEFLATE], true)) {
                throw new PackageException('The Pagecraft package uses unsupported ZIP compression.');
            }
            if (isset($stat['encryption_method']) && (int) $stat['encryption_method'] !== \ZipArchive::EM_NONE) {
                throw new PackageException('Encrypted Pagecraft package entries are not supported.');
            }
            if (method_exists($this->archive, 'getExternalAttributesIndex')) {
                $operations = 0;
                $attributes = 0;
                if ($this->archive->getExternalAttributesIndex($index, $operations, $attributes)
                    && $operations === \ZipArchive::OPSYS_UNIX
                    && (($attributes >> 16) & 0170000) === 0120000) {
                    throw new PackageException('Pagecraft packages cannot contain symbolic links.');
                }
            }
        }

        $manifestSource = $this->readText('manifest.json', self::MAX_MANIFEST_BYTES);
        $this->manifest = CanonicalJson::decodeObject($manifestSource, 'Pagecraft package manifest');
        $this->validateManifest();
    }

    private function validateManifest(): void
    {
        $manifest = $this->manifest;
        if (($manifest->format ?? null) !== self::FORMAT
            || ($manifest->kind ?? null) !== 'page'
            || ($manifest->packageVersion ?? null) !== 1) {
            throw new PackageException('This is not a supported Pagecraft page package.');
        }
        if (($manifest->schemaVersion ?? null) !== self::SCHEMA_VERSION
            || ($manifest->rendererVersion ?? null) !== 'pagecraft-core-' . self::SCHEMA_VERSION) {
            throw new PackageException(
                'This package requires a different Pagecraft schema or renderer. '
                . 'Open it in a current Pagecraft editor to migrate it before importing.'
            );
        }
        if (($manifest->documentPath ?? null) !== 'source/document.json'
            || ($manifest->provenancePath ?? null) !== 'source/provenance.json'
            || ($manifest->dependenciesPath ?? null) !== 'source/dependencies.json'
            || !isset($manifest->cms) || ($manifest->cms->policy ?? null) !== 'reject'
            || ($manifest->cms->flattened ?? null) !== false
            || !isset($manifest->files) || !is_array($manifest->files)) {
            throw new PackageException('The Pagecraft page manifest contract is invalid.');
        }
        if (count($manifest->files) + 1 !== $this->archive->numFiles) {
            throw new PackageException('The Pagecraft package contains unlisted or missing files.');
        }
        if (($manifest->contentHash ?? null) !== hash('sha256', CanonicalJson::encode($manifest->files))) {
            throw new PackageException('The Pagecraft package file manifest hash is invalid.');
        }

        $previous = null;
        $compiled = [];
        foreach ($manifest->files as $record) {
            if (!$record instanceof \stdClass || !$this->validFileRecord($record)) {
                throw new PackageException('The Pagecraft package contains an invalid file record.');
            }
            $path = (string) $record->path;
            if ($previous !== null && strcmp($previous, $path) >= 0) {
                throw new PackageException('The Pagecraft package file manifest is not deterministically ordered.');
            }
            $previous = $path;
            if (isset($this->records[strtolower($path)])) {
                throw new PackageException('The Pagecraft package file manifest repeats a path.');
            }
            $this->records[strtolower($path)] = $record;
            $this->verifyFile($record);
            if ($record->role === 'compiled-page') {
                $compiled[] = $path;
            } elseif ($record->role === 'style') {
                $this->stylePaths[] = $path;
            }
        }
        if (count($compiled) !== 1 || count($this->stylePaths) !== 1) {
            throw new PackageException('A Pagecraft page package must contain one compiled page and one page stylesheet.');
        }
        $this->compiledPath = $compiled[0];
        sort($this->stylePaths, SORT_STRING);

        $documentSource = $this->readText('source/document.json', self::MAX_DOCUMENT_BYTES);
        $this->document = CanonicalJson::decodeObject($documentSource, 'Pagecraft package document');
        $this->provenance = CanonicalJson::decodeObject(
            $this->readText('source/provenance.json'),
            'Pagecraft package provenance'
        );
        $this->dependencies = CanonicalJson::decodeObject(
            $this->readText('source/dependencies.json'),
            'Pagecraft package dependencies'
        );
        $this->validateSourceContracts();
    }

    private function validateSourceContracts(): void
    {
        if (($this->document->schemaVersion ?? null) !== self::SCHEMA_VERSION
            || !isset($this->document->meta) || !$this->document->meta instanceof \stdClass
            || !isset($this->document->header) || !is_array($this->document->header)
            || !isset($this->document->footer) || !is_array($this->document->footer)
            || !isset($this->document->pages) || !is_array($this->document->pages)
            || count($this->document->pages) !== 1 || !$this->document->pages[0] instanceof \stdClass
            || ($this->document->pages[0]->id ?? null) !== ($this->manifest->entryPageId ?? null)
            || !is_string($this->document->pages[0]->name ?? null)
            || !is_string($this->document->pages[0]->slug ?? null)
            || !isset($this->document->pages[0]->tree) || !is_array($this->document->pages[0]->tree)) {
            throw new PackageException('The Pagecraft page document does not match its manifest entry page.');
        }
        if (($this->provenance->format ?? null) !== 'pagecraft.provenance.v1'
            || !in_array(($this->provenance->origin ?? null), ['pagecraft-cloud', 'wordpress-local'], true)
            || !is_string($this->provenance->sourceId ?? null)
            || $this->provenance->sourceId === ''
            || !is_int($this->provenance->sourceVersion ?? null)
            || $this->provenance->sourceVersion < 0) {
            throw new PackageException('The Pagecraft package provenance is invalid.');
        }
        $cms = $this->dependencies->cms ?? null;
        if (($this->dependencies->format ?? null) !== 'pagecraft.dependencies.v1'
            || !$cms instanceof \stdClass || ($cms->policy ?? null) !== 'reject'
            || ($cms->collections ?? null) !== 0 || ($cms->boundNodes ?? null) !== 0
            || ($cms->collectionLists ?? null) !== 0 || ($cms->detailPages ?? null) !== 0) {
            throw new PackageException('Pagecraft CMS content must be flattened explicitly before WordPress import.');
        }
        $this->assertDocumentHasNoCms();
        $head = (string) (($this->document->meta->headHtml ?? '') ?: '');
        $pageHead = (string) (($this->document->pages[0]->headHtml ?? '') ?: '');
        if (preg_match('/<script\b|\bon[a-z0-9_-]+\s*=|javascript\s*:/i', $head . "\n" . $pageHead)) {
            throw new PackageException('Executable custom head code is not supported by the WordPress v1 importer.');
        }
    }

    private function assertDocumentHasNoCms(): void
    {
        $collections = $this->document->meta->collections ?? [];
        if (!is_array($collections) || count($collections) !== 0
            || !empty($this->document->pages[0]->collection)) {
            throw new PackageException('Pagecraft CMS content must be flattened explicitly before WordPress import.');
        }
        $trees = [$this->document->header, $this->document->footer, $this->document->pages[0]->tree];
        foreach (($this->document->meta->blocks ?? []) as $block) {
            if ($block instanceof \stdClass && isset($block->node)) {
                $trees[] = [$block->node];
            }
        }
        foreach (($this->document->meta->components ?? []) as $component) {
            if ($component instanceof \stdClass && isset($component->node)) {
                $trees[] = [$component->node];
            }
        }
        foreach ($trees as $tree) {
            if (!is_array($tree)) {
                throw new PackageException('The Pagecraft package document tree is malformed.');
            }
            foreach ($tree as $node) {
                if ($this->nodeUsesCms($node)) {
                    throw new PackageException('Pagecraft CMS content must be flattened explicitly before WordPress import.');
                }
            }
        }
    }

    private function nodeUsesCms(mixed $node): bool
    {
        if (!$node instanceof \stdClass) {
            throw new PackageException('The Pagecraft package document contains a malformed node.');
        }
        if (($node->type ?? null) === 'list') {
            return true;
        }
        if (isset($node->bind) && $node->bind instanceof \stdClass) {
            foreach (get_object_vars($node->bind) as $binding) {
                if ($binding instanceof \stdClass && ($binding->src ?? null) === 'field') {
                    return true;
                }
            }
        }
        $condition = $node->showIf ?? null;
        if ($condition instanceof \stdClass) {
            $conditionBinding = $condition->bind ?? null;
            if ($conditionBinding instanceof \stdClass && ($conditionBinding->src ?? null) === 'field') {
                return true;
            }
        }
        $children = $node->children ?? [];
        if (!is_array($children)) {
            throw new PackageException('The Pagecraft package document contains malformed node children.');
        }
        foreach ($children as $child) {
            if ($this->nodeUsesCms($child)) {
                return true;
            }
        }
        return false;
    }

    private function validFileRecord(\stdClass $record): bool
    {
        if (!is_string($record->path ?? null) || !is_string($record->role ?? null)
            || !is_string($record->mediaType ?? null) || !is_int($record->bytes ?? null)
            || $record->bytes < 0 || $record->bytes > self::MAX_FILE_BYTES
            || !is_string($record->sha256 ?? null) || !preg_match('/^[a-f0-9]{64}$/', $record->sha256)) {
            return false;
        }
        self::assertSafePath($record->path);
        $path = $record->path;
        $type = $record->mediaType;
        return match ($record->role) {
            'document' => $path === 'source/document.json' && $type === 'application/json',
            'provenance' => $path === 'source/provenance.json' && $type === 'application/json',
            'dependencies' => $path === 'source/dependencies.json' && $type === 'application/json',
            'compiled-page' => str_starts_with($path, 'compiled/') && str_ends_with(strtolower($path), '.html')
                && $type === 'text/html; charset=utf-8',
            'compiled-support' => in_array($path, ['compiled/robots.txt', 'compiled/sitemap.xml'], true)
                && in_array($type, ['text/plain; charset=utf-8', 'application/xml; charset=utf-8'], true),
            'style' => str_starts_with($path, 'styles/') && str_ends_with(strtolower($path), '.css')
                && $type === 'text/css; charset=utf-8',
            'preview' => str_starts_with($path, 'previews/') && str_ends_with(strtolower($path), '.html')
                && $type === 'text/html; charset=utf-8',
            'asset' => str_starts_with($path, 'assets/') && in_array($type, [
                'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml'
            ], true),
            default => false,
        };
    }

    private function verifyFile(\stdClass $record): void
    {
        $index = $this->archive->locateName($record->path, \ZipArchive::FL_UNCHANGED);
        if ($index === false) {
            throw new PackageException('The Pagecraft package is missing ' . $record->path . '.');
        }
        $stream = $this->archive->getStream($record->path);
        if (!is_resource($stream)) {
            throw new PackageException('The Pagecraft package could not read ' . $record->path . '.');
        }
        $hash = hash_init('sha256');
        $bytes = 0;
        while (!feof($stream)) {
            $chunk = fread($stream, 1048576);
            if ($chunk === false) {
                fclose($stream);
                throw new PackageException('The Pagecraft package could not verify ' . $record->path . '.');
            }
            $bytes += strlen($chunk);
            hash_update($hash, $chunk);
        }
        fclose($stream);
        if ($bytes !== $record->bytes || hash_final($hash) !== $record->sha256) {
            throw new PackageException('The Pagecraft package failed integrity verification for ' . $record->path . '.');
        }
    }

    private function readText(string $path, int $limit = self::MAX_FILE_BYTES): string
    {
        $index = $this->archive->locateName($path, \ZipArchive::FL_UNCHANGED);
        if ($index === false) {
            throw new PackageException('The Pagecraft package is missing ' . $path . '.');
        }
        $stat = $this->archive->statIndex($index, \ZipArchive::FL_UNCHANGED);
        if (!is_array($stat) || (int) ($stat['size'] ?? -1) > $limit) {
            throw new PackageException('The Pagecraft package file exceeds its text limit: ' . $path);
        }
        $source = $this->archive->getFromIndex($index, 0, \ZipArchive::FL_UNCHANGED);
        if (!is_string($source) || strlen($source) > $limit || preg_match('//u', $source) !== 1) {
            throw new PackageException('The Pagecraft package file is not bounded UTF-8 text: ' . $path);
        }
        return $source;
    }

    private static function assertSafePath(string $path): void
    {
        if ($path === '' || strlen($path) > self::MAX_PATH_BYTES || str_contains($path, "\0")
            || str_starts_with($path, '/') || str_ends_with($path, '/') || str_contains($path, '\\')) {
            throw new PackageException('The Pagecraft package contains an unsafe path.');
        }
        foreach (explode('/', $path) as $part) {
            if ($part === '' || $part === '.' || $part === '..') {
                throw new PackageException('The Pagecraft package contains path traversal.');
            }
        }
    }
}
