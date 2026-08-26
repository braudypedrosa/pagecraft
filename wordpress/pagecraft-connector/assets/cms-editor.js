( function () {
	'use strict';

	var config = window.pagecraftCmsEditor || {};

	function disableControl( control ) {
		control.setAttribute( 'aria-disabled', 'true' );
		control.setAttribute( 'tabindex', '-1' );
		if ( 'disabled' in control ) {
			control.disabled = true;
		}
	}

	function lockSaving() {
		if ( ! window.wp || ! wp.data ) {
			return;
		}
		try {
			var editor = wp.data.dispatch( 'core/editor' );
			if ( editor && editor.lockPostSaving ) {
				editor.lockPostSaving( 'pagecraft-cms-staging-read-only' );
			}
			if ( editor && editor.lockPostAutosaving ) {
				editor.lockPostAutosaving( 'pagecraft-cms-staging-read-only' );
			}
		} catch ( error ) {
			// Classic editor screens do not register the block-editor store.
		}
	}

	function applyReadOnly() {
		if ( ! config.readOnly ) {
			return;
		}
		lockSaving();
		document.querySelectorAll( '.pagecraft-cms-field input, .pagecraft-cms-field select, .pagecraft-cms-field textarea, .pagecraft-cms-field button, #publish, #save-post, .editor-post-publish-button, .editor-post-publish-panel__toggle, .editor-post-save-draft' ).forEach( disableControl );
		document.querySelectorAll( '#submitdiv, #delete-action, #pagecraft_collectiondiv, #tagsdiv-pagecraft_collection' ).forEach( function ( element ) {
			element.hidden = true;
			element.setAttribute( 'aria-hidden', 'true' );
		} );
	}

	function applyManagedUi() {
		document.querySelectorAll( '#misc-publishing-actions, #delete-action, #pagecraft_collectiondiv, #tagsdiv-pagecraft_collection' ).forEach( function ( element ) {
			element.hidden = true;
			element.setAttribute( 'aria-hidden', 'true' );
		} );
		document.querySelectorAll( '#publish' ).forEach( function ( button ) {
			if ( ! config.readOnly ) {
				button.value = config.saveLabel || 'Save to Pagecraft draft';
				button.setAttribute( 'aria-label', config.saveAriaLabel || 'Save CMS values to the Pagecraft draft' );
			}
		} );
	}

	function showReadOnlyNotice() {
		if ( ! config.readOnly || ! config.notice || ! window.wp || ! wp.data ) {
			return;
		}
		try {
			var notices = wp.data.dispatch( 'core/notices' );
			if ( notices && notices.createNotice ) {
				notices.createNotice( 'info', config.notice, { id: 'pagecraft-cms-staging-read-only', isDismissible: false } );
			}
		} catch ( error ) {
			// The inline meta-box notice remains available in the classic editor.
		}
	}

	function targetSelect( button ) {
		var id = button.getAttribute( 'data-target' );
		return id ? document.getElementById( id ) : null;
	}

	document.addEventListener( 'click', function ( event ) {
		if ( config.readOnly ) {
			return;
		}
		var choose = event.target.closest( '.pagecraft-cms-media__choose' );
		if ( choose ) {
			event.preventDefault();
			var select = targetSelect( choose );
			if ( ! select || ! window.wp || ! wp.media ) {
				return;
			}
			var frame = wp.media( {
				title: choose.textContent.trim(),
				button: { text: choose.textContent.trim() },
				library: { type: 'image' },
				multiple: false
			} );
			frame.on( 'select', function () {
				var attachment = frame.state().get( 'selection' ).first();
				if ( ! attachment ) {
					return;
				}
				var media = attachment.toJSON();
				var value = 'wp-media:' + media.id;
				var option = Array.from( select.options ).find( function ( item ) {
					return item.value === value;
				} );
				if ( ! option ) {
					option = new Option( media.title || media.filename || ( 'WordPress media #' + media.id ), value );
					select.add( option );
				}
				select.value = value;
				select.dispatchEvent( new Event( 'change', { bubbles: true } ) );
			} );
			frame.open();
			return;
		}

		var clear = event.target.closest( '.pagecraft-cms-media__clear' );
		if ( clear ) {
			event.preventDefault();
			var clearSelect = targetSelect( clear );
			if ( clearSelect ) {
				clearSelect.value = '';
				clearSelect.dispatchEvent( new Event( 'change', { bubbles: true } ) );
				clearSelect.focus();
			}
		}
	} );

	var start = function () {
		applyManagedUi();
		if ( config.readOnly ) {
			applyReadOnly();
			showReadOnlyNotice();
		}
		new MutationObserver( function () {
			applyManagedUi();
			applyReadOnly();
		} ).observe( document.body, { childList: true, subtree: true } );
	};
	if ( window.wp && wp.domReady ) {
		wp.domReady( start );
	} else if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', start );
	} else {
		start();
	}
}() );
