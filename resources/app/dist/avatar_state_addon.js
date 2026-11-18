(function () {
  'use strict';
  // Phase 13: read the REAL avatar state from the backend and expose it as a
  // DOM data attribute + CustomEvent. No 3D model/mesh/animation is modified.
  var last = '';
  function publish(data) {
    if (!data || !data.state || data.state === last) return;
    last = data.state;
    document.body.dataset.myraaState = data.state;
    document.body.setAttribute('data-myraa-state-source', data.source || 'runtime');
    try {
      document.dispatchEvent(new CustomEvent('myraa:avatar-state', { detail: data }));
    } catch (e) {}
  }
  async function poll() {
    try {
      var r = await fetch('/api/avatar/state', { cache: 'no-store' });
      if (r.ok) publish(await r.json());
    } catch (e) {}
  }
  setInterval(poll, 1500);
  poll();
})();
