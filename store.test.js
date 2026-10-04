import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/store.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('register, logout, login', () => {
  const s = createStore(mem());
  s.register({ name: 'Bindhu', email: 'b@x.dev', password: 'secret1' });
  assert.equal(s.currentUser().name, 'Bindhu');
  s.logout(); assert.equal(s.currentUser(), null);
  assert.throws(() => s.login({ email: 'b@x.dev', password: 'wrong' }), /incorrect/);
  assert.equal(s.login({ email: 'B@x.dev', password: 'secret1' }).role, 'customer');
});
test('rejects duplicate email and short password', () => {
  const s = createStore(mem());
  assert.throws(() => s.register({ name: 'A', email: 'admin@kaapikart.dev', password: 'secret1' }), /already/);
  assert.throws(() => s.register({ name: 'A', email: 'a@x.dev', password: '123' }), /6 characters/);
});
test('search, filter and sort', () => {
  const s = createStore(mem());
  assert.ok(s.list({ q: 'grinder' }).length === 1);
  assert.ok(s.list({ cat: 'Gear' }).every((p) => p.cat === 'Gear'));
  const prices = s.list({ sort: 'price-asc' }).map((p) => p.price);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
});
test('customers cannot edit products; admin CRUD works', () => {
  const s = createStore(mem());
  assert.throws(() => s.saveProduct({ name: 'X', price: 5, stock: 1 }), /admins/);
  s.login({ email: 'admin@kaapikart.dev', password: 'admin123' });
  s.saveProduct({ name: 'Test Mug', cat: 'Gear', price: 250, stock: 3 });
  const p = s.list({ q: 'test mug' })[0];
  s.saveProduct({ id: p.id, name: 'Test Mug 2', price: 300, stock: 2 });
  assert.equal(s.product(p.id).price, 300);
  assert.throws(() => s.saveProduct({ name: 'Bad', price: 0, stock: 1 }), /Price/);
  s.deleteProduct(p.id); assert.equal(s.product(p.id), undefined);
});
test('cart respects stock, guest cart merges on login, checkout reduces stock', () => {
  const s = createStore(mem());
  s.addToCart('p1'); s.addToCart('p1');
  assert.throws(() => s.addToCart('p8'), /Out of stock/);
  s.register({ name: 'C', email: 'c@x.dev', password: 'secret1' });
  assert.equal(s.cart().count, 2);
  const before = s.product('p1').stock, o = s.checkout();
  assert.equal(o.total, 898); assert.equal(s.product('p1').stock, before - 2);
  assert.equal(s.cart().count, 0); assert.equal(s.orders().length, 1);
  assert.throws(() => s.checkout(), /empty/);
});
test('state persists across store instances', () => {
  const st = mem(); const a = createStore(st);
  a.register({ name: 'P', email: 'p@x.dev', password: 'secret1' }); a.addToCart('p2');
  const b = createStore(st);
  assert.equal(b.currentUser().email, 'p@x.dev'); assert.equal(b.cart().count, 1);
});
test('corrupt storage falls back to fresh state', () => {
  const st = mem(); st.setItem('kaapikart:v1', '{oops');
  assert.ok(createStore(st).list().length > 0);
});
