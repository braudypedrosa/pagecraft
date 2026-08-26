<?php

declare(strict_types=1);

namespace Pagecraft\Builder;

final class PageImportResult
{
    public function __construct(
        public readonly int $postId,
        public readonly bool $replaced,
        public readonly ?int $revisionId
    ) {
    }
}
