const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');
const PORT = process.env.PORT || 3000;
const EM = ['😂', '❤️', '🔥', '💀'];
const PROMPTS = ['แมวใส่แว่นกำลังขายส้มตำ', 'มนุษย์ต่างดาวเข้าคิวซื้อชานม', 'ไดโนเสาร์ไลฟ์สดขายของ', 'หมาขี่มอเตอร์ไซค์ฝ่าน้ำท่วม', 'ผีมาสายตอนตีสอง', 'หุ่นยนต์อกหักนั่งร้องไห้', 'ช้างเต้น TikTok', 'ปลาทองหนีออกจากตู้', 'ลุงขับรถไฟเหาะหลับใน', 'เงือกติดแหงกอยู่ในเซเว่น', 'ยักษ์ใหญ่ง้อแฟน', 'นินจากินบุฟเฟต์', 'กระต่ายแข่งกับเต่าแต่เต่าโกง', 'เจ้าหญิงขับแท็กซี่', 'มังกรพ่นไฟย่างหมูปิ้ง', 'พ่อมดลืมคาถากลางงานแต่ง', 'หมีขั้วโลกติดร้อนที่ห้าง', 'นักบินอวกาศหลงทางใน BTS', 'ไก่ชนสวมชุดซุปเปอร์ฮีโร่', 'ปลาหมึกยักษ์ตีกลองชุด', 'แมงมุมถักผ้าพันคอให้เพื่อน', 'เพนกวินรอรถเมล์ในทะเลทราย', 'ซอมบี้เมาค้างตอนเช้า', 'ยีราฟใส่ปลอกคอกันหนาว', 'คุณยายแร็ปสดบนเวที', 'โดราเอมอนติดหนี้ค่าไฟ', 'ลิงส่งของ Lineman', 'ตุ๊กแกจัดรายการวิทยุ', 'ฮิปโปเล่นสไลเดอร์น้ำ', 'นางฟ้าโดนปรับที่จอดรถ', 'เต่าวิ่งมาราธอนชนะที่หนึ่ง', 'หนูแฮมสเตอร์เป็นซีอีโอ', 'จระเข้ไปทำเล็บ', 'ห่านสีชมพูบุกงานประชุม', 'ผึ้งแอบเข้าคอนโดชั้น 40', 'กบร้องเพลงลูกทุ่งกลางฝน'];
const rooms = new Map();
const rid = () => Math.random().toString(36).slice(2, 12);
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const lev = (a, b) => { a = Array.from(a); b = Array.from(b); let p = Array.from({ length: b.length + 1 }, (_, i) => i); for (let i = 1; i <= a.length; i++) { const c = [i]; for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[b.length]; };
const sim = (a, b) => { a = a.trim().toLowerCase(); b = b.trim().toLowerCase(); const m = Math.max(Array.from(a).length, Array.from(b).length); if (!m || !b || b === '(ว่าง)') return 0; return Math.max(0, Math.round(100 * (1 - lev(a, b) / m))); };
const send = (w, o) => { if (w && w.readyState === 1) w.send(JSON.stringify(o)); };
const onl = R => [...R.P.values()].filter(p => p.on);
const cast = (R, o) => onl(R).forEach(p => send(p.ws, o));
const sys = (R, text) => { const m = { sys: 1, text, ts: Date.now() }; R.chat.push(m); R.chat = R.chat.slice(-50); cast(R, { t: 'chat', m }); };
const mk = code => ({ code, host: null, P: new Map(), phase: 'lobby', set: { mode: 'free', time: 60 }, chat: [], r: 0, order: [], ch: [], dl: 0, tm: null, gc: null, sub: new Set(), rv: { c: 0, s: 0, shown: false }, votes: {}, rx: {} });
const kindOf = R => (R.r + (R.set.mode === 'rand' ? 1 : 0)) % 2 ? 'draw' : 'write';
const cidx = (R, id) => { const i = R.order.indexOf(id); return i < 0 ? -1 : (i - R.r + R.order.length) % R.order.length; };
const res = (R, i) => { const c = R.ch[i], tx = c.items.filter(x => x.k === 'write'), last = tx[tx.length - 1]; return { owner: c.owner, by: last ? last.by : null, sim: tx.length > 1 ? sim(tx[0].d, last.d) : null }; };
const tally = R => { const t = {}; Object.values(R.votes).forEach(v => Object.values(v).forEach(x => t[x] = (t[x] || 0) + 1)); return t; };

function snap(R, me) {
  const s = { t: 'state', me: me.id, room: R.code, phase: R.phase, set: R.set, host: R.host, rx: R.rx, vt: onl(R).length,
    ps: [...R.P.values()].map(p => ({ id: p.id, name: p.name, av: p.av, ready: p.ready, on: p.on })) };
  if (R.phase === 'play') {
    const c = R.ch[cidx(R, me.id)];
    s.r = R.r; s.n = R.order.length; s.kind = kindOf(R); s.left = Math.max(0, R.dl - Date.now()); s.sub = [...R.sub];
    s.task = c && c.items.length ? c.items[c.items.length - 1].d : null;
  }
  if (R.phase === 'reveal') {
    const c = R.ch[R.rv.c], v = R.votes[R.rv.c] || {};
    s.rv = { c: R.rv.c, n: R.ch.length, s: R.rv.s, last: R.rv.s >= c.items.length - 1, shown: R.rv.shown, owner: c.owner, items: c.items.slice(0, R.rv.s + 1) };
    s.vc = Object.keys(v).length; s.my = v[me.id] || null;
    s.cand = [...new Set(c.items.map(x => x.by))].filter(x => x && x !== c.owner && x !== me.id && R.P.has(x));
    if (R.rv.shown) { s.res = res(R, R.rv.c); s.tl = {}; Object.values(v).forEach(x => s.tl[x] = (s.tl[x] || 0) + 1); }
  }
  if (R.phase === 'final') {
    const t = tally(R), chains = R.ch.map((_, i) => res(R, i)).sort((a, b) => (b.sim ?? -1) - (a.sim ?? -1)), ok = chains.filter(c => c.sim !== null), aw = [];
    if (ok.length && ok[0].sim > 0 && ok[0].by) aw.push({ n: '🛡️ ผู้รักษาต้นฉบับ', id: ok[0].by, sim: ok[0].sim });
    if (ok.length > 1) { const w = ok[ok.length - 1]; if (w.by) aw.push({ n: '💣 ตัวทำลายสาย', id: w.by, sim: w.sim }); aw.push({ n: '🌀 สายที่เพี้ยนที่สุด', id: w.owner, sim: w.sim }); }
    s.fin = { board: [...R.P.values()].map(p => ({ id: p.id, pts: t[p.id] || 0 })).sort((a, b) => b.pts - a.pts), chains, aw };
  }
  return s;
}
const bc = R => onl(R).forEach(p => send(p.ws, snap(R, p)));

function begin(R) {
  R.sub = new Set(); R.dl = Date.now() + R.set.time * 1000; clearTimeout(R.tm);
  R.tm = setTimeout(() => endRound(R), R.set.time * 1000 + 3000); bc(R);
}
function endRound(R) {
  clearTimeout(R.tm); if (R.phase !== 'play') return;
  const k = kindOf(R);
  R.order.forEach(id => { if (!R.sub.has(id)) R.ch[cidx(R, id)].items.push({ by: id, k, d: k === 'write' ? '(ว่าง)' : '' }); });
  R.r++;
  if (R.r >= R.order.length) toReveal(R); else begin(R);
}
function resetLobby(R) {
  clearTimeout(R.tm); R.phase = 'lobby'; R.ch = []; R.order = []; R.votes = {}; R.rx = {}; R.rv = { c: 0, s: 0, shown: false };
  R.P.forEach(p => { p.ready = p.id === R.host; p.sub = false; }); bc(R);
}
function toReveal(R) {
  clearTimeout(R.tm); R.ch = R.ch.filter(c => c.items.length > 1);
  if (!R.ch.length) { sys(R, 'ไม่มีผลงานให้เฉลย กลับล็อบบี้'); return resetLobby(R); }
  R.phase = 'reveal'; R.rv = { c: 0, s: 0, shown: false }; R.votes = {}; R.rx = {}; sys(R, 'เข้าสู่ช่วงเฉลย 🎬'); bc(R);
}

const srv = http.createServer((q, r) => {
  try { r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(fs.readFileSync(path.join(__dirname, 'index.html'))); }
  catch { r.writeHead(500); r.end('index.html not found'); }
});
const wss = new WebSocketServer({ server: srv, maxPayload: 400e3 });

wss.on('connection', ws => {
  let R, me;
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'join') {
      if (R) return;
      let r = rooms.get(clean(m.room, 4).toUpperCase());
      if (m.create) { let c; do c = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random() * 24 | 0]).join(''); while (rooms.has(c)); r = mk(c); rooms.set(c, r); }
      if (!r) return send(ws, { t: 'err', msg: 'ไม่เจอห้องนี้ ลองเช็กโค้ดอีกที' });
      const pid = clean(m.pid, 16); let p = pid && r.P.get(pid), fresh = false;
      if (p) { p.ws = ws; p.on = true; }
      else {
        if (r.phase !== 'lobby') return send(ws, { t: 'err', msg: 'เกมเริ่มไปแล้ว รอรอบหน้านะ' });
        if (r.P.size >= 12) return send(ws, { t: 'err', msg: 'ห้องเต็มแล้ว (สูงสุด 12)' });
        p = { id: pid.length >= 4 ? pid : rid(), name: clean(m.name, 14) || 'ผู้เล่นลึกลับ', av: clean(m.av, 8) || '🐱', ws, ready: false, on: true, lc: 0, lr: 0 };
        r.P.set(p.id, p); fresh = true; if (!r.host) { r.host = p.id; p.ready = true; }
      }
      R = r; me = p; clearTimeout(R.gc);
      send(ws, { t: 'prompts', l: PROMPTS }); send(ws, { t: 'hist', l: R.chat });
      if (fresh) sys(R, `${p.name} เข้าห้อง`);
      return bc(R);
    }
    if (!R || !me || !R.P.has(me.id)) return;
    switch (m.t) {
      case 'chat': {
        if (R.phase === 'play') return;
        const x = clean(m.text, 120); if (!x || Date.now() - me.lc < 1000) return; me.lc = Date.now();
        const c = { id: me.id, name: me.name, av: me.av, text: x, ts: Date.now() };
        R.chat.push(c); R.chat = R.chat.slice(-50); cast(R, { t: 'chat', m: c }); break;
      }
      case 'ready': if (R.phase === 'lobby' && me.id !== R.host) { me.ready = !me.ready; bc(R); } break;
      case 'set':
        if (me.id !== R.host || R.phase !== 'lobby') return;
        if (['free', 'rand'].includes(m.mode)) R.set.mode = m.mode;
        if ([30, 45, 60, 90].includes(m.time)) R.set.time = m.time;
        bc(R); break;
      case 'kick': {
        if (me.id !== R.host || R.phase !== 'lobby') return;
        const p = R.P.get(m.id); if (!p || p.id === me.id) return;
        send(p.ws, { t: 'kicked' }); R.P.delete(p.id); sys(R, `${p.name} โดนเตะออกจากห้อง`); bc(R);
        if (p.ws) p.ws.close(); break;
      }
      case 'start': {
        if (me.id !== R.host || R.phase !== 'lobby') return;
        const o = onl(R);
        if (o.length < 3) return send(ws, { t: 'err', msg: 'ต้องมีอย่างน้อย 3 คน' });
        if (o.some(p => p.id !== R.host && !p.ready)) return send(ws, { t: 'err', msg: 'ยังมีคนไม่พร้อม' });
        const pr = [...PROMPTS].sort(() => Math.random() - .5);
        R.order = o.map(p => p.id).sort(() => Math.random() - .5); R.r = 0; R.phase = 'play'; R.votes = {}; R.rx = {};
        R.ch = R.order.map((id, i) => ({ owner: id, items: R.set.mode === 'rand' ? [{ by: null, k: 'write', d: pr[i % pr.length] }] : [] }));
        sys(R, 'เกมเริ่มแล้ว 🔥'); begin(R); break;
      }
      case 'submit': {
        if (R.phase !== 'play' || R.sub.has(me.id)) return;
        const i = cidx(R, me.id); if (i < 0) return;
        const k = kindOf(R); let d;
        if (k === 'write') d = clean(m.d, 80) || '(ว่าง)';
        else { d = String(m.d || ''); if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(d) || d.length > 300e3) return send(ws, { t: 'err', msg: 'ภาพใหญ่เกินไป' }); }
        R.ch[i].items.push({ by: me.id, k, d }); R.sub.add(me.id);
        if (R.order.every(id => R.sub.has(id) || !R.P.get(id).on)) endRound(R); else bc(R);
        break;
      }
      case 'next': {
        if (me.id !== R.host || R.phase !== 'reveal') return;
        const c = R.ch[R.rv.c];
        if (R.rv.s < c.items.length - 1) R.rv.s++;
        else if (!R.rv.shown) R.rv.shown = true;
        else if (R.rv.c < R.ch.length - 1) R.rv = { c: R.rv.c + 1, s: 0, shown: false };
        else R.phase = 'final';
        R.rx = {}; bc(R); break;
      }
      case 'vote': {
        if (R.phase !== 'reveal' || R.rv.shown) return;
        const c = R.ch[R.rv.c], t = m.target;
        if (R.rv.s < c.items.length - 1 || t === me.id || t === c.owner || !R.P.has(t) || !c.items.some(x => x.by === t)) return;
        (R.votes[R.rv.c] = R.votes[R.rv.c] || {})[me.id] = t; bc(R); break;
      }
      case 'react': {
        if (!EM.includes(m.e) || !['reveal', 'final'].includes(R.phase) || Date.now() - me.lr < 120) return; me.lr = Date.now();
        R.rx[m.e] = (R.rx[m.e] || 0) + 1; cast(R, { t: 'react', e: m.e, n: R.rx[m.e] }); break;
      }
      case 'again': if (me.id === R.host && ['reveal', 'final'].includes(R.phase)) { sys(R, 'เล่นอีกรอบ ล้างโหวตแล้ว 🔁'); resetLobby(R); } break;
    }
  });
  ws.on('close', () => {
    if (!R || !me || me.ws !== ws || !R.P.has(me.id)) return;
    me.on = false;
    if (R.phase === 'lobby') { R.P.delete(me.id); sys(R, `${me.name} ออกจากห้อง`); } else sys(R, `${me.name} หลุดไป`);
    if (R.host === me.id) { const n = onl(R)[0]; if (n) { R.host = n.id; n.ready = true; sys(R, `${n.name} ได้เป็นโฮสต์ 👑`); } }
    if (!onl(R).length) { R.gc = setTimeout(() => { if (!onl(R).length) { clearTimeout(R.tm); rooms.delete(R.code); } }, 600000); return; }
    if (R.phase === 'play') {
      if (onl(R).length < 3) { sys(R, 'เหลือไม่ถึง 3 คน จบเกมไปเฉลยเลย'); cast(R, { t: 'err', msg: 'ผู้เล่นเหลือไม่ถึง 3 คน จบเกมไปหน้าเฉลย' }); return toReveal(R); }
      if (R.order.every(id => R.sub.has(id) || !R.P.get(id).on)) return endRound(R);
    }
    bc(R);
  });
});
srv.listen(PORT, () => console.log('DOODLE.EXE on :' + PORT));
