#!/usr/bin/env python3
"""Regenerate the repo-root index.html (served at https://frostandflamee.com/)
from site/index.html. The website's files stay in site/; the root copy only adds
<base href="/site/"> so every relative path (css, js, img, video, data) still
loads from site/, plus a tiny shim so in-page '#' links and '#item-…' history
entries stay on '/' instead of jumping to /site/.
Run after every edit to site/index.html:  python3 site/make-root-index.py
"""
import os
here = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(here, 'index.html'), encoding='utf-8').read()
anchor = '  <meta charset="utf-8">'
assert src.count(anchor) == 1
shim = ('<script>(function(){var H=history;["pushState","replaceState"].forEach(function(n){var o=H[n];if(!o)return;'
        'H[n]=function(s,t,u){if(typeof u==="string"&&u.charAt(0)==="#")u=location.pathname+location.search+u;return o.call(H,s,t,u);};});'
        'document.addEventListener("click",function(e){if(e.defaultPrevented||e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;'
        'var a=e.target&&e.target.closest&&e.target.closest("a[href^=\'#\']");if(!a||a.target)return;var h=a.getAttribute("href");'
        'e.preventDefault();if(h==="#"||h==="#top"&&!document.getElementById("top")){window.scrollTo(0,0);return;}location.hash=h;});})();</script>')
out = src.replace(anchor, anchor + '\n  <base href="/site/">\n  ' + shim, 1)
out = out.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n<!-- GENERATED from site/index.html by site/make-root-index.py. Edit site/index.html, then re-run the script. -->', 1)
open(os.path.join(here, '..', 'index.html'), 'w', encoding='utf-8').write(out)
print('wrote index.html')
