// Occupancy layers: who used a building, and when (see ../layers/SCHEMA.md).
//
// The pipeline's layers.json + layers.bin give every building a list of items (an occupant
// with a category, role and years). This module turns the current selection — categories,
// tags, and the timeline year — into one colour per building, written to storage slot 2
// (-1 = no matching occupant, else a palette index), and keeps the user's own marks in
// IndexedDB so they show up next to the generated ones and can be exported as a layer file.
//
// Two backends, same model: with the API server (`api` crate) everything — generated layers,
// other providers, marks — comes merged from /api/v1 and marks are stored on the server; on a
// plain static host the files are read directly and marks stay in this browser (IndexedDB).

import { dataUrl, fetchBin } from './dataurl.js';

export const LAYER_PALETTE_OFFSET = 48;   // palette entries 48.. are layer categories (64 max)
const MAX_BITS = 64;
const USER_COLORS = ['#e4572e', '#17bebb', '#ffc914', '#76b041', '#8e44ad', '#2e86de', '#ff6f91', '#6c5b7b'];

// WGS84 metres per degree, as the pipeline's geom.rs
function metresPerDegree(lat) {
  const p = lat * Math.PI / 180;
  return [111412.84 * Math.cos(p) - 93.5 * Math.cos(3 * p),
    111132.954 - 559.822 * Math.cos(2 * p) + 1.175 * Math.cos(4 * p)];
}

export class Layers {
  /**
   * @param {object} o
   *   city, dir (data dir), count (buildings), origin {lon, lat},
   *   onChange(colors: Float32Array) — upload slot 2,
   *   onPalette(entries: [index, hex][]) — set palette colours,
   *   api — base URL of the API (e.g. '/api/v1') or null for static files
   */
  constructor(o) {
    Object.assign(this, o);
    this.loaded = false;
    this.layers = [];        // [{id, name, licence, publishable, user?, categories: [{id, name, color, parent, bit}]}]
    this.items = [];         // [{layer, cat, name, role, from, to, url, note, wikidata, source, tags, user?}]
    this.linkStart = null;   // CSR building -> items (generated)
    this.link = null;
    this.userLinks = new Map();   // gid -> [item index]
    this.withItems = [];     // gids that have any item
    this.enabled = new Set();     // enabled category bits
    this.tagFilter = new Set();   // empty = all tags
    this.year = Infinity;    // timeline year; Infinity = today
    this.colors = new Float32Array(Math.max(1, this.count)).fill(-1);
    const [mx, mz] = metresPerDegree(this.origin.lat);
    this.mx = mx; this.mz = mz;
  }

  // ---------- loading ----------
  async load() {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      if (this.api) { await this._loadApi(); this._listen(); }
      else {
        const [j, bin] = await Promise.all([
          fetch(dataUrl(this.dir + 'layers.json')).then(r => r.ok ? r.json() : null).catch(() => null),
          fetchBin(dataUrl(this.dir + 'layers.bin')).catch(() => null),
        ]);
        if (j && bin) this._ingest(j, bin);
        await this._loadMarks();
      }
      this._index();
      this.loaded = true;
      // start with every top-level category of the first layer on
      const first = this.layers.find(l => l.categories.length);
      if (first) for (const c of first.categories) if (!c.parent && !c.off && c.id !== 'school') this.enabled.add(c.bit);
      this.recolor();
    })();
    return this.loading;
  }

  // ---------- API backend ----------
  get cityUrl() { return `${this.api}/cities/${this.city}`; }
  async _apiJson(path, opt = {}) {
    const headers = { 'content-type': 'application/json' };
    const who = localStorage.getItem('marks.author'), tok = localStorage.getItem('marks.token');
    if (who) headers['x-author'] = who;
    if (tok) headers.authorization = `Bearer ${tok}`;
    const r = await fetch(this.cityUrl + path, { ...opt, headers });
    if (r.status === 401 && opt.method && !opt._retried) {
      // this server wants a token for writes: ask once, remember it
      const t = prompt('This map needs a token to save marks:');
      if (t) { localStorage.setItem('marks.token', t.trim()); return this._apiJson(path, { ...opt, _retried: true }); }
    }
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `${r.status} ${path}`);
    return r.status === 204 ? null : r.json();
  }
  /** Live updates: another tab or person changed this city's layers. */
  _listen() {
    if (this._es || typeof EventSource === 'undefined') return;
    this._es = new EventSource(this.cityUrl + '/events');
    this._es.addEventListener('layers', () => {
      clearTimeout(this._et);
      this._et = setTimeout(() => this._reloadApi().then(() => this.onReload?.()).catch(e => console.warn('layers reload', e)), 150);
    });
  }
  /** Merged layers (+ every item) and the building -> item CSR, from the server. */
  async _loadApi() {
    const [j, bin] = await Promise.all([
      this._apiJson('/layers'),
      fetch(this.cityUrl + '/layers/links.bin').then(r => { if (!r.ok) throw new Error('links.bin'); return r.arrayBuffer(); }),
    ]);
    const col = Object.fromEntries(j.itemColumns.map((k, i) => [k, i]));
    this.providers = j.providers;
    this.layers = j.layers.map(l => ({ ...l, user: l.id === 'mine', categories: l.categories.map(c => ({ ...c })) }));
    this.items = j.items.map(r => {
      const id = r[col.id];
      return {
        id, layer: r[col.layer], cat: r[col.category], name: r[col.name], role: r[col.role],
        from: r[col.from], to: r[col.to], url: r[col.url], note: r[col.note], wikidata: r[col.wikidata],
        source: r[col.source], tags: r[col.tags] || [], user: id.startsWith('mark:'), markId: id,
      };
    });
    if (String.fromCharCode(...new Uint8Array(bin, 0, 4)) !== 'SFL3') throw new Error('links.bin: not SFL3');
    const dv = new DataView(bin), nB = dv.getUint32(4, true), nL = dv.getUint32(8, true);
    this.linkStart = new Uint32Array(bin, 12, nB + 1);
    this.link = new Uint32Array(bin, 12 + (nB + 1) * 4, nL);
    this.nB = nB;
    this.userLinks = new Map();
  }
  async _reloadApi() {
    await this._loadApi();
    this._index(); this.recolor();
  }

  _ingest(j, bin) {
    const col = Object.fromEntries((j.itemColumns || []).map((k, i) => [k, i]));
    this.sources = j.sources || [];
    this.layers = j.layers.map(l => ({ ...l, categories: l.categories.map(c => ({ ...c })) }));
    this.items = j.items.map(r => ({
      layer: r[col.layer], cat: r[col.category], name: r[col.name], role: r[col.role],
      from: r[col.from], to: r[col.to], url: r[col.url], note: r[col.note], wikidata: r[col.wikidata],
      source: this.sources[r[col.source]] ?? '', tags: r[col.tags] || [],
    }));
    const dv = new DataView(bin);
    const magic = String.fromCharCode(...new Uint8Array(bin, 0, 4));
    if (magic !== 'SFL2') throw new Error(`layers.bin: bad magic ${magic}`);
    const nB = dv.getUint32(4, true), nL = dv.getUint32(8, true);
    let o = 12 + nB * 8;   // skip the masks: colours come from the items
    this.linkStart = new Uint32Array(bin, o, nB + 1); o += (nB + 1) * 4;
    this.link = new Uint32Array(bin, o, nL);
    this.nB = nB;
  }

  _index() {
    const seen = new Uint8Array(Math.max(1, this.count));
    const out = [];
    if (this.linkStart) {
      for (let g = 0; g < this.nB; g++) if (this.linkStart[g + 1] > this.linkStart[g]) { seen[g] = 1; out.push(g); }
    }
    for (const g of this.userLinks.keys()) if (g < this.count && !seen[g]) { seen[g] = 1; out.push(g); }
    this.withItems = out;
    // category counts (buildings)
    for (const l of this.layers) for (const c of l.categories) c.n = 0;
    const tagN = new Map();
    for (const g of out) {
      const hit = new Set();
      for (const k of this.itemsOf(g)) {
        const it = this.items[k], c = this.cat(it);
        if (!c) continue;
        hit.add(c); const p = this.parentOf(it); if (p) hit.add(p);
        for (const t of it.tags) tagN.set(t, (tagN.get(t) || 0) + 1);
      }
      for (const c of hit) c.n++;
    }
    this.tags = [...tagN.entries()].sort((a, b) => b[1] - a[1]);
    // palette
    this.onPalette(this.layers.flatMap(l => l.categories.map(c => [LAYER_PALETTE_OFFSET + c.bit, c.color])));
  }

  itemsOf(gid) {
    const out = [];
    if (this.linkStart && gid < this.nB) for (let k = this.linkStart[gid]; k < this.linkStart[gid + 1]; k++) out.push(this.link[k]);
    const u = this.userLinks.get(gid);
    if (u) out.push(...u);
    return out;
  }
  cat(it) { return this.layers[it.layer]?.categories[it.cat]; }
  parentOf(it) {
    const c = this.cat(it);
    return c && c.parent ? this.layers[it.layer].categories.find(x => x.id === c.parent) : null;
  }

  // ---------- selection -> colours ----------
  activeIn(it, y) {
    if (y === Infinity) return it.to == null || it.to >= new Date().getFullYear();
    return (it.from == null || it.from <= y) && (it.to == null || it.to >= y);
  }
  /** The item that colours this building now, or null. Leaf categories win over parents. */
  winner(gid) {
    let best = null, bestScore = -1;
    for (const k of this.itemsOf(gid)) {
      const it = this.items[k], c = this.cat(it);
      if (!c) continue;
      const p = this.parentOf(it);
      const on = this.enabled.has(c.bit) || (p && this.enabled.has(p.bit));
      if (!on || !this.activeIn(it, this.year)) continue;
      if (this.tagFilter.size && !it.tags.some(t => this.tagFilter.has(t))) continue;
      // own category enabled beats inherited; user marks beat generated ones
      const score = (this.enabled.has(c.bit) ? 2 : 1) + (it.user ? 4 : 0);
      if (score > bestScore) { bestScore = score; best = it; }
    }
    return best;
  }
  colorBit(it) {
    const c = this.cat(it), p = this.parentOf(it);
    // a child shown under an enabled parent only (child itself off) takes the parent's colour
    return this.enabled.has(c.bit) || !p ? c.bit : p.bit;
  }
  recolor() {
    if (!this.loaded) return;
    this.colors.fill(-1);
    let n = 0;
    for (const g of this.withItems) {
      const it = this.winner(g);
      if (it) { this.colors[g] = this.colorBit(it); n++; }
    }
    this.shown = n;
    this.onChange(this.colors);
  }
  setYear(y) {
    const v = y >= this.today ? Infinity : y;
    if (v === this.year) return;
    this.year = v;
    // throttled, not debounced: while the film plays the colours have to keep up
    if (!this._yt) this._yt = setTimeout(() => { this._yt = 0; this.recolor(); }, 80);
  }

  // ---------- panel ----------
  renderPanel(el, rerender) {
    if (!this.loaded) {
      el.innerHTML = '<h2>Layers</h2><p class="note">Loading layers…</p>';
      this.load().then(rerender);
      return;
    }
    if (!this.layers.length) {
      el.innerHTML = '<h2>Layers</h2><p class="note">No layers for this city yet. Run <code>pipeline &lt;city&gt; layers</code>, or mark a building.</p>';
      return;
    }
    const catRow = (c, child) => `
      <button class="swatch layer-cat${child ? ' child' : ''}" data-bit="${c.bit}" aria-pressed="${this.enabled.has(c.bit)}">
        <i style="background:${c.color}"></i><span>${esc(c.name)}</span><span class="n">${fmt(c.n || 0)}</span></button>`;
    const layerHtml = l => {
      const tops = l.categories.filter(c => !c.parent);
      return `<section class="layer"><h3>${esc(l.name)}${l.publishable === false ? ' <small class="lic">local use only</small>' : ''}</h3>
        <div class="swatches">${tops.map(c => catRow(c, false) +
          l.categories.filter(k => k.parent === c.id).map(k => catRow(k, true)).join('')).join('')}</div></section>`;
    };
    const chips = this.tags.slice(0, 14).map(([t, n]) =>
      `<button class="chip" data-tag="${esc(t)}" aria-pressed="${this.tagFilter.has(t)}">${esc(t)} <small>${fmt(n)}</small></button>`).join('');
    const when = this.year === Infinity ? 'today' : `in ${this.year}`;
    el.innerHTML = `<h2>Who was here ${esc(when)}</h2>
      <p class="note">${fmt(this.shown || 0)} buildings. Drag the timeline to go back in time.</p>
      ${chips ? `<div class="chips">${chips}</div>` : ''}
      <div class="layer-list">${this.layers.filter(l => l.categories.length).map(layerHtml).join('')}</div>
      <div class="layer-tools">
        <button class="btn" data-act="export">Export my marks</button>
        <label class="btn">Import<input type="file" accept=".json,application/json" hidden></label>
      </div>
      <p class="note">${fmt(this.userCount())} marks ${this.api ? 'on this server' : 'in this browser'}. Click a building, then “Mark…”.</p>`;
    el.querySelectorAll('.layer-cat').forEach(b => b.onclick = () => {
      const bit = +b.dataset.bit;
      this.enabled.has(bit) ? this.enabled.delete(bit) : this.enabled.add(bit);
      this.layerAt = performance.now() / 1000;
      this.recolor(); rerender();
    });
    el.querySelectorAll('.chip').forEach(b => b.onclick = () => {
      const t = b.dataset.tag;
      this.tagFilter.has(t) ? this.tagFilter.delete(t) : this.tagFilter.add(t);
      this.recolor(); rerender();
    });
    el.querySelector('[data-act=export]').onclick = () => this.exportMarks();
    el.querySelector('input[type=file]').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { await this.importMarks(JSON.parse(await f.text())); } catch (err) { alert(`Import failed: ${err.message}`); }
      rerender();
    };
  }

  // ---------- card ----------
  cardHtml(gid, pinned) {
    if (!this.loaded) return '';
    const ks = this.itemsOf(gid);
    if (!ks.length && !pinned) return '';
    const yrs = it => it.from && it.to ? `${it.from}–${it.to}` : it.from ? `since ${it.from}` : it.to ? `until ${it.to}` : '';
    const link = it => it.url || (it.wikidata && /^Q\d+$/.test(it.wikidata) ? `https://www.wikidata.org/wiki/${it.wikidata}` : '');
    const rows = ks.slice(0, 8).map(k => {
      const it = this.items[k], c = this.cat(it), href = link(it);
      const name = href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(it.name)}</a>` : esc(it.name);
      return `<li><i style="background:${c?.color || '#999'}"></i><span>${name}
        <small>${esc([c?.name, it.role && it.role !== 'other' ? it.role : '', yrs(it), it.user ? 'your mark' : ''].filter(Boolean).join(' · '))}</small>
        ${it.note ? `<small class="item-note">${esc(it.note)}</small>` : ''}</span>
        ${it.user && pinned ? `<button class="mini" data-del="${k}" aria-label="Delete mark">×</button>` : ''}</li>`;
    }).join('');
    const more = ks.length > 8 ? `<p class="note">and ${ks.length - 8} more</p>` : '';
    return `<section class="occupants">${ks.length ? `<h4>Occupants</h4><ul>${rows}</ul>${more}` : ''}
      ${pinned ? '<button class="btn mark-open">Mark…</button><div class="mark-form" hidden></div>' : ''}</section>`;
  }

  /** Wire the card's buttons; `building` is {gid, point:[x,z]} for the mark's location. */
  bindCard(cardEl, gid, point, refresh) {
    cardEl.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { await this.deleteMark(+b.dataset.del); refresh(); });
    const open = cardEl.querySelector('.mark-open'), form = cardEl.querySelector('.mark-form');
    if (!open) return;
    open.onclick = () => {
      open.hidden = true; form.hidden = false;
      const opts = this.layers.map((l, li) => l.categories.map((c, ci) =>
        `<option value="${li}:${ci}">${esc(l.name)} › ${c.parent ? '  ' : ''}${esc(c.name)}</option>`).join('')).join('');
      form.innerHTML = `
        <label>Name<input name="name" required placeholder="e.g. Acme Robotics"></label>
        <label>Category<select name="cat">${opts}<option value="new">New category…</option></select></label>
        <label class="newcat" hidden>New category<input name="newcat" placeholder="e.g. MIT spinouts"></label>
        <label>Role<select name="role"><option>office</option><option>founded</option><option>hq</option><option>lab</option><option>campus</option><option>dorm</option><option>other</option></select></label>
        <div class="row"><label>From<input name="from" type="number" min="1600" max="2100"></label>
        <label>To<input name="to" type="number" min="1600" max="2100"></label></div>
        <label>Tags<input name="tags" placeholder="comma separated, e.g. yc, acquired"></label>
        <label>Link<input name="url" type="url" placeholder="https://…"></label>
        <label>Note<textarea name="note" rows="2"></textarea></label>
        ${this.api ? `<label>Your name (optional)<input name="author" value="${esc(localStorage.getItem('marks.author') || '')}"></label>` : ''}
        <div class="row"><button class="btn primary" data-act="save">Save mark</button><button class="btn" data-act="cancel">Cancel</button></div>`;
      form.scrollIntoView({ block: 'nearest' });
      form.querySelector('[name=name]').focus();
      const sel = form.querySelector('[name=cat]');
      sel.onchange = () => { form.querySelector('.newcat').hidden = sel.value !== 'new'; };
      form.querySelector('[data-act=cancel]').onclick = e => { e.preventDefault(); form.hidden = true; open.hidden = false; };
      form.querySelector('[data-act=save]').onclick = async e => {
        e.preventDefault();
        const v = k => form.querySelector(`[name=${k}]`).value.trim();
        if (!v('name')) { form.querySelector('[name=name]').focus(); return; }
        let li = -1, ci = -1, categoryName = null;
        if (sel.value === 'new') {
          if (!v('newcat')) { form.querySelector('[name=newcat]').focus(); return; }
          if (this.api) categoryName = v('newcat');
          else [li, ci] = this._userCategory(v('newcat'));
        } else [li, ci] = sel.value.split(':').map(Number);
        const num = k => (v(k) ? Math.round(+v(k)) : null);
        if (this.api) { const a = v('author'); a ? localStorage.setItem('marks.author', a) : localStorage.removeItem('marks.author'); }
        try {
        await this.addMark({
          layer: li, cat: ci, categoryName, name: v('name'), role: v('role'), from: num('from'), to: num('to'),
          url: v('url') || null, note: v('note') || null,
          tags: v('tags').split(',').map(s => s.trim()).filter(Boolean),
        }, gid, point);
        } catch (err) { alert(`Could not save the mark: ${err.message}`); return; }
        refresh();
      };
    };
  }

  // ---------- user marks ----------
  userCount() { return this.items.filter(i => i.user).length; }
  _userLayer() {
    let li = this.layers.findIndex(l => l.user);
    if (li < 0) {
      this.layers.push({ id: 'mine', name: 'My marks', licence: 'yours', publishable: true, user: true, categories: [] });
      li = this.layers.length - 1;
    }
    return li;
  }
  _freeBit() {
    const used = new Set(this.layers.flatMap(l => l.categories.map(c => c.bit)));
    for (let b = 0; b < MAX_BITS; b++) if (!used.has(b)) return b;
    throw new Error('all 64 category colours are in use');
  }
  _userCategory(name) {
    const li = this._userLayer(), L = this.layers[li];
    let ci = L.categories.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
    if (ci < 0) {
      const bit = this._freeBit();
      L.categories.push({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, parent: null, bit,
        color: USER_COLORS[L.categories.length % USER_COLORS.length], n: 0 });
      ci = L.categories.length - 1;
      this.enabled.add(bit);
    }
    return [li, ci];
  }
  xzToLonLat([x, z]) {
    return [+(this.origin.lon + x / this.mx).toFixed(7), +(this.origin.lat - z / this.mz).toFixed(7)];
  }

  async _db() {
    if (this.db) return this.db;
    this.db = await new Promise((res, rej) => {
      const r = indexedDB.open('city-marks', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('marks', { keyPath: 'id', autoIncrement: true });
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return this.db;
  }
  async _tx(mode, fn) {
    const db = await this._db();
    return new Promise((res, rej) => {
      const t = db.transaction('marks', mode), s = t.objectStore('marks');
      const out = fn(s);
      t.oncomplete = () => res(out?.result ?? out); t.onerror = () => rej(t.error);
    });
  }
  async _loadMarks() {
    let rows = [];
    try { rows = await this._tx('readonly', s => s.getAll()); } catch { return; }
    for (const m of rows.filter(r => r.city === this.city)) this._addUserItem(m);
  }
  /** Stored mark -> item. Layer and category are kept by id so they survive a pipeline rebuild. */
  _addUserItem(m) {
    let li = this.layers.findIndex(l => l.id === m.layerId), ci;
    if (li < 0 || m.layerId === 'mine') [li, ci] = this._userCategory(m.categoryName || m.categoryId);
    else {
      ci = this.layers[li].categories.findIndex(c => c.id === m.categoryId);
      if (ci < 0) [li, ci] = this._userCategory(m.categoryName || m.categoryId);
    }
    const it = { layer: li, cat: ci, name: m.name, role: m.role, from: m.from, to: m.to, url: m.url, note: m.note,
      wikidata: null, source: 'user', tags: m.tags || [], user: true, markId: m.id, where: m.where };
    const k = this.items.push(it) - 1;
    const g = m.gid;
    if (g >= 0 && g < this.count) { if (!this.userLinks.has(g)) this.userLinks.set(g, []); this.userLinks.get(g).push(k); }
    return k;
  }
  async addMark(v, gid, point) {
    if (this.api) {
      const L = this.layers[v.layer], C = L?.categories[v.cat];
      const body = {
        layer: C ? L.id : undefined, category: C ? C.id : undefined, categoryName: C ? undefined : v.categoryName,
        name: v.name, role: v.role, from: v.from, to: v.to, url: v.url, note: v.note, tags: v.tags,
        gid, lonlat: this.xzToLonLat(point),
      };
      const it = await this._apiJson('/marks', { method: 'POST', body: JSON.stringify(body) });
      await this._reloadApi();
      const li = this.layers.findIndex(l => l.id === it.layer);
      const c = this.layers[li]?.categories.find(c => c.id === it.category);
      if (c) { this.enabled.add(c.bit); this.recolor(); }
      return;
    }
    const L = this.layers[v.layer], C = L.categories[v.cat];
    const m = {
      city: this.city, layerId: L.user ? 'mine' : L.id, categoryId: C.id, categoryName: C.name,
      name: v.name, role: v.role, from: v.from, to: v.to, url: v.url, note: v.note, tags: v.tags,
      gid, where: { lonlat: this.xzToLonLat(point) }, created: new Date().toISOString(),
    };
    m.id = await this._tx('readwrite', s => s.add(m));
    this._addUserItem(m);
    this.enabled.add(C.bit);
    this._index(); this.recolor();
  }
  async deleteMark(k) {
    const it = this.items[k];
    if (!it?.user) return;
    if (this.api) {
      await this._apiJson(`/marks/${encodeURIComponent(it.markId)}`, { method: 'DELETE' });
      return this._reloadApi();
    }
    await this._tx('readwrite', s => s.delete(it.markId));
    for (const [g, ks] of this.userLinks) {
      const i = ks.indexOf(k); if (i >= 0) { ks.splice(i, 1); if (!ks.length) this.userLinks.delete(g); }
    }
    it.layer = -1;   // tombstone: indices into items stay valid
    this._index(); this.recolor();
  }

  /** A layer file per SCHEMA.md with every mark of this city. */
  async exportMarks() {
    if (this.api) {
      // the server's marks carry their lonlat; categories come from the merged layers
      const where = new Map((await this._apiJson('/marks')).map(m => [m.id, m.lonlat ? { lonlat: m.lonlat } : { gid: m.gids[0] }]));
      for (const it of this.items) if (it.user) it.where = where.get(it.markId);
    }
    const marks = this.items.filter(i => i.user && i.layer >= 0);
    const cats = new Map();
    for (const it of marks) {
      const L = this.layers[it.layer], C = L.categories[it.cat];
      cats.set(C.id, { id: C.id, name: C.name, color: C.color, parent: C.parent ?? null, layer: L.user ? null : L.id });
    }
    const doc = {
      id: `marks-${this.city}`, name: 'My marks', description: 'Exported from the map.',
      licence: 'yours', publishable: true, generated: false,
      categories: [...cats.values()].map(({ layer, ...c }) => c),
      items: marks.map(it => {
        const C = this.cat(it);
        return { name: it.name, category: C.id, tags: it.tags, role: it.role || 'other', from: it.from, to: it.to,
          where: it.where, url: it.url, note: it.note, source: 'user' };
      }),
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }));
    a.download = `marks-${this.city}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return doc;
  }
  /** Import a layer file (marks only resolve where a lonlat falls on a loaded building: resolve(lonlat) -> gid). */
  async importMarks(doc) {
    if (!Array.isArray(doc.items)) throw new Error('not a layer file (no items)');
    const cats = Object.fromEntries((doc.categories || []).map(c => [c.id, c]));
    let ok = 0, miss = 0;
    if (this.api) {
      for (const it of doc.items) {
        const c = cats[it.category];
        const known = this.layers.flatMap(l => l.categories.map(k => [l, k])).find(([, k]) => k.id === it.category);
        const body = {
          ...(known ? { layer: known[0].id, category: known[1].id } : { categoryName: c?.name || it.category || 'Imported', categoryColor: c?.color }),
          name: it.name, role: it.role, from: it.from ?? null, to: it.to ?? null, url: it.url ?? null, note: it.note ?? null,
          tags: it.tags || [], lonlat: it.where?.lonlat, gid: it.where?.lonlat ? undefined : it.where?.gid,
        };
        try { await this._apiJson('/marks', { method: 'POST', body: JSON.stringify(body) }); ok++; } catch { miss++; }
      }
      await this._reloadApi();
      alert(`Imported ${ok} marks${miss ? `; ${miss} did not land on a building` : ''}.`);
      return;
    }
    for (const it of doc.items) {
      const ll = it.where?.lonlat;
      const gid = ll ? this.resolve(ll) : (it.where?.gid ?? -1);
      if (gid < 0) { miss++; continue; }
      const [li, ci] = this._userCategory(cats[it.category]?.name || it.category || 'Imported');
      const x = (ll[0] - this.origin.lon) * this.mx, z = -(ll[1] - this.origin.lat) * this.mz;
      await this.addMark({ layer: li, cat: ci, name: it.name, role: it.role, from: it.from ?? null, to: it.to ?? null,
        url: it.url ?? null, note: it.note ?? null, tags: it.tags || [] }, gid, [x, z]);
      ok++;
    }
    alert(`Imported ${ok} marks${miss ? `; ${miss} did not land on a loaded building` : ''}.`);
  }
}

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => Math.round(n).toLocaleString('en-US');
