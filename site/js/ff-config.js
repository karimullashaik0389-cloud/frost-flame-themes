// Public website: where to load live menu and texts from.
// Leave LIVE_API_URL empty until the Apps Script web app is deployed.
// If it is empty, or the request fails, the built-in menu and texts are used and the page looks the same.
(function () {
  var LIVE_API_URL = 'https://script.google.com/macros/s/AKfycbyJa2WXlnkw7zCKjF5bnEm9oZEGVeX-MtrH_8dM2ViMhfGDyJye_4L4kM5fZbrrJn1S/exec';
  window.FF_API_URL = window.FF_API_URL || LIVE_API_URL;
})();
