# Image15 native acceptance matrix

This is a finite next-slice plan for the standalone Image module on canonical Main at `2451da8b0cea3594ca8a12bf0413854d7b6f5f41` (Image descriptor and control sources verified unchanged from `fbb5f50`). The source descriptor list is `app/src/core/index.ts:766-800`. The current inventory still leaves Image source lifecycle, intrinsic dimensions, Fit and Filter branches, decorative linked labels, lazy attributes, and saved WordPress controls open. Existing image records are historical partial evidence and do not count as Image15 acceptance until the actions below are replayed against the current Cloud and WordPress environments.

## Case A: source lifecycle and content semantics

Use a page with one standalone Image and a known uploaded asset. In the Image source control, exercise: upload through the dropzone (`.imgdrop[aria-label="Upload an image"]`), replace through the existing source button (`button[title="Replace image"]`), choose a different asset through `button[title="Pick from the Media library"]`, remove through `button[title="Remove image"]`, and clear a deliberately missing `asset:<id>` reference through `button[title="Clear"]`. Capture the saved value, reload result, and rendered image after each save/reload in Cloud and WordPress.

Set and verify Alt text, Caption, Link, Decorative image, Link label, and Intrinsic size using their visible field labels. Expected results:

- upload and library selection store an `asset:<id>` source and replacement changes the rendered asset; remove clears it; a missing reference shows `Not in this project` and Clear, then replacement recovers it;
- a sourced non-decorative image with empty Alt produces the existing no-alt review finding; a decorative image renders `alt=""` and suppresses the Alt requirement;
- when Decorative is on and Link is present, Link label appears and renders as the link `aria-label`; when either condition is absent, the conditional field is absent;
- Caption renders a figure caption, Link wraps the image, and saved metadata survives reload;
- selecting an asset fills the intrinsic width and height once; verify rendered `width` and `height` attributes and the no-dimensions review state. Exercise the current Intrinsic size composite as exposed. Do not assume a separate Detect button unless the live control exposes one.

Toggle Lazy load off and on and verify the saved value and public HTML. On the public render, on produces `loading="lazy" decoding="async"`; off omits those attributes. Record the hero warning if this image is the first sourced image in the opening section.

## Case B: finite responsive style matrix

With the same sourced image, cover all finite choices and representative numeric boundaries. Use visible controls Width, Height, Fit, Alignment, Radius, Opacity, and Filter. Use the actual device controls `#devSeg button[data-dev="desktop"]`, `#devSeg button[data-dev="tablet"]`, and `#devSeg button[data-dev="mobile"]`; capture the field status and rendered output at desktop, tablet, and mobile widths.

- Fit: Cover `cover`, Contain `contain`, Fill `fill`, None `none`.
- Alignment: start `flex-start`, center `center`, end `flex-end`, stretch `stretch`.
- Width and Height: one explicit value with a supported unit, then clear the tablet/mobile override and verify inherited desktop values. Radius and Opacity should cover an ordinary value plus the endpoints needed by the control, 0 and 1 for opacity.
- Filter: Default `''`, None `none`, Greyscale `grayscale(1)`, Richer `saturate(1.25)`, More contrast `contrast(1.1)`, Blurred `blur(6px)`, Darker `brightness(.85)`.

For every branch, save in Cloud and WordPress, reload, and verify the value, responsive inherited/override status, computed style, and rendered screenshot at the affected device width. Clear one override and verify fallback to the desktop value. The source marks these style controls responsive. Source, Alt, Decorative, Link label, Intrinsic size, Caption, Link, and Lazy load are nonresponsive and should be checked once per saved document, not treated as device-specific controls.

## Case C: restoration and public-output receipts

Restore the final fixture to a valid sourced, non-decorative image with descriptive Alt, known dimensions, Fit Cover, Filter Default, Lazy off, and no stale Link label. Save and reload both environments. Capture: editor field values, public HTML attributes (`src`, `alt`, dimensions, lazy attributes, link `aria-label` when applicable), computed Fit/Filter/opacity/size/alignment, and the review result. Keep the Cloud and WordPress receipts separate so a Cloud pass does not promote WordPress coverage.

## Supported controls and limits

The finite set above comes directly from the descriptors and `FILTERS` in `app/src/core/index.ts:419-426`. Do not test or report arbitrary filter strings, responsive Lazy load, or responsive source/content fields. The renderer placeholder for an empty source is current behavior (`app/src/core/index.ts:9013-9036`), while the inspector's missing-source state and lifecycle buttons are in `app/src/ui/inspector/Controls.tsx:662-737`. The matrix requires actual save, reload, rendered output, and restoration receipts in both environments. Source descriptors, existing screenshots, and Gallery evidence alone are insufficient acceptance proof.
