<?php

declare(strict_types=1);

namespace Pagecraft\Builder;

final class EditorConflict extends \RuntimeException
{
    public function __construct(public readonly int $mine, public readonly int $theirs)
    {
        parent::__construct('This Pagecraft page changed in another session. Reload before saving again.');
    }
}
