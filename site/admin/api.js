(function (global) {
  function apiUrl() { return String(global.FF_API_URL || '').replace(/\/$/, ''); }
  function ready() { return !!apiUrl(); }
  function call(payload) {
    var url = apiUrl();
    if (!url) return Promise.reject(new Error('API not configured'));
    return fetch(url, {
      method: 'POST',
      // text/plain avoids a CORS preflight with Apps Script
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload || {})
    }).then(function (r) {
      return r.text().then(function (t) {
        var data;
        try { data = JSON.parse(t); } catch (e) { throw new Error('Bad API response'); }
        if (data && data.ok === false) {
          var err = new Error(data.message || data.error || 'Request failed');
          err.code = data.error; err.data = data;
          throw err;
        }
        return data;
      });
    });
  }
  global.FFApi = { ready: ready, call: call, url: apiUrl };
})(window);
