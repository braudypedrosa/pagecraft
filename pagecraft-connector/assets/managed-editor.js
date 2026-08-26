( function () {
	'use strict';

	var config = window.pagecraftManagedEditor || {};

	function lockSaving() {
		if ( ! window.wp || ! wp.data ) {
			return;
		}
		var editor = wp.data.dispatch( 'core/editor' );
		if ( editor && editor.lockPostSaving ) {
			editor.lockPostSaving( 'pagecraft-managed-read-only' );
		}
		if ( editor && editor.lockPostAutosaving ) {
			editor.lockPostAutosaving( 'pagecraft-managed-read-only' );
		}
	}

	function removeEditorPanels() {
		if ( ! window.wp || ! wp.data ) {
			return;
		}
		var editPost = wp.data.dispatch( 'core/edit-post' );
		if ( ! editPost || ! editPost.removeEditorPanel ) {
			return;
		}
		[
			'featured-image',
			'discussion-panel',
			'page-attributes',
			'post-status',
			'post-link',
			'post-template'
		].forEach( function ( panel ) {
			editPost.removeEditorPanel( panel );
		} );
	}

	function disableControl( element ) {
		element.hidden = true;
		element.setAttribute( 'aria-hidden', 'true' );
		element.querySelectorAll( 'button, input, select, textarea, a' ).forEach( function ( control ) {
			control.setAttribute( 'tabindex', '-1' );
			control.setAttribute( 'aria-disabled', 'true' );
			if ( 'disabled' in control ) {
				control.disabled = true;
			}
		} );
	}

	function hideEditableAffordances( root ) {
		if ( ! root || ! root.querySelectorAll ) {
			return;
		}
		[
			'.editor-post-summary',
			'.editor-post-featured-image',
			'.editor-post-featured-image__container',
			'.editor-post-post-status',
			'.editor-post-status',
			'.editor-post-date',
			'.editor-post-schedule',
			'.edit-post-post-status',
			'.editor-post-permalink',
			'.editor-post-url',
			'.editor-post-link-control',
			'.editor-post-template',
			'.editor-post-discussion',
			'.editor-post-discussion-panel',
			'.editor-page-attributes',
			'.edit-post-page-attributes',
			'.edit-post-post-visibility',
			'.edit-post-post-schedule',
			'.editor-post-trash'
		].forEach( function ( selector ) {
			root.querySelectorAll( selector ).forEach( disableControl );
		} );

		var labels = Array.isArray( config.lockedLabels ) ? config.lockedLabels : [];
		root.querySelectorAll( '.editor-post-panel__row, .components-panel__body' ).forEach( function ( row ) {
			var text = ( row.textContent || '' ).trim().replace( /\s+/g, ' ' );
			if ( labels.some( function ( label ) {
				return text === label || text.indexOf( label + ' ' ) === 0;
			} ) ) {
				disableControl( row );
			}
		} );
	}

	function lockDocument( root ) {
		if ( ! root || ! root.querySelectorAll ) {
			return;
		}
		root.querySelectorAll( '.editor-post-title__input, .editor-post-title [contenteditable="true"], .editor-styles-wrapper [contenteditable="true"]' ).forEach( function ( element ) {
			element.setAttribute( 'contenteditable', 'false' );
			element.setAttribute( 'aria-readonly', 'true' );
			element.setAttribute( 'tabindex', '-1' );
		} );
		root.querySelectorAll( '.editor-post-publish-button, .editor-post-publish-panel__toggle, .editor-post-save-draft' ).forEach( function ( button ) {
			button.disabled = true;
			button.setAttribute( 'aria-disabled', 'true' );
		} );
		root.querySelectorAll( '[role="button"][aria-label*="featured image" i], [role="button"][aria-label*="permalink" i], button[aria-label*="publish" i], button[aria-label*="schedule" i]' ).forEach( disableControl );
		hideEditableAffordances( root );
	}

	function lockFrames() {
		document.querySelectorAll( 'iframe[name="editor-canvas"]' ).forEach( function ( frame ) {
			try {
				lockDocument( frame.contentDocument );
			} catch ( error ) {
				// WordPress editor frames are same-origin; fail closed server-side if unavailable.
			}
		} );
	}

	function showNotice() {
		if ( ! window.wp || ! wp.data || ! config.notice ) {
			return;
		}
		var notices = wp.data.dispatch( 'core/notices' );
		if ( ! notices || ! notices.createNotice ) {
			return;
		}
		var options = { id: 'pagecraft-managed-read-only', isDismissible: false };
		if ( config.editUrl ) {
			options.actions = [ { label: config.actionLabel || 'Edit in Pagecraft', url: config.editUrl } ];
		}
		notices.createNotice( 'info', config.notice, options );
	}

	function applyLock() {
		lockSaving();
		removeEditorPanels();
		lockDocument( document );
		lockFrames();
	}

	if ( window.wp && wp.domReady ) {
		wp.domReady( function () {
			applyLock();
			showNotice();
			new MutationObserver( applyLock ).observe( document.body, { childList: true, subtree: true } );
			window.setInterval( applyLock, 1000 );
		} );
	}
}() );
