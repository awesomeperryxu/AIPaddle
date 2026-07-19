// <l-icon name="bot" style="width:16px;height:16px;color:..."> — lucide icon web component
// Shadow-DOM 渲染：不触碰 light DOM，避免与 React 协调冲突（removeChild 错误）
(function () {
  var CDN = 'https://unpkg.com/lucide@0.294.0/dist/umd/lucide.min.js';
  var waiters = [];
  function ensure() {
    if (window.lucide || document.getElementById('lucide-umd')) return;
    var s = document.createElement('script');
    s.id = 'lucide-umd'; s.src = CDN;
    s.onload = function () { var w = waiters.slice(); waiters = []; w.forEach(function (f) { try { f(); } catch (e) {} }); };
    document.head.appendChild(s);
  }
  function ready(cb) {
    if (window.lucide) return cb();
    waiters.push(cb);
    ensure();
  }
  // 兜底轮询：script onload 竞态时 1s 内补触发
  var poll = setInterval(function () {
    if (window.lucide && waiters.length) { var w = waiters.slice(); waiters = []; w.forEach(function (f) { try { f(); } catch (e) {} }); }
    if (window.lucide && !waiters.length) clearInterval(poll);
  }, 200);
  function pascal(name) { return String(name).split('-').map(function (w) { return w ? w[0].toUpperCase() + w.slice(1) : ''; }).join(''); }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function buildSvg(node) {
    var svg = document.createElementNS(SVGNS, 'svg');
    var defs = { xmlns: 'http://www.w3.org/2000/svg', width: '24', height: '24', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    for (var k in defs) svg.setAttribute(k, defs[k]);
    (node || []).forEach(function (child) {
      if (!child || !child[0] || typeof child[0] !== 'string') return;
      var el = document.createElementNS(SVGNS, child[0]);
      var attrs = child[1] || {};
      for (var a in attrs) el.setAttribute(a, attrs[a]);
      svg.appendChild(el);
    });
    return svg;
  }
  function makeSvg(lu, name) {
    var icons = lu.icons || lu;
    var data = icons[pascal(name)];
    if (!data) return null;
    // 0.294: IconNode = [[tag, attrs], ...]；若为 ['svg', attrs, children] 三元组则交给 createElement
    if (Array.isArray(data) && typeof data[0] === 'string' && lu.createElement) {
      try {
        var el = lu.createElement(data);
        if (el && el.tagName) { el.setAttribute('width', '24'); el.setAttribute('height', '24'); return el; }
      } catch (e) {}
      return null;
    }
    try { return buildSvg(data); } catch (e) { return null; }
  }
  class LIcon extends HTMLElement {
    constructor() {
      super();
      var root = this.attachShadow({ mode: 'open' });
      var st = document.createElement('style');
      st.textContent = ':host{display:inline-flex;line-height:0;flex:none}span{display:inline-flex;width:100%;height:100%}svg{width:100%;height:100%;display:block}';
      root.appendChild(st);
      this._slot = document.createElement('span');
      root.appendChild(this._slot);
    }
    static get observedAttributes() { return ['name']; }
    connectedCallback() { this._render(); }
    attributeChangedCallback() { this._render(); }
    _render() {
      var name = this.getAttribute('name') || 'circle';
      if (this._name === name && this._done) return;
      this._name = name;
      this._done = false;
      var self = this;
      ready(function () {
        if (self._name !== name) return;
        var svg = null;
        try { svg = makeSvg(window.lucide, name); } catch (e) { console.error('licon:', e); }
        while (self._slot.firstChild) self._slot.removeChild(self._slot.firstChild);
        if (svg) self._slot.appendChild(svg);
        self._done = true;
      });
    }
  }
  if (!customElements.get('l-icon')) customElements.define('l-icon', LIcon);
})();
