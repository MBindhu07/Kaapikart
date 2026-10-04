// State + persistence layer. No DOM access, so it is unit-testable in Node.
const KEY = 'kaapikart:v1';

export const SEED = [
  { id: 'p1', name: 'Mysore Peaberry Beans 250g', cat: 'Beans', price: 449, stock: 40, icon: '☕', color: '#4a2c1a', desc: 'Single-bean cherries, medium-dark roast. Low acidity, built for filter coffee.' },
  { id: 'p2', name: 'Chikmagalur Estate Blend 500g', cat: 'Beans', price: 689, stock: 25, icon: '🫘', color: '#6b4226', desc: '80:20 coffee-chicory style blend, ground fine for a decoction that holds its body.' },
  { id: 'p3', name: 'Coorg Arabica Light Roast 250g', cat: 'Beans', price: 529, stock: 18, icon: '🌱', color: '#7a5c3a', desc: 'Bright, citrusy and clean. Best as a pour-over.' },
  { id: 'p4', name: 'Steel Davara Set (Tumbler + Dabara)', cat: 'Gear', price: 599, stock: 60, icon: '🥛', color: '#8d99a6', desc: 'Stainless steel tumbler and saucer. Cools coffee while you pour it back and forth.' },
  { id: 'p5', name: 'Two-Chamber Coffee Filter 4 Cup', cat: 'Gear', price: 1099, stock: 15, icon: '🫖', color: '#5b6b7a', desc: 'Pressed-steel filter with a fine perforated plate for a slow, strong drip.' },
  { id: 'p6', name: 'Hand Burr Grinder', cat: 'Gear', price: 2499, stock: 8, icon: '⚙️', color: '#3b4756', desc: 'Adjustable ceramic burrs, from Turkish-fine to coarse.' },
  { id: 'p7', name: 'Jaggery Sachets (12 pack)', cat: 'Extras', price: 199, stock: 50, icon: '🟤', color: '#a0642a', desc: 'Unrefined jaggery for a mellow sweetness instead of sugar.' },
  { id: 'p8', name: 'Chicory Powder 200g', cat: 'Extras', price: 149, stock: 0, icon: '🌾', color: '#6e5a3c', desc: 'Roasted chicory to add depth. Currently restocking.' },
];

export function hash(pw) { // Demo-only hash. Real apps hash on the server (bcrypt/argon2).
  let h = 5381; const s = 'kk:' + pw;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

const fresh = () => ({
  products: structuredClone(SEED),
  users: [{ id: 'u1', name: 'Admin', email: 'admin@kaapikart.dev', hash: hash('admin123'), role: 'admin' }],
  carts: {}, orders: [], session: null,
});
const uid = (p) => p + Math.random().toString(36).slice(2, 9);

export function createStore(storage = globalThis.localStorage) {
  let s = (() => { try { const r = JSON.parse(storage.getItem(KEY)); if (r && r.products && r.users) return r; } catch { /* corrupt data: start fresh */ } return fresh(); })();
  const save = () => { try { storage.setItem(KEY, JSON.stringify(s)); } catch { /* quota/private mode */ } };
  const fail = (m) => { throw new Error(m); };
  const cartKey = () => s.session || 'guest';
  const user = () => s.users.find((u) => u.id === s.session) || null;

  return {
    currentUser: user,
    // --- auth ---
    register({ name, email, password }) {
      name = (name || '').trim(); email = (email || '').trim().toLowerCase();
      if (!name) fail('Enter your name.');
      if (!/^\S+@\S+\.\S+$/.test(email)) fail('Enter a valid email address.');
      if ((password || '').length < 6) fail('Password must be at least 6 characters.');
      if (s.users.some((u) => u.email === email)) fail('That email is already registered. Log in instead.');
      const u = { id: uid('u'), name, email, hash: hash(password), role: 'customer' };
      s.users.push(u); this.login({ email, password }); return u;
    },
    login({ email, password }) {
      const u = s.users.find((x) => x.email === (email || '').trim().toLowerCase());
      if (!u || u.hash !== hash(password || '')) fail('Email or password is incorrect.');
      const guest = s.carts.guest || {};
      s.session = u.id; s.carts[u.id] = s.carts[u.id] || {};
      for (const [id, q] of Object.entries(guest)) s.carts[u.id][id] = (s.carts[u.id][id] || 0) + q;
      delete s.carts.guest; save(); return u;
    },
    logout() { s.session = null; save(); },
    // --- catalog (read) ---
    categories: () => ['All', ...new Set(s.products.map((p) => p.cat))],
    product: (id) => s.products.find((p) => p.id === id),
    list({ q = '', cat = 'All', sort = 'featured' } = {}) {
      q = q.trim().toLowerCase();
      let r = s.products.filter((p) => (cat === 'All' || p.cat === cat) && (!q || (p.name + p.desc).toLowerCase().includes(q)));
      const by = { 'price-asc': (a, b) => a.price - b.price, 'price-desc': (a, b) => b.price - a.price, name: (a, b) => a.name.localeCompare(b.name) }[sort];
      return by ? [...r].sort(by) : r;
    },
    // --- catalog (admin CRUD) ---
    saveProduct(p) {
      if (user()?.role !== 'admin') fail('Only admins can change products.');
      const n = { name: (p.name || '').trim(), cat: (p.cat || '').trim() || 'Extras', price: Number(p.price), stock: Number(p.stock), icon: p.icon || '📦', color: p.color || '#5b6b7a', desc: (p.desc || '').trim() };
      if (!n.name) fail('Product name is required.');
      if (!(n.price > 0)) fail('Price must be greater than 0.');
      if (!Number.isInteger(n.stock) || n.stock < 0) fail('Stock must be a whole number, 0 or more.');
      if (p.id) { const i = s.products.findIndex((x) => x.id === p.id); if (i < 0) fail('Product not found.'); s.products[i] = { ...s.products[i], ...n }; }
      else s.products.push({ id: uid('p'), ...n });
      save();
    },
    deleteProduct(id) {
      if (user()?.role !== 'admin') fail('Only admins can change products.');
      s.products = s.products.filter((p) => p.id !== id);
      for (const c of Object.values(s.carts)) delete c[id];
      save();
    },
    // --- cart ---
    cart() {
      const c = s.carts[cartKey()] || {};
      const items = Object.entries(c).map(([id, qty]) => ({ product: this.product(id), qty })).filter((i) => i.product);
      return { items, count: items.reduce((a, i) => a + i.qty, 0), total: items.reduce((a, i) => a + i.qty * i.product.price, 0) };
    },
    setQty(id, qty) {
      const p = this.product(id); if (!p) fail('Product not found.');
      const c = (s.carts[cartKey()] = s.carts[cartKey()] || {});
      qty = Math.min(Math.floor(qty), p.stock);
      if (qty <= 0) delete c[id]; else c[id] = qty;
      save();
    },
    addToCart(id) {
      const p = this.product(id); if (!p || p.stock < 1) fail('Out of stock.');
      const have = (s.carts[cartKey()] || {})[id] || 0;
      if (have >= p.stock) fail(`Only ${p.stock} in stock.`);
      this.setQty(id, have + 1);
    },
    checkout() {
      const u = user(); if (!u) fail('Log in to place your order.');
      const { items, total } = this.cart(); if (!items.length) fail('Your cart is empty.');
      for (const i of items) if (i.qty > i.product.stock) fail(`${i.product.name}: only ${i.product.stock} left.`);
      for (const i of items) i.product.stock -= i.qty;
      const o = { id: uid('o').toUpperCase(), userId: u.id, at: new Date().toISOString(), total, lines: items.map((i) => ({ name: i.product.name, qty: i.qty, price: i.product.price })) };
      s.orders.unshift(o); s.carts[u.id] = {}; save(); return o;
    },
    orders: () => (user()?.role === 'admin' ? s.orders : s.orders.filter((o) => o.userId === s.session)),
    reset() { s = fresh(); save(); },
  };
}
