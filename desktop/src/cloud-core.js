/*
 * 말랑메모 클라우드 동기화 엔진 (PC 앱과 모바일 웹앱이 같이 씀)
 *
 * 보안 방식
 *  - 비밀번호에서 PBKDF2(SHA-256, 31만 번)로 64바이트를 만들어
 *    앞 32바이트는 "로그인 비밀값", 뒤 32바이트는 "메모 잠금 열쇠"로 씁니다.
 *  - 서버에는 로그인 비밀값만 가고, 원래 비밀번호와 잠금 열쇠는 기기 밖으로 나가지 않습니다.
 *  - 메모·일정 내용은 AES-256-GCM으로 잠근 뒤 올라가서, 서버에는 알아볼 수 없는 암호문만 저장됩니다.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MallangCloud = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CONFIG = {
    url: 'https://omdyyvqkxxigilxjysbz.supabase.co',
    key: 'sb_publishable_g41wwhIMN19UchPheU9Vvg_lAHjnZNf',
    emailDomain: 'mallang.invalid',
    iterations: 310000
  };

  const subtle = () => globalThis.crypto.subtle;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function toHex(bytes) {
    let s = '';
    for (const b of bytes) s += (b < 16 ? '0' : '') + b.toString(16);
    return s;
  }
  function toB64(bytes) {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function fromB64(str) {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(str, 'base64'));
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  const normUser = (u) => String(u || '').trim().toLowerCase();
  const validUser = (u) => /^[a-z0-9_]{3,20}$/.test(normUser(u));

  // 비밀번호 → { secret: 로그인 비밀값(hex), keyRaw: 잠금 열쇠(32바이트) }
  async function deriveKeys(username, password) {
    const base = await subtle().importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await subtle().deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('mallang-memo/v1/' + normUser(username)), iterations: CONFIG.iterations },
      base, 512
    ));
    return { secret: toHex(bits.slice(0, 32)), keyRaw: bits.slice(32, 64) };
  }

  function importKey(raw, extractable) {
    return subtle().importKey('raw', raw, { name: 'AES-GCM' }, !!extractable, ['encrypt', 'decrypt']);
  }

  async function encrypt(key, obj) {
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj))));
    const all = new Uint8Array(12 + ct.length);
    all.set(iv, 0);
    all.set(ct, 12);
    return 'v1:' + toB64(all);
  }
  async function decrypt(key, str) {
    if (typeof str !== 'string' || !str.startsWith('v1:')) throw new Error('bad_cipher');
    const all = fromB64(str.slice(3));
    const pt = await subtle().decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, key, all.slice(12));
    return JSON.parse(dec.decode(pt));
  }

  // ───────── 서버 통신 ─────────
  class CloudError extends Error {
    constructor(code, status) { super(code); this.code = code; this.status = status || 0; }
  }

  async function call(path, opts) {
    let res;
    try {
      res = await fetch(CONFIG.url + path, {
        ...opts,
        headers: { apikey: CONFIG.key, 'Content-Type': 'application/json', ...(opts && opts.headers) }
      });
    } catch (e) {
      throw new CloudError('offline');
    }
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
    if (!res.ok) {
      const code = (body && (body.error_code || body.code || body.error)) || 'http_' + res.status;
      throw new CloudError(String(code), res.status);
    }
    return body;
  }

  function toSession(t) {
    return {
      access: t.access_token,
      refresh: t.refresh_token,
      exp: Date.now() + (Number(t.expires_in) || 3600) * 1000,
      userId: t.user && t.user.id
    };
  }

  async function signup(username, secret) {
    const r = await call('/rest/v1/rpc/mallang_signup', {
      method: 'POST', body: JSON.stringify({ p_username: normUser(username), p_secret: secret })
    });
    if (!r || !r.ok) throw new CloudError((r && r.error) || 'signup_failed');
    return r;
  }

  async function login(username, secret) {
    try {
      const t = await call('/auth/v1/token?grant_type=password', {
        method: 'POST', body: JSON.stringify({ email: normUser(username) + '@' + CONFIG.emailDomain, password: secret })
      });
      return toSession(t);
    } catch (e) {
      if (e.status === 400 || e.status === 401) throw new CloudError('wrong_login', e.status);
      throw e;
    }
  }

  async function refresh(session) {
    const t = await call('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', body: JSON.stringify({ refresh_token: session.refresh })
    });
    return toSession(t);
  }

  // 로그인 유지: 만료가 가까우면 새로 받고, 401이면 한 번 갱신 후 다시 시도
  async function authed(holder, path, opts) {
    if (!holder.session) throw new CloudError('signed_out');
    if (holder.session.exp - Date.now() < 60000) {
      try {
        holder.session = await refresh(holder.session);
        if (holder.onSession) holder.onSession(holder.session);
      } catch (e) {
        if (e.status === 400 || e.status === 401) throw new CloudError('session_expired', e.status);
        throw e;
      }
    }
    const go = () => call(path, { ...opts, headers: { Authorization: 'Bearer ' + holder.session.access, ...(opts && opts.headers) } });
    try {
      return await go();
    } catch (e) {
      if (e.status !== 401) throw e;
      try {
        holder.session = await refresh(holder.session);
        if (holder.onSession) holder.onSession(holder.session);
      } catch (e2) {
        throw new CloudError('session_expired', 401);
      }
      return go();
    }
  }

  async function pull(holder, sinceIso) {
    const out = [];
    let since = sinceIso || '1970-01-01T00:00:00Z';
    for (let page = 0; page < 50; page++) {
      const q = '/rest/v1/mallang_items?select=kind,item_id,data,deleted,client_ts,updated_at' +
        '&updated_at=gte.' + encodeURIComponent(since) + '&order=updated_at.asc&limit=500';
      const rows = await authed(holder, q, { method: 'GET' });
      if (!Array.isArray(rows) || !rows.length) break;
      out.push(...rows);
      if (rows.length < 500) break;
      since = rows[rows.length - 1].updated_at;
    }
    return out;
  }

  async function push(holder, rows) {
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100).map((r) => ({ ...r, user_id: holder.session.userId }));
      await authed(holder, '/rest/v1/mallang_items?on_conflict=user_id,kind,item_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(chunk)
      });
    }
  }

  // ───────── 회사 공통 자료 (연락망): 가입자 누구나 읽기, 관리자만 쓰기 ─────────
  async function getShared(holder, id) {
    const rows = await authed(holder, '/rest/v1/mallang_shared?id=eq.' + encodeURIComponent(id) + '&select=data,updated_at', { method: 'GET' });
    return Array.isArray(rows) && rows[0] ? { data: rows[0].data, updatedAt: rows[0].updated_at } : null;
  }
  async function putShared(holder, id, data) {
    await authed(holder, '/rest/v1/mallang_shared?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ id, data }])
    });
  }
  async function isAdmin(holder) {
    const rows = await authed(holder, '/rest/v1/mallang_admins?select=user_id', { method: 'GET' });
    return Array.isArray(rows) && rows.length > 0;
  }

  /*
   * 한 번 맞추기
   *  ctx.holder   : { session, onSession }
   *  ctx.key      : 잠금 열쇠 (CryptoKey)
   *  ctx.cursor   : 마지막으로 받은 시각 (ISO)
   *  ctx.localTs(kind, id)      → 이 기기에 있는 항목의 수정 시각 (없으면 0)
   *  ctx.apply(item)            → 서버 쪽이 더 새것일 때 이 기기에 반영
   *                               item = { kind, id, ts, deleted, data }
   *  ctx.dirty()                → 올려야 할 항목 [{ kind, id, ts, deleted, data }]
   *  ctx.pushed(kind, id, ts)   → 올리기 성공 (그 사이 또 바뀌지 않았으면 깨끗함 표시)
   *  돌려주는 값: 새 cursor
   */
  async function syncOnce(ctx) {
    const rows = await pull(ctx.holder, ctx.cursor ? new Date(Date.parse(ctx.cursor) - 15000).toISOString() : null);
    let cursor = ctx.cursor || null;
    let applied = 0;
    for (const r of rows) {
      if (!cursor || r.updated_at > cursor) cursor = r.updated_at;
      const ts = Number(r.client_ts) || 0;
      if (ts <= ctx.localTs(r.kind, r.item_id)) continue;
      let data = null;
      if (!r.deleted) {
        try { data = await decrypt(ctx.key, r.data); } catch (e) { continue; }
      }
      ctx.apply({ kind: r.kind, id: r.item_id, ts, deleted: !!r.deleted, data });
      applied++;
    }
    const dirty = ctx.dirty();
    if (dirty.length) {
      const rowsOut = [];
      for (const d of dirty) {
        rowsOut.push({
          kind: d.kind, item_id: d.id, client_ts: d.ts, deleted: !!d.deleted,
          data: d.deleted ? null : await encrypt(ctx.key, d.data)
        });
      }
      await push(ctx.holder, rowsOut);
      for (const d of dirty) ctx.pushed(d.kind, d.id, d.ts);
    }
    return { cursor, applied, pushed: dirty.length };
  }

  const MESSAGES = {
    offline: '인터넷에 연결되어 있지 않아요',
    taken: '이미 쓰고 있는 아이디예요',
    invalid_username: '아이디는 영어 소문자·숫자·밑줄(_)로 3~20자예요',
    invalid_secret: '비밀번호를 다시 입력해 주세요',
    busy: '가입이 많아요. 잠시 후 다시 해 주세요',
    wrong_login: '아이디 또는 비밀번호가 맞지 않아요',
    session_expired: '로그인이 풀렸어요. 다시 로그인해 주세요',
    signed_out: '로그인이 필요해요',
    over_request_rate_limit: '시도가 너무 많아요. 잠시 후 다시 해 주세요'
  };
  const message = (e) => MESSAGES[e && e.code] || '서버와 연결하지 못했어요 (' + ((e && e.code) || '알 수 없음') + ')';

  const uid = () => (globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID() : toHex(globalThis.crypto.getRandomValues(new Uint8Array(16))));

  return { getShared, putShared, isAdmin, CONFIG, deriveKeys, importKey, encrypt, decrypt, signup, login, refresh, pull, push, syncOnce, message, normUser, validUser, uid, toB64, fromB64, CloudError };
});
