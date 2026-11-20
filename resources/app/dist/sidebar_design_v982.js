'use strict';
/**
 * Re-appends the sidebar overlay AFTER ui-health-patch.js injects its own
 * <style>, so the refined spacing/alignment wins without editing that engine.
 */
(function () {
  function apply() {
    fetch('/sidebar_design_v982.css')
      .then(function (r) { return r.text(); })
      .then(function (css) {
        if (document.getElementById('myraa-sidebar-design-v982')) return;
        var s = document.createElement('style');
        s.id = 'myraa-sidebar-design-v982';
        s.textContent = css;
        document.head.appendChild(s);
      })
      .catch(function () { /* the <link> in index.html remains as fallback */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
