# Divider and Spacer bounded native checks

All authoring used the native builder at http://localhost:4995/edit/s1. No source change was needed. Divider Solid/Dashed/Dotted, colour, width and thickness passed. All five width units and both thickness units rendered their authored values. Desktop, Tablet and Mobile values stayed independent. Mobile clear inherited Tablet values; zero width and thickness rendered zero.

Spacer insertion on Mobile retained Desktop48/Tablet48/Mobile32 defaults. All five height units rendered. Authored Desktop80/Tablet40/Mobile20, Mobile clear to40, zero height, duplicate/Undo/Redo/Delete and public preview passed. Redo clears selection, so the clone was selected again before deletion. Both modules retained values after reload. No page horizontal overflow at any breakpoint.

These are local direct-control checks. Cloud and WordPress host parity, shared Advanced/Style combinations, Motion, physical devices and all broader QA areas remain open. See JSON receipts and mobile-final.png.
