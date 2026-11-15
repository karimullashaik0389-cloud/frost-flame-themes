// Frost & Flame website admin. On localhost the app talks to the local mock at /api.
// Anywhere else it uses LIVE_API_URL. Leave it empty until the Apps Script web app is deployed.
// The public website then keeps using its built-in menu and texts.
(function () {
  var LIVE_API_URL = 'https://script.google.com/macros/s/AKfycbyJa2WXlnkw7zCKjF5bnEm9oZEGVeX-MtrH_8dM2ViMhfGDyJye_4L4kM5fZbrrJn1S/exec';
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  window.FF_API_URL = local ? '/api' : LIVE_API_URL;
})();
