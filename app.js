import { createStore } from './store.js';
const store = createStore();
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = (n) => '₹' + n.toLocaleString('en-IN');
const view = $('#view');
let filters = { q: '', cat: 'All', sort: 'featured' };
let authMode = 'login';

function toast(msg, bad) {
  const t = $('#toast'); t.textContent = msg; t.className = 'show' + (bad ? ' bad' : '');
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = ''), 2800);
}
const attempt = (fn, ok) => { try { const r = fn(); if (ok) toast(ok); return r; } catch (e) { toast(e.message, true); } };
const go = (h) => { location.hash = '#/' + h; };

function nav() {
  const u = store.currentUser(), n = store.cart().count, cur = location.hash.slice(2);
  const a = (h, label) => `<a href="#/${h}" ${cur === h ? 'aria-current="page"' : ''}>${label}</a>`;
  $('#nav').innerHTML = a('', 'Shop') + a('cart', `Cart${n ? ` <span class="badge">${n}</span>` : ''}`) + (u ? a('orders', 'Orders') : '') +
    (u?.role === 'admin' ? a('admin', 'Manage') : '') +
    (u ? `<button data-a="logout" class="link">Log out (${esc(u.name.split(' ')[0])})</button>` : a('login', 'Log in'));
}

function card(p) {
  const out = p.stock < 1, low = p.stock > 0 && p.stock <= 10;
  return `<article class="card"><button class="tile" data-a="detail" data-id="${p.id}" style="background-color:${esc(p.color)}" aria-label="Details for ${esc(p.name)}"><span>${esc(p.icon)}</span>${out ? '<em class="pill">Sold out</em>' : low ? `<em class="pill warn">Only ${p.stock} left</em>` : ''}</button>
  <div class="body"><p class="muted">${esc(p.cat)}</p><h3>${esc(p.name)}</h3>
  <div class="row"><span class="price">${inr(p.price)}</span><button class="btn" data-a="add" data-id="${p.id}" ${out ? 'disabled' : ''}>${out ? 'Unavailable' : 'Add to cart'}</button></div></div></article>`;
}
function drawGrid() {
  const r = store.list(filters);
  $('#grid').innerHTML = r.length ? r.map(card).join('') : '<p class="empty">No products match your search. Clear the search or pick another category.</p>';
  $('#count').textContent = `${r.length} product${r.length === 1 ? '' : 's'}`;
}
function home() {
  view.innerHTML = `<section class="hero"><div><h1>Filter coffee, brewed the slow way.</h1><p>Small-batch beans from Karnataka's hills and the steel gear to pour them properly.</p>
  <div class="hero-cta"><button class="btn accent" data-a="cat" data-v="Beans" data-scroll="1">Shop beans</button><button class="btn ghost" data-a="cat" data-v="Gear" data-scroll="1">Browse gear</button></div></div>
  <div class="hero-art"><svg viewBox="0 0 320 300" role="img" aria-label="Steel tumbler and dabara holding hot filter coffee">
  <g class="steam"><path d="M130 70c-14-16 14-26 0-44"/><path d="M162 62c-14-16 14-26 0-44"/><path d="M194 70c-14-16 14-26 0-44"/></g>
  <path d="M46 214h228l-20 40H66z" fill="#aab6bf"/><ellipse cx="160" cy="214" rx="114" ry="15" fill="#dfe6e9"/><ellipse cx="160" cy="214" rx="88" ry="9" fill="#c4cdd3"/>
  <path d="M100 92h120l-13 122h-94z" fill="#eef2f4"/><path d="M118 96l9 116" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".8"/><path d="M104 150h112" stroke="#c4cdd3" stroke-width="3"/>
  <ellipse cx="160" cy="92" rx="60" ry="10" fill="#8d99a6"/><ellipse cx="160" cy="94" rx="52" ry="7" fill="#5a3825"/></svg></div></section>
  <div id="catalog" class="bar"><input id="q" type="search" placeholder="Search beans, gear, extras" value="${esc(filters.q)}" aria-label="Search products">
  <select id="sort" aria-label="Sort products">${[['featured', 'Featured'], ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low'], ['name', 'Name']].map(([v, l]) => `<option value="${v}" ${v === filters.sort ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
  <div class="chips" role="group" aria-label="Category">${store.categories().map((c) => `<button class="chip" data-a="cat" data-v="${esc(c)}" aria-pressed="${c === filters.cat}">${esc(c)}</button>`).join('')}</div>
  <p id="count" class="muted count"></p><div id="grid" class="grid"></div>`;
  drawGrid();
}
function cartView() {
  const c = store.cart();
  view.innerHTML = `<h2>Your cart</h2>` + (!c.items.length ? '<p class="empty">Your cart is empty. <a href="#/">Browse the shop</a>.</p>' :
    `<div class="cart-layout"><ul class="lines">${c.items.map(({ product: p, qty }) => `<li><span class="ico" style="background:${esc(p.color)}">${esc(p.icon)}</span>
    <div class="info"><strong>${esc(p.name)}</strong><div class="muted">${inr(p.price)} each</div><button class="link" data-a="rm" data-id="${p.id}">Remove</button></div>
    <div class="qty"><button data-a="qty" data-id="${p.id}" data-d="-1" aria-label="Decrease quantity">−</button><span>${qty}</span><button data-a="qty" data-id="${p.id}" data-d="1" aria-label="Increase quantity">+</button></div>
    <div class="sub">${inr(p.price * qty)}</div></li>`).join('')}</ul>
    <aside class="summary"><h3>Order summary</h3><div class="sum"><span>Items</span><span>${c.count}</span></div><div class="sum"><span>Delivery</span><span>Free</span></div>
    <div class="sum total"><span>Total</span><span>${inr(c.total)}</span></div>
    <button class="btn big" data-a="checkout">${store.currentUser() ? 'Place order' : 'Log in to place order'}</button><p class="muted" style="margin-top:12px">Demo checkout. No payment is taken.</p></aside></div>`);
}
function ordersView() {
  const o = store.orders();
  view.innerHTML = `<h2>${store.currentUser().role === 'admin' ? 'All orders' : 'Your orders'}</h2>` + (!o.length ? '<p class="empty">No orders yet. <a href="#/">Start shopping</a>.</p>' :
    o.map((x) => `<article class="order"><header><strong>#${esc(x.id)}</strong><span class="muted">${new Date(x.at).toLocaleString('en-IN')}</span><strong>${inr(x.total)}</strong></header>
    <ul>${x.lines.map((l) => `<li>${l.qty} × ${esc(l.name)}</li>`).join('')}</ul></article>`).join(''));
}
function adminView() {
  view.innerHTML = `<div class="row"><h2>Manage products</h2><button class="btn" data-a="new">Add product</button></div>
  <div class="scroll"><table><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr></thead><tbody>
  ${store.list().map((p) => `<tr><td>${esc(p.icon)} ${esc(p.name)}</td><td>${esc(p.cat)}</td><td>${inr(p.price)}</td><td>${p.stock}</td>
  <td class="acts"><button class="link" data-a="edit" data-id="${p.id}">Edit</button><button class="link danger" data-a="del" data-id="${p.id}">Delete</button></td></tr>`).join('')}</tbody></table></div>
  <p class="muted">Changes are saved in this browser (localStorage).</p>`;
}
function loginView() {
  const reg = authMode === 'register';
  view.innerHTML = `<div class="auth"><h2>${reg ? 'Create your account' : 'Log in'}</h2>
  <form id="auth">${reg ? '<label>Name<input name="name" autocomplete="name" required></label>' : ''}
  <label>Email<input name="email" type="email" autocomplete="email" required></label>
  <label>Password<input name="password" type="password" minlength="6" autocomplete="${reg ? 'new-password' : 'current-password'}" required></label>
  <button class="btn big">${reg ? 'Create account' : 'Log in'}</button></form>
  <p>${reg ? 'Have an account?' : 'New here?'} <button class="link" data-a="mode">${reg ? 'Log in' : 'Create an account'}</button></p>
  ${reg ? '' : '<p class="muted">Demo admin: admin@kaapikart.dev / admin123</p>'}</div>`;
}
function route() {
  nav(); const r = location.hash.slice(2), u = store.currentUser();
  if (r === 'cart') cartView();
  else if (r === 'orders') u ? ordersView() : go('login');
  else if (r === 'admin') u?.role === 'admin' ? adminView() : go('login');
  else if (r === 'login') u ? go('') : loginView();
  else home();
  window.scrollTo(0, 0);
}
const refresh = () => { nav(); if ($('#grid')) drawGrid(); else route(); };

function productForm(id) {
  const p = id ? store.product(id) : { name: '', cat: 'Beans', price: '', stock: 10, icon: '📦', color: '#5b6b7a', desc: '' };
  const d = $('#dlg'); d.dataset.id = id || '';
  d.innerHTML = `<form method="dialog" id="pf"><h2>${id ? 'Edit product' : 'Add product'}</h2>
  <label>Name<input name="name" value="${esc(p.name)}" required></label>
  <label>Category<input name="cat" value="${esc(p.cat)}" list="cats"></label><datalist id="cats">${store.categories().filter((c) => c !== 'All').map((c) => `<option>${esc(c)}`).join('')}</datalist>
  <div class="two"><label>Price (₹)<input name="price" type="number" min="1" value="${esc(p.price)}" required></label><label>Stock<input name="stock" type="number" min="0" step="1" value="${esc(p.stock)}" required></label></div>
  <div class="two"><label>Icon (emoji)<input name="icon" value="${esc(p.icon)}" maxlength="4"></label><label>Tile colour<input name="color" type="color" value="${esc(p.color)}"></label></div>
  <label>Description<textarea name="desc" rows="3">${esc(p.desc)}</textarea></label>
  <div class="row"><button type="button" class="link" data-a="close">Cancel</button><button class="btn" value="save">Save product</button></div></form>`;
  d.showModal();
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const { a, id } = el.dataset;
  if (a === 'add') attempt(() => { store.addToCart(id); refresh(); }, 'Added to cart.');
  else if (a === 'qty') attempt(() => { store.setQty(id, store.cart().items.find((i) => i.product.id === id).qty + Number(el.dataset.d)); refresh(); });
  else if (a === 'rm') { store.setQty(id, 0); refresh(); }
  else if (a === 'checkout') { if (!store.currentUser()) return go('login'); const o = attempt(() => store.checkout()); if (o) { toast(`Order #${o.id} placed.`); go('orders'); } }
  else if (a === 'logout') { store.logout(); toast('Logged out.'); go(''); route(); }
  else if (a === 'mode') { authMode = authMode === 'login' ? 'register' : 'login'; loginView(); }
  else if (a === 'cat') {
    filters.cat = el.dataset.v;
    document.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.v === filters.cat)));
    drawGrid(); if (el.dataset.scroll) $('#catalog').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  else if (a === 'new') productForm();
  else if (a === 'edit') productForm(id);
  else if (a === 'del') { if (confirm('Delete this product? This cannot be undone.')) attempt(() => { store.deleteProduct(id); adminView(); nav(); }, 'Product deleted.'); }
  else if (a === 'close') $('#dlg').close();
  else if (a === 'detail') {
    const p = store.product(id), d = $('#dlg');
    d.innerHTML = `<div class="detail"><div class="tile big" style="background-color:${esc(p.color)}"><span>${esc(p.icon)}</span></div><h2>${esc(p.name)}</h2><p>${esc(p.desc)}</p>
    <div class="row"><span class="price">${inr(p.price)}</span><span class="muted">${p.stock > 0 ? p.stock + ' in stock' : 'Sold out'}</span></div>
    <div class="row"><button class="link" data-a="close">Close</button><button class="btn" data-a="add" data-id="${p.id}" ${p.stock < 1 ? 'disabled' : ''}>Add to cart</button></div></div>`;
    d.showModal();
  }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'q') { filters.q = e.target.value; drawGrid(); }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'cat') { filters.cat = e.target.value; drawGrid(); }
  if (e.target.id === 'sort') { filters.sort = e.target.value; drawGrid(); }
});
document.addEventListener('submit', (e) => {
  const f = e.target;
  if (f.id === 'auth') {
    e.preventDefault(); const v = Object.fromEntries(new FormData(f));
    const u = attempt(() => (authMode === 'register' ? store.register(v) : store.login(v)));
    if (u) { toast(`Welcome, ${u.name}.`); go(u.role === 'admin' ? 'admin' : ''); }
  } else if (f.id === 'pf' && e.submitter?.value === 'save') {
    const v = Object.fromEntries(new FormData(f)); const dlg = $('#dlg'); if (dlg.dataset.id) v.id = dlg.dataset.id;
    try { store.saveProduct(v); toast('Product saved.'); adminView(); nav(); } catch (err) { e.preventDefault(); toast(err.message, true); }
  }
});
addEventListener('hashchange', route);
route();
