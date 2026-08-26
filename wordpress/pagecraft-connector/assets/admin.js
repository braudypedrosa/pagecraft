( function () {
	'use strict';

	document.addEventListener( 'submit', function ( event ) {
		var form = event.target;
		if ( ! form || ! form.matches || ! form.matches( 'form[data-pagecraft-confirm]' ) ) {
			return;
		}
		var message = form.getAttribute( 'data-pagecraft-confirm' );
		if ( message && ! window.confirm( message ) ) {
			event.preventDefault();
		}
	} );
}() );
