/* Pagecraft landing page: the only scripted behaviour is the small-screen menu. */

(function () {
  'use strict';

  var burger = document.getElementById('menu-button');
  var nav = document.getElementById('site-nav');
  if (!burger || !nav) return;

  function setOpen(open) {
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (open) nav.setAttribute('data-open', 'true');
    else nav.removeAttribute('data-open');
  }

  burger.addEventListener('click', function () {
    setOpen(burger.getAttribute('aria-expanded') !== 'true');
  });

  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      burger.focus();
    }
  });

  document.addEventListener('click', function (e) {
    if (burger.getAttribute('aria-expanded') !== 'true') return;
    if (!nav.contains(e.target) && !burger.contains(e.target)) setOpen(false);
  });
})();
