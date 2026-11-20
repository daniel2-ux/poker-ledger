import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import GooeyNav from './reactbits/GooeyNav.jsx';
import ClickSpark from './reactbits/ClickSpark.jsx';
import CountUp from './reactbits/CountUp.jsx';
import ShinyText from './reactbits/ShinyText.jsx';
import StarBorder from './reactbits/StarBorder.jsx';
import ElectricBorder from './reactbits/ElectricBorder.jsx';
import Starfield from './Starfield.jsx';
import {
  byNet, calc, cls, fmtDate, loadLocal, newId, norm, round2, saveLocal, signed, sortGames, summaryText, trimNum, validGame
} from './lib.js';
import { L, getLang, setLang, setCurrency } from './i18n.js';

const TABS = ['game', 'history', 'config'];

// The React Bits components take literal colors, so mirror the CSS tokens here.
const PALETTE = {
  dark: { accent: '#4dbd88', accentFg: '#07130c', gold: '#e8bb52', fg: '#e7efe9', win: '#62d49c', shine: '#ffffff' }
};

function useTab() {
  const read = () => {
    const h = (window.location.hash || '').slice(1);
    return TABS.includes(h) ? h : 'game';
  };
  const [tab, setTab] = useState(read);
  useEffect(() => {
    const on = () => setTab(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return tab;
}

function useCopy() {
  const [toast, setToast] = useState('');
  const [text, setText] = useState('');
  const copy = useCallback(async value => {
    setText(value);
    try {
      await navigator.clipboard.writeText(value);
      setToast(L().copied);
    } catch (e) {
      setToast(L().copyFail);
    }
  }, []);
  return { toast, text, copy };
}

/* ---------- small pieces ---------- */

// A number that counts from its previous value to the new one.
function Num({ value, prefix = '' }) {
  const v = round2(value);
  const prev = useRef(v);
  const from = prev.current;
  useEffect(() => {
    prev.current = v;
  }, [v]);
  return <CountUp key={v} from={from} to={v} duration={0.5} separator="," prefix={prefix} trigger="load" />;
}

function Rise({ i = 0, className, children, ...rest }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: Math.min(i, 12) * 0.045, duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

// Two taps to confirm: the viewer never sees a browser confirm() dialog on a home-screen app.
function Confirm({ label, armedLabel = L().confirmAgain, onConfirm, className = 'btn danger', ...rest }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={armed ? 'btn armed' : className}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
      {...rest}
    >
      {armed ? armedLabel : label}
    </button>
  );
}

function Cta({ pal, dark, children, ...rest }) {
  return (
    <StarBorder
      as="button"
      type="button"
      className="cta"
      theme={dark ? 'dark' : 'light'}
      color={pal.gold}
      backgroundColor={pal.accent}
      textColor={pal.accentFg}
      borderColor="transparent"
      thickness={2}
      radius={14}
      {...rest}
    >
      {children}
    </StarBorder>
  );
}

function Rate({ o }) {
  return (
    <>
      {L().rate[0]}<span className="num">{trimNum(o.handPoints)}</span>{L().rate[1]}<span className="num">{trimNum(o.handMoney)}</span>{L().rate[2]}
    </>
  );
}

function NameForm({ placeholder = L().newPlayer, button, onAdd }) {
  const [name, setName] = useState('');
  return (
    <form
      className="row"
      onSubmit={e => {
        e.preventDefault();
        const n = name.trim();
        if (!n) return;
        if (onAdd(n) !== false) setName('');
      }}
    >
      <input
        className="grow"
        type="text"
        maxLength={12}
        placeholder={placeholder}
        autoComplete="off"
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <button type="submit" className="btn">{button}</button>
    </form>
  );
}

function CopyBox({ toast, text }) {
  return (
    <>
      <div className="toast" role="status">{toast}</div>
      {text ? <textarea readOnly aria-label={L().summaryAria} value={text} onFocus={e => e.target.select()} /> : null}
    </>
  );
}

/* ---------- screens ---------- */

function Setup({ S, setS, pal, dark }) {
  const t = L();
  const [sel, setSel] = useState({});
  const picked = S.roster.filter(n => sel[n]);
  const start = () => {
    if (picked.length < 2) return;
    setS(s => ({
      ...s,
      current: {
        id: newId(),
        startedAt: Date.now(),
        handPoints: s.settings.handPoints,
        handMoney: s.settings.handMoney,
        phase: 'play',
        players: picked.map(name => ({ name, hands: 1, final: null }))
      }
    }));
  };
  return (
    <Rise className="panel">
      <h2>{t.newGame}</h2>
      <div className="muted"><Rate o={S.settings} />{t.setupHint}</div>
      {S.roster.length ? (
        <>
          <div className="muted">{t.pickHint}</div>
          <div className="chips">
            {S.roster.map(name => (
              <motion.button
                key={name}
                type="button"
                whileTap={{ scale: 0.92 }}
                className={'chip' + (sel[name] ? ' on' : '')}
                aria-pressed={!!sel[name]}
                onClick={() => setSel(x => ({ ...x, [name]: !x[name] }))}
              >
                {name}
              </motion.button>
            ))}
          </div>
        </>
      ) : (
        <div className="empty">{t.noPlayers}</div>
      )}
      <NameForm
        button={t.add}
        onAdd={n => {
          setS(s => (s.roster.includes(n) ? s : { ...s, roster: [...s.roster, n] }));
          setSel(x => ({ ...x, [n]: true }));
        }}
      />
      <Cta pal={pal} dark={dark} disabled={picked.length < 2} onClick={start}>
        {picked.length < 2 ? t.min2 : t.start(picked.length)}
      </Cta>
    </Rise>
  );
}

function Play({ S, setS, pal, dark }) {
  const t = L();
  const sym = S.settings.currency;
  const cur = S.current;
  const c = calc(cur);
  const upPlayers = fn => setS(s => ({ ...s, current: { ...s.current, players: fn(s.current.players) } }));
  const bump = (name, d) =>
    upPlayers(ps => ps.map(p => (p.name === name ? { ...p, hands: Math.max(0, p.hands + d) } : p)));
  const join = name => {
    if (cur.players.some(p => p.name === name)) return false;
    setS(s => ({
      ...s,
      roster: s.roster.includes(name) ? s.roster : [...s.roster, name],
      current: { ...s.current, players: [...s.current.players, { name, hands: 1, final: null }] }
    }));
    return true;
  };
  // Someone leaving early: record their stack now so it is already filled in at settlement.
  const [cash, setCash] = useState(null); // { name, draft }
  const cashValue = cash && cash.draft.trim() !== '' ? Math.round(Number(cash.draft)) : NaN;
  const cashOk = isFinite(cashValue) && cashValue >= 0;
  const cashOut = () => {
    if (!cashOk) return;
    upPlayers(ps => ps.map(p => (p.name === cash.name ? { ...p, final: cashValue, left: true } : p)));
    setCash(null);
  };
  const comeBack = name =>
    upPlayers(ps => ps.map(p => (p.name === name ? { ...p, final: null, left: false } : p)));
  const late = S.roster.filter(n => !cur.players.some(p => p.name === n));
  return (
    <>
      <section className="totals">
        <Rise i={0} className="total"><b><Num value={c.totalHands} /></b><span>{t.totHands}</span></Rise>
        <Rise i={1} className="total"><b><Num value={c.totalBuyPts} /></b><span>{t.totPts}</span></Rise>
        <Rise i={2} className="total"><b><Num value={c.bank} prefix={sym} /></b><span>{t.bankIn}</span></Rise>
      </section>
      <div className="muted">{fmtDate(cur.startedAt)}{t.started}<Rate o={cur} /></div>
      <section className="players">
        <AnimatePresence initial={true}>
          {cur.players.map((p, i) => (
            <motion.div
              key={p.name}
              layout
              className={'player' + (p.left ? ' left' : '')}
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ delay: Math.min(i, 10) * 0.04, duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <div>
                <div className="name">{p.name}</div>
                {p.left ? (
                  <div className="muted num">
                    {t.leftLine[0]}{trimNum(p.final)}{t.leftLine[1]}<span className={cls(p.final - p.hands * cur.handPoints)}>{signed(p.final - p.hands * cur.handPoints)}</span>
                  </div>
                ) : p.hands === 0 ? (
                  <div className="muted">{t.dealerPlay}</div>
                ) : null}
              </div>
              <div className="hands">
                <motion.span
                  key={p.hands}
                  className="hands-n"
                  initial={{ scale: 1.4, color: pal.gold }}
                  animate={{ scale: 1, color: pal.fg }}
                  transition={{ type: 'spring', stiffness: 520, damping: 16 }}
                >
                  {p.hands}
                </motion.span>
                <small>{t.handUnit}</small>
              </div>
              {cash && cash.name === p.name ? (
                <form className="btns cash" onSubmit={e => { e.preventDefault(); cashOut(); }}>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    autoFocus
                    placeholder={t.cashPh}
                    aria-label={t.cashAria(p.name)}
                    value={cash.draft}
                    onChange={e => setCash({ name: p.name, draft: e.target.value })}
                  />
                  <button type="submit" className="btn primary minus" disabled={!cashOk}>{t.ok}</button>
                  <button type="button" className="btn ghost minus" onClick={() => setCash(null)}>{t.cancel}</button>
                </form>
              ) : p.left ? (
                <div className="btns">
                  <button type="button" className="btn ghost minus" onClick={() => setCash({ name: p.name, draft: String(p.final) })}>{t.editChips}</button>
                  <button type="button" className="btn ghost minus" onClick={() => comeBack(p.name)}>{t.backIn}</button>
                </div>
              ) : (
              <div className="btns">
                <button type="button" className="btn ghost minus" aria-label={t.leaveAria(p.name)} onClick={() => setCash({ name: p.name, draft: '' })}>
                  {t.leave}
                </button>
                {p.hands <= 0 ? (
                  <Confirm
                    label={t.remove}
                    armedLabel={t.removeConfirm}
                    className="btn ghost minus"
                    aria-label={t.removeAria(p.name)}
                    onConfirm={() => upPlayers(ps => ps.filter(x => x.name !== p.name))}
                  />
                ) : (
                  <motion.button type="button" whileTap={{ scale: 0.9 }} className="btn ghost" aria-label={t.minusAria(p.name)} onClick={() => bump(p.name, -1)}>
                    −1
                  </motion.button>
                )}
                <motion.button type="button" whileTap={{ scale: 0.9 }} className="btn primary" aria-label={t.plusAria(p.name)} onClick={() => bump(p.name, 1)}>
                  +1
                </motion.button>
              </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </section>
      <Rise i={cur.players.length} className="panel">
        <h2>{t.lateJoin}</h2>
        {late.length ? (
          <div className="chips">
            {late.map(n => (
              <motion.button key={n} type="button" whileTap={{ scale: 0.92 }} className="chip" onClick={() => join(n)}>
                + {n}
              </motion.button>
            ))}
          </div>
        ) : null}
        <NameForm button={t.joinBtn} onAdd={join} />
      </Rise>
      <div className="row">
        <div className="grow">
          <Cta pal={pal} dark={dark} onClick={() => setS(s => ({ ...s, current: { ...s.current, phase: 'settle' } }))}>
            {t.endSettle}
          </Cta>
        </div>
        <Confirm label={t.voidGame} onConfirm={() => setS(s => ({ ...s, current: null }))} />
      </div>
    </>
  );
}

function Settle({ S, setS, onSave, pal, dark }) {
  const t = L();
  const sym = S.settings.currency;
  const cur = S.current;
  const c = calc(cur);
  const { toast, text, copy } = useCopy();
  const setFinal = (name, raw) => {
    const v = raw.trim();
    const n = v === '' ? null : Math.round(Number(v));
    const final = n === null || !isFinite(n) || n < 0 ? null : n;
    setS(s => ({
      ...s,
      current: { ...s.current, players: s.current.players.map(p => (p.name === name ? { ...p, final, left: final === null ? false : p.left } : p)) }
    }));
  };
  // Once every stack is in, the biggest winner's row gets the electric border.
  const top = c.allFilled ? Math.max(...c.rows.map(r => r.netPts)) : 0;
  let banner;
  if (!c.allFilled) {
    banner = (
      <div className="banner wait" role="status">
        {t.waitBanner(trimNum(c.totalFinal), trimNum(c.totalBuyPts))}
      </div>
    );
  } else if (c.diff === 0) {
    banner = (
      <motion.div className="banner ok" role="status" initial={{ scale: 0.96 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 14 }}>
        <ShinyText
          text={t.okBanner(trimNum(c.totalFinal), trimNum(c.totalPay))}
          color={pal.win}
          shineColor={pal.shine}
          speed={2.5}
        />
      </motion.div>
    );
  } else {
    banner = (
      <motion.div className="banner bad" role="status" initial={{ x: -8 }} animate={{ x: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 8 }}>
        {t.badBanner(c.diff, trimNum(Math.abs(c.diff)), trimNum(c.totalFinal), trimNum(c.totalBuyPts), true)}
      </motion.div>
    );
  }
  return (
    <>
      <h2>{t.settleTitle}</h2>
      <div className="muted"><Rate o={cur} /></div>
      <section className="settle">
        {c.rows.map((r, i) => (
          <Rise key={r.name} i={i} className="srow">
            <div>
              <div className="name">{r.name}</div>
              <div className="muted num">{r.hands === 0 ? t.dealerSettle : t.buyLine(r.hands, trimNum(r.buyMoney))}{cur.players[i].left ? t.leftTag : ''}</div>
            </div>
            <div>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                placeholder={t.finalChips}
                aria-label={t.finalAria(r.name)}
                value={r.filled ? r.final : ''}
                onChange={e => setFinal(r.name, e.target.value)}
              />
            </div>
            <div className="cell">
              <div className="lab">{t.net}</div>
              <div className={'val ' + (r.filled ? cls(r.netPts) : '')}>{r.filled ? signed(r.netPts) : '—'}</div>
              <div className="sub">{r.filled ? t.money(signed(r.netMoney)) : ''}</div>
            </div>
            <div className="cell pay">
              <div className="lab">{t.bankerPays}</div>
              <div className="val">{r.filled ? <Num value={r.pay} prefix={sym} /> : '—'}</div>
            </div>
            {top > 0 && r.netPts === top ? (
              <ElectricBorder className="zap" color={pal.gold} borderRadius={14} thickness={1.4} glow={0.7} interactive={false} />
            ) : null}
          </Rise>
        ))}
      </section>
      {banner}
      <div className="row">
        <div className="grow">
          <Cta pal={pal} dark={dark} disabled={!c.allFilled} onClick={() => c.allFilled && onSave(cur, c)}>
            {c.allFilled && c.diff !== 0 ? t.saveAnyway : t.saveRec}
          </Cta>
        </div>
        <button type="button" className="btn ghost" onClick={() => copy(summaryText(cur))}>{t.copySummary}</button>
        <button type="button" className="btn ghost" onClick={() => setS(s => ({ ...s, current: { ...s.current, phase: 'play' } }))}>
          {t.keepPlaying}
        </button>
      </div>
      <CopyBox toast={toast} text={text} />
    </>
  );
}

function GameTable({ g, sym }) {
  const t = L();
  const c = calc(g);
  return (
    <>
      <div className="tscroll">
        <table>
          <thead>
            <tr><th>{t.thPlayer}</th><th>{t.thHands}</th><th>{t.finalChips}</th><th>{t.net}</th><th>{t.thNetMoney}</th><th>{t.bankerPays}</th></tr>
          </thead>
          <tbody>
            {byNet(c.rows).map(r => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td className="num">{r.hands}</td>
                <td className="num">{trimNum(r.final ?? 0)}</td>
                <td className={'num ' + cls(r.netPts)}>{signed(r.netPts ?? 0)}</td>
                <td className={'num ' + cls(r.netPts)}>{signed(r.netMoney ?? 0)}</td>
                <td className="num">{sym}{trimNum(r.pay ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="muted">
        <Rate o={g} />{t.tableFoot(c.totalHands, trimNum(c.bank), trimNum(c.totalPay))}
        {c.diff !== 0 ? <span className="loss">{t.diffShort(c.diff, trimNum(Math.abs(c.diff)))}</span> : null}
      </div>
    </>
  );
}

// Fix a wrong number in a saved game: hands and final stack per player.
function GameEditor({ g, onSave, onCancel }) {
  const t = L();
  const [rows, setRows] = useState(() => g.players.map(p => ({ name: p.name, hands: String(p.hands), final: String(p.final ?? 0) })));
  const set = (i, key, v) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
  const parsed = rows.map(r => ({
    name: r.name,
    hands: r.hands.trim() === '' ? NaN : Number(r.hands),
    final: r.final.trim() === '' ? NaN : Math.round(Number(r.final))
  }));
  const ok = parsed.every(p => Number.isInteger(p.hands) && p.hands >= 0 && isFinite(p.final) && p.final >= 0);
  const c = ok ? calc({ ...g, players: parsed }) : null;
  return (
    <>
      <div className="tscroll">
        <table className="edit">
          <thead>
            <tr><th>{t.thPlayer}</th><th>{t.thHands}</th><th>{t.finalChips}</th><th>{t.net}</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const row = c ? c.rows[i] : null;
              return (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td><input type="number" inputMode="numeric" min="0" step="1" aria-label={t.handsAria(r.name)} value={r.hands} onChange={e => set(i, 'hands', e.target.value)} /></td>
                  <td><input type="number" inputMode="numeric" min="0" step="1" aria-label={t.finalAria(r.name)} value={r.final} onChange={e => set(i, 'final', e.target.value)} /></td>
                  <td className={'num ' + (row ? cls(row.netPts) : '')}>{row ? signed(row.netPts) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!ok ? (
        <div className="banner wait" role="status">{t.editInvalid}</div>
      ) : c.diff === 0 ? (
        <div className="banner ok" role="status">{t.editOk(trimNum(c.totalFinal))}</div>
      ) : (
        <div className="banner bad" role="status">
          {t.badBanner(c.diff, trimNum(Math.abs(c.diff)), trimNum(c.totalFinal), trimNum(c.totalBuyPts), false)}
        </div>
      )}
      <div className="row">
        <button type="button" className="btn primary" disabled={!ok} onClick={() => ok && onSave({ ...g, diff: c.diff, players: parsed })}>
          {t.saveEdit}
        </button>
        <button type="button" className="btn ghost" onClick={onCancel}>{t.cancel}</button>
      </div>
    </>
  );
}

function History({ G, setG, open, setOpen, sym }) {
  const t = L();
  const { toast, text, copy } = useCopy();
  const [editing, setEditing] = useState(null);
  const board = useMemo(() => {
    const tot = {};
    G.forEach(g =>
      calc(g).rows.forEach(r => {
        const t = tot[r.name] || (tot[r.name] = { name: r.name, money: 0, games: 0 });
        t.money += r.netMoney || 0;
        t.games++;
      })
    );
    return Object.values(tot).sort((a, b) => b.money - a.money);
  }, [G]);
  if (!G.length) {
    return (
      <Rise className="panel">
        <div className="empty">{t.noGames}</div>
      </Rise>
    );
  }
  return (
    <>
      <Rise className="panel">
        <h2>{t.board}</h2>
        <div className="tscroll">
          <table>
            <thead><tr><th>{t.thPlayer}</th><th>{t.thGames}</th><th>{t.thTotalNet}</th></tr></thead>
            <tbody>
              {board.map(t => (
                <tr key={t.name}>
                  <td>{t.name}</td>
                  <td className="num">{t.games}</td>
                  <td className={'num ' + cls(t.money)}>{signed(t.money)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Rise>
      <h2>{t.eachGame}</h2>
      <AnimatePresence initial={true}>
        {G.map((g, i) => {
          const c = calc(g);
          const isOpen = open === g.id;
          return (
            <motion.div
              key={g.id}
              layout
              className="game"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: Math.min(i + 1, 10) * 0.045, duration: 0.35 }}
            >
              <button type="button" className="head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : g.id)}>
                <span className="when num">{fmtDate(g.endedAt)}{t.gameHead(g.players.length, c.totalHands)}</span>
                <span className="nets">
                  {byNet(c.rows).map(r => (
                    <span key={r.name}>{r.name} <b className={'num ' + cls(r.netPts)}>{signed(r.netPts ?? 0)}</b></span>
                  ))}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    className="fold"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                  >
                    <div className="body">
                      {editing === g.id ? (
                        <GameEditor
                          g={g}
                          onCancel={() => setEditing(null)}
                          onSave={ng => {
                            setG(gs => gs.map(x => (x.id === ng.id ? ng : x)));
                            setEditing(null);
                          }}
                        />
                      ) : (
                      <>
                      <GameTable g={g} sym={sym} />
                      <div className="row">
                        <button type="button" className="btn ghost" onClick={() => setEditing(g.id)}>{t.editData}</button>
                        <button type="button" className="btn ghost" onClick={() => copy(summaryText(g))}>{t.copySummary}</button>
                        <Confirm
                          label={t.delGame}
                          onConfirm={() => {
                            setOpen(null);
                            setG(gs => gs.filter(x => x.id !== g.id));
                          }}
                        />
                      </div>
                      <CopyBox toast={toast} text={text} />
                      </>
                      )}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </>
  );
}

function SettingNumber({ id, label, value, onCommit, decimal }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        inputMode={decimal ? 'decimal' : 'numeric'}
        min="0"
        step="any"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          const n = Number(draft);
          if (isFinite(n) && n > 0) onCommit(n);
          else {
            setDraft(String(value));
            onCommit(null);
          }
        }}
      />
    </div>
  );
}

function Config({ S, setS, G, setG }) {
  const t = L();
  const [toast, setToast] = useState('');
  const [box, setBox] = useState('');
  const setSetting = key => n => {
    if (n === null) return setToast(t.needPositive);
    if (n === S.settings[key]) return undefined;
    setS(s => ({ ...s, settings: { ...s.settings, [key]: n } }));
    return setToast(t.savedNext);
  };
  const exportAll = async () => {
    const text = JSON.stringify({ app: 'poker-ledger', version: 1, exportedAt: Date.now(), state: S, games: G });
    setBox(text);
    try {
      await navigator.clipboard.writeText(text);
      setToast(t.exported(G.length));
    } catch (e) {
      setToast(t.longPress);
    }
  };
  const importAll = () => {
    try {
      const d = JSON.parse(box);
      if (!d || !d.state || !Array.isArray(d.games)) throw new Error('shape');
      const games = sortGames(d.games.filter(validGame));
      setS(norm(d.state));
      setG(games);
      setBox('');
      setToast(t.restored(games.length));
    } catch (e) {
      setToast(t.badBackup);
    }
  };
  return (
    <>
      <Rise i={0} className="panel">
        <h2>{t.ratio}</h2>
        <div className="row">
          <SettingNumber id="set-points" label={t.ptsPer} value={S.settings.handPoints} onCommit={setSetting('handPoints')} />
          <SettingNumber id="set-money" label={t.moneyPer} value={S.settings.handMoney} onCommit={setSetting('handMoney')} decimal />
        </div>
        <div className="muted">{t.ratioHint}</div>
        <h2>{t.currency}</h2>
        <div className="chips">
          {['¥', '$', '€', '£'].map(c => (
            <button
              key={c}
              type="button"
              className={'chip num' + (S.settings.currency === c ? ' on' : '')}
              aria-pressed={S.settings.currency === c}
              onClick={() => setS(s => ({ ...s, settings: { ...s.settings, currency: c } }))}
            >
              {c}
            </button>
          ))}
          <input
            className="cur-other"
            type="text"
            maxLength={4}
            placeholder={t.currencyOther}
            aria-label={t.currencyOther}
            value={['¥', '$', '€', '£'].includes(S.settings.currency) ? '' : S.settings.currency}
            onChange={e => setS(s => ({ ...s, settings: { ...s.settings, currency: e.target.value.trim() || '¥' } }))}
          />
        </div>
        <div className="muted">{t.currencyHint}</div>
      </Rise>
      <Rise i={1} className="panel">
        <h2>{t.roster}</h2>
        {S.roster.length ? (
          <>
            <div className="muted">{t.rosterHint}</div>
            <div className="chips">
              {S.roster.map(name => (
                <Confirm
                  key={name}
                  className="chip"
                  label={<>{name}<span className="x" aria-hidden="true">×</span></>}
                  armedLabel={t.delName(name)}
                  onConfirm={() => setS(s => ({ ...s, roster: s.roster.filter(x => x !== name) }))}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="muted">{t.rosterEmpty}</div>
        )}
        <NameForm button={t.add} onAdd={n => setS(s => (s.roster.includes(n) ? s : { ...s, roster: [...s.roster, n] }))} />
      </Rise>
      <Rise i={2} className="panel">
        <h2>{t.backup}</h2>
        <div className="muted">{t.backupHint}</div>
        <div className="row"><button type="button" className="btn" onClick={exportAll}>{t.exportAll}</button></div>
        <textarea
          aria-label={t.backupAria}
          placeholder={t.backupPh}
          value={box}
          onChange={e => setBox(e.target.value)}
        />
        <div className="row"><Confirm label={t.overwrite} onConfirm={importAll} /></div>
        <div className="toast" role="status">{toast}</div>
      </Rise>
    </>
  );
}

/* ---------- app ---------- */

export default function App() {
  const initial = useMemo(loadLocal, []);
  const [S, setS] = useState(initial.state);
  const [G, setG] = useState(initial.games);
  const [open, setOpen] = useState(null);
  const tab = useTab();
  const [lang, setLangState] = useState(getLang);
  setCurrency(S.settings.currency); // before any string is built this render
  const t = L();
  useEffect(() => {
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    document.title = t.title;
  }, [lang, t]);
  const toggleLang = () => {
    const next = lang === 'en' ? 'zh' : 'en';
    setLang(next);
    setLangState(next);
  };
  const dark = true; // single dark look, see app.css
  const pal = PALETTE.dark;

  useEffect(() => saveLocal(S, G), [S, G]);

  const onSave = (cur, c) => {
    const g = {
      id: cur.id,
      startedAt: cur.startedAt,
      endedAt: Date.now(),
      handPoints: cur.handPoints,
      handMoney: cur.handMoney,
      diff: c.diff,
      players: cur.players.map(p => ({ name: p.name, hands: p.hands, final: p.final }))
    };
    setG(gs => sortGames([g, ...gs.filter(x => x.id !== g.id)]));
    setS(s => ({ ...s, current: null }));
    setOpen(g.id);
    window.location.hash = '#history';
  };

  let screen;
  let screenKey = tab;
  if (tab === 'history') screen = <History G={G} setG={setG} open={open} setOpen={setOpen} sym={S.settings.currency} />;
  else if (tab === 'config') screen = <Config S={S} setS={setS} G={G} setG={setG} />;
  else if (!S.current) {
    screenKey = 'setup';
    screen = <Setup S={S} setS={setS} pal={pal} dark={dark} />;
  } else if (S.current.phase === 'settle') {
    screenKey = 'settle';
    screen = <Settle S={S} setS={setS} onSave={onSave} pal={pal} dark={dark} />;
  } else {
    screenKey = 'play';
    screen = <Play S={S} setS={setS} pal={pal} dark={dark} />;
  }

  return (
    <MotionConfig reducedMotion="user">
      <Starfield />
      <ClickSpark sparkColor={pal.gold} sparkCount={10} sparkSize={13} sparkRadius={34} sparkWidth={3} glow={0.5} style={{ minHeight: '100%' }}>
        <div className="wrap">
          <header>
            <div>
              <h1><ShinyText key={lang} text={t.title} color={pal.fg} shineColor={pal.shine} speed={3} delay={2} /></h1>
              <div className="sync">{t.local}</div>
            </div>
            <div className="head-right">
            <button type="button" className="btn ghost lang" aria-label={t.switchAria} onClick={toggleLang}>{t.switchTo}</button>
            <GooeyNav
              key={lang}
              items={t.nav.map(label => ({ label }))}
              activeIndex={TABS.indexOf(tab)}
              onChange={i => { window.location.hash = '#' + TABS[i]; }}
              theme={dark ? 'dark' : 'light'}
              color={pal.accent}
              activeTextColor={pal.accentFg}
              size="lg"
            />
            </div>
          </header>
          <main key={screenKey + lang}>{screen}</main>
        </div>
      </ClickSpark>
    </MotionConfig>
  );
}
