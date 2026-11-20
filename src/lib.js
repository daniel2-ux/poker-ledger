// Pure logic: formatting, the settlement maths, and local storage.

import { L } from './i18n.js';

export const LS_KEY = 'poker-ledger-v1';

export const DEFAULT_STATE = { settings: { handPoints: 1000, handMoney: 200, currency: '¥' }, roster: [], current: null };

export const clone = o => JSON.parse(JSON.stringify(o));
export const round2 = n => Math.round(n * 100) / 100;
export const newId = () => 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const pad = n => (n < 10 ? '0' : '') + n;
export function fmtDate(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export const trimNum = n => round2(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
export const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + trimNum(Math.abs(n));
export const cls = n => (n > 0 ? 'win' : n < 0 ? 'loss' : '');

export function norm(d) {
  d = d || {};
  const st = d.settings || {};
  return {
    settings: {
      handPoints: +st.handPoints > 0 ? +st.handPoints : 1000,
      handMoney: +st.handMoney > 0 ? +st.handMoney : 200,
      currency: typeof st.currency === 'string' && st.currency.trim() ? st.currency.trim().slice(0, 4) : '¥'
    },
    roster: Array.isArray(d.roster) ? d.roster.map(String) : [],
    current: d.current && Array.isArray(d.current.players) ? clone(d.current) : null
  };
}

export const validGame = g => g && typeof g.id === 'string' && Array.isArray(g.players);
export const sortGames = games => games.slice().sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));

// 净利润(积分) = 最终积分 − 手数 × 一手积分
// Banker 应转(元) = 最终积分 ÷ 一手积分 × 一手金额（买入的钱 Banker 已经收过了）
export function calc(game) {
  const hp = game.handPoints;
  const hm = game.handMoney;
  const rate = hm / hp;
  const rows = game.players.map(p => {
    const filled = typeof p.final === 'number' && isFinite(p.final);
    const buyPts = p.hands * hp;
    return {
      name: p.name,
      hands: p.hands,
      final: filled ? p.final : null,
      filled,
      buyPts,
      buyMoney: p.hands * hm,
      netPts: filled ? p.final - buyPts : null,
      netMoney: filled ? (p.final - buyPts) * rate : null,
      pay: filled ? p.final * rate : null
    };
  });
  let totalHands = 0;
  let totalFinal = 0;
  let allFilled = rows.length > 0;
  rows.forEach(r => {
    totalHands += r.hands;
    if (r.filled) totalFinal += r.final;
    else allFilled = false;
  });
  return {
    rows,
    totalHands,
    totalBuyPts: totalHands * hp,
    bank: totalHands * hm,
    totalFinal,
    allFilled,
    diff: totalFinal - totalHands * hp,
    totalPay: totalFinal * rate
  };
}

export const byNet = rows => rows.slice().sort((a, b) => (b.netPts || 0) - (a.netPts || 0));

export function summaryText(game) {
  const c = calc(game);
  const t = L();
  const lines = [
    t.sumTitle + fmtDate(game.endedAt || game.startedAt),
    t.sumRate(trimNum(game.handPoints), trimNum(game.handMoney)),
    ''
  ];
  byNet(c.rows).forEach(r => {
    lines.push(
      t.sumRow(r.name, r.hands, r.filled ? trimNum(r.final) : '?') +
        (r.filled ? t.sumRowNet(signed(r.netPts), signed(r.netMoney), trimNum(r.pay)) : '')
    );
  });
  lines.push('', t.sumTotal(c.totalHands, trimNum(c.bank), trimNum(c.totalPay)));
  if (c.allFilled && c.diff !== 0) lines.push(t.sumDiff(c.diff, trimNum(Math.abs(c.diff))));
  return lines.join('\n');
}

export function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      return { state: norm(d.state), games: Array.isArray(d.games) ? sortGames(d.games.filter(validGame)) : [] };
    }
  } catch (e) {
    /* storage unavailable or corrupt: start empty */
  }
  return { state: clone(DEFAULT_STATE), games: [] };
}

export function saveLocal(state, games) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ state, games }));
  } catch (e) {
    /* storage unavailable */
  }
}
