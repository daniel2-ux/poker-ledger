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

const TABS = ['game', 'history', 'config'];
const NAV_ITEMS = [{ label: '牌局' }, { label: '记录' }, { label: '设置' }];

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
      setToast('已复制，可以直接粘贴到群里');
    } catch (e) {
      setToast('自动复制没成功，请长按下面的文字手动复制');
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
function Confirm({ label, armedLabel = '再点一次确认', onConfirm, className = 'btn danger', ...rest }) {
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
      一手 <span className="num">{trimNum(o.handPoints)}</span> 积分 = <span className="num">{trimNum(o.handMoney)}</span> 元
    </>
  );
}

function NameForm({ placeholder = '新玩家名字', button, onAdd }) {
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
      {text ? <textarea readOnly aria-label="结算文字" value={text} onFocus={e => e.target.select()} /> : null}
    </>
  );
}

/* ---------- screens ---------- */

function Setup({ S, setS, pal, dark }) {
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
      <h2>开新局</h2>
      <div className="muted"><Rate o={S.settings} />，每人开局自动记 1 手。</div>
      {S.roster.length ? (
        <>
          <div className="muted">点名字选今天上桌的人</div>
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
        <div className="empty">还没有玩家。在下面输入名字，添加今天上桌的人，名单会记住，下次直接点选。</div>
      )}
      <NameForm
        button="添加"
        onAdd={n => {
          setS(s => (s.roster.includes(n) ? s : { ...s, roster: [...s.roster, n] }));
          setSel(x => ({ ...x, [n]: true }));
        }}
      />
      <Cta pal={pal} dark={dark} disabled={picked.length < 2} onClick={start}>
        {picked.length < 2 ? '至少选 2 人' : `开始，${picked.length} 人上桌`}
      </Cta>
    </Rise>
  );
}

function Play({ S, setS, pal, dark }) {
  const cur = S.current;
  const c = calc(cur);
  const upPlayers = fn => setS(s => ({ ...s, current: { ...s.current, players: fn(s.current.players) } }));
  const bump = (name, d) =>
    upPlayers(ps => ps.map(p => (p.name === name ? { ...p, hands: Math.max(1, p.hands + d) } : p)));
  const join = name => {
    if (cur.players.some(p => p.name === name)) return false;
    setS(s => ({
      ...s,
      roster: s.roster.includes(name) ? s.roster : [...s.roster, name],
      current: { ...s.current, players: [...s.current.players, { name, hands: 1, final: null }] }
    }));
    return true;
  };
  const late = S.roster.filter(n => !cur.players.some(p => p.name === n));
  return (
    <>
      <section className="totals">
        <Rise i={0} className="total"><b><Num value={c.totalHands} /></b><span>全场买入手数</span></Rise>
        <Rise i={1} className="total"><b><Num value={c.totalBuyPts} /></b><span>桌上总积分</span></Rise>
        <Rise i={2} className="total"><b><Num value={c.bank} prefix="¥" /></b><span>Banker 已收</span></Rise>
      </section>
      <div className="muted">{fmtDate(cur.startedAt)} 开局 · <Rate o={cur} /></div>
      <section className="players">
        <AnimatePresence initial={true}>
          {cur.players.map((p, i) => (
            <motion.div
              key={p.name}
              layout
              className="player"
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ delay: Math.min(i, 10) * 0.04, duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <div className="name">{p.name}</div>
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
                <small>手</small>
              </div>
              <div className="btns">
                {p.hands <= 1 ? (
                  <Confirm
                    label="移除"
                    armedLabel="确认移除"
                    className="btn ghost minus"
                    aria-label={`移除 ${p.name}`}
                    onConfirm={() => upPlayers(ps => ps.filter(x => x.name !== p.name))}
                  />
                ) : (
                  <motion.button type="button" whileTap={{ scale: 0.9 }} className="btn ghost" aria-label={`${p.name} 减一手`} onClick={() => bump(p.name, -1)}>
                    −1
                  </motion.button>
                )}
                <motion.button type="button" whileTap={{ scale: 0.9 }} className="btn primary" aria-label={`${p.name} 加一手`} onClick={() => bump(p.name, 1)}>
                  +1
                </motion.button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </section>
      <Rise i={cur.players.length} className="panel">
        <h2>中途加人</h2>
        {late.length ? (
          <div className="chips">
            {late.map(n => (
              <motion.button key={n} type="button" whileTap={{ scale: 0.92 }} className="chip" onClick={() => join(n)}>
                + {n}
              </motion.button>
            ))}
          </div>
        ) : null}
        <NameForm button="加入，记 1 手" onAdd={join} />
      </Rise>
      <div className="row">
        <div className="grow">
          <Cta pal={pal} dark={dark} onClick={() => setS(s => ({ ...s, current: { ...s.current, phase: 'settle' } }))}>
            结束并结算
          </Cta>
        </div>
        <Confirm label="作废本局" onConfirm={() => setS(s => ({ ...s, current: null }))} />
      </div>
    </>
  );
}

function Settle({ S, setS, onSave, pal, dark }) {
  const cur = S.current;
  const c = calc(cur);
  const { toast, text, copy } = useCopy();
  const setFinal = (name, raw) => {
    const v = raw.trim();
    const n = v === '' ? null : Math.round(Number(v));
    const final = n === null || !isFinite(n) || n < 0 ? null : n;
    setS(s => ({
      ...s,
      current: { ...s.current, players: s.current.players.map(p => (p.name === name ? { ...p, final } : p)) }
    }));
  };
  // Once every stack is in, the biggest winner's row gets the electric border.
  const top = c.allFilled ? Math.max(...c.rows.map(r => r.netPts)) : 0;
  let banner;
  if (!c.allFilled) {
    banner = (
      <div className="banner wait" role="status">
        已填 {trimNum(c.totalFinal)} / 总买入 {trimNum(c.totalBuyPts)} 积分，还有人没填
      </div>
    );
  } else if (c.diff === 0) {
    banner = (
      <motion.div className="banner ok" role="status" initial={{ scale: 0.96 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 14 }}>
        <ShinyText
          text={`对上了：最终积分合计 ${trimNum(c.totalFinal)}，等于总买入。Banker 共转出 ¥${trimNum(c.totalPay)}`}
          color={pal.win}
          shineColor={pal.shine}
          speed={2.5}
        />
      </motion.div>
    );
  } else {
    banner = (
      <motion.div className="banner bad" role="status" initial={{ x: -8 }} animate={{ x: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 8 }}>
        对不上：筹码{c.diff > 0 ? '多了 ' : '少了 '}{trimNum(Math.abs(c.diff))} 积分（合计 {trimNum(c.totalFinal)}，总买入 {trimNum(c.totalBuyPts)}）。请重新数一下，或检查买入手数
      </motion.div>
    );
  }
  return (
    <>
      <h2>结算：填每个人最后的积分</h2>
      <div className="muted"><Rate o={cur} /></div>
      <section className="settle">
        {c.rows.map((r, i) => (
          <Rise key={r.name} i={i} className="srow">
            <div>
              <div className="name">{r.name}</div>
              <div className="muted num">买 {r.hands} 手 · ¥{trimNum(r.buyMoney)}</div>
            </div>
            <div>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                placeholder="最终积分"
                aria-label={`${r.name} 最终积分`}
                value={r.filled ? r.final : ''}
                onChange={e => setFinal(r.name, e.target.value)}
              />
            </div>
            <div className="cell">
              <div className="lab">净利润</div>
              <div className={'val ' + (r.filled ? cls(r.netPts) : '')}>{r.filled ? signed(r.netPts) : '—'}</div>
              <div className="sub">{r.filled ? signed(r.netMoney) + ' 元' : ''}</div>
            </div>
            <div className="cell pay">
              <div className="lab">Banker 应转</div>
              <div className="val">{r.filled ? <Num value={r.pay} prefix="¥" /> : '—'}</div>
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
            {c.allFilled && c.diff !== 0 ? '差额照记，仍然保存' : '保存到记录'}
          </Cta>
        </div>
        <button type="button" className="btn ghost" onClick={() => copy(summaryText(cur))}>复制结算文字</button>
        <button type="button" className="btn ghost" onClick={() => setS(s => ({ ...s, current: { ...s.current, phase: 'play' } }))}>
          返回继续打
        </button>
      </div>
      <CopyBox toast={toast} text={text} />
    </>
  );
}

function GameTable({ g }) {
  const c = calc(g);
  return (
    <>
      <div className="tscroll">
        <table>
          <thead>
            <tr><th>玩家</th><th>买入手数</th><th>最终积分</th><th>净利润</th><th>净利润（元）</th><th>Banker 应转</th></tr>
          </thead>
          <tbody>
            {byNet(c.rows).map(r => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td className="num">{r.hands}</td>
                <td className="num">{trimNum(r.final ?? 0)}</td>
                <td className={'num ' + cls(r.netPts)}>{signed(r.netPts ?? 0)}</td>
                <td className={'num ' + cls(r.netPts)}>{signed(r.netMoney ?? 0)}</td>
                <td className="num">¥{trimNum(r.pay ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="muted">
        <Rate o={g} /> · 共 {c.totalHands} 手 · Banker 收 ¥{trimNum(c.bank)}，转出 ¥{trimNum(c.totalPay)}
        {c.diff !== 0 ? <span className="loss"> · 筹码{c.diff > 0 ? '多 ' : '少 '}{trimNum(Math.abs(c.diff))} 积分</span> : null}
      </div>
    </>
  );
}

function History({ G, setG, open, setOpen }) {
  const { toast, text, copy } = useCopy();
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
        <div className="empty">还没有比赛记录。打完一局并保存结算后，会出现在这里，还会有每个人的累计输赢榜。</div>
      </Rise>
    );
  }
  return (
    <>
      <Rise className="panel">
        <h2>累计输赢榜</h2>
        <div className="tscroll">
          <table>
            <thead><tr><th>玩家</th><th>场数</th><th>累计净利润（元）</th></tr></thead>
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
      <h2>每场记录</h2>
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
                <span className="when num">{fmtDate(g.endedAt)} · {g.players.length} 人 · {c.totalHands} 手</span>
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
                      <GameTable g={g} />
                      <div className="row">
                        <button type="button" className="btn ghost" onClick={() => copy(summaryText(g))}>复制结算文字</button>
                        <Confirm
                          label="删除这场记录"
                          onConfirm={() => {
                            setOpen(null);
                            setG(gs => gs.filter(x => x.id !== g.id));
                          }}
                        />
                      </div>
                      <CopyBox toast={toast} text={text} />
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
  const [toast, setToast] = useState('');
  const [box, setBox] = useState('');
  const setSetting = key => n => {
    if (n === null) return setToast('请输入大于 0 的数字');
    if (n === S.settings[key]) return undefined;
    setS(s => ({ ...s, settings: { ...s.settings, [key]: n } }));
    return setToast('已保存，下一局开始生效');
  };
  const exportAll = async () => {
    const text = JSON.stringify({ app: 'poker-ledger', version: 1, exportedAt: Date.now(), state: S, games: G });
    setBox(text);
    try {
      await navigator.clipboard.writeText(text);
      setToast(`已复制备份文字，共 ${G.length} 场记录`);
    } catch (e) {
      setToast('请长按框里的文字手动复制');
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
      setToast(`已恢复，共 ${games.length} 场记录`);
    } catch (e) {
      setToast('这段文字不是有效的备份，没有改动任何数据');
    }
  };
  return (
    <>
      <Rise i={0} className="panel">
        <h2>换算比例</h2>
        <div className="row">
          <SettingNumber id="set-points" label="一手多少积分" value={S.settings.handPoints} onCommit={setSetting('handPoints')} />
          <SettingNumber id="set-money" label="一手多少元" value={S.settings.handMoney} onCommit={setSetting('handMoney')} decimal />
        </div>
        <div className="muted">修改后只影响之后新开的比赛。进行中的这一局和历史记录保持当时的比例。</div>
      </Rise>
      <Rise i={1} className="panel">
        <h2>常用玩家</h2>
        {S.roster.length ? (
          <>
            <div className="muted">点名字两次可从名单里删除，不影响历史记录</div>
            <div className="chips">
              {S.roster.map(name => (
                <Confirm
                  key={name}
                  className="chip"
                  label={<>{name}<span className="x" aria-hidden="true">×</span></>}
                  armedLabel={`确认删除 ${name}`}
                  onConfirm={() => setS(s => ({ ...s, roster: s.roster.filter(x => x !== name) }))}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="muted">名单是空的</div>
        )}
        <NameForm button="添加" onAdd={n => setS(s => (s.roster.includes(n) ? s : { ...s, roster: [...s.roster, n] }))} />
      </Rise>
      <Rise i={2} className="panel">
        <h2>备份与恢复</h2>
        <div className="muted">导出会生成一段文字，复制后存到备忘录或发给自己。恢复时把那段文字粘贴到下面的框里。</div>
        <div className="row"><button type="button" className="btn" onClick={exportAll}>导出全部数据</button></div>
        <textarea
          aria-label="备份数据"
          placeholder="导出的数据会出现在这里；要恢复时把备份文字粘贴到这里"
          value={box}
          onChange={e => setBox(e.target.value)}
        />
        <div className="row"><Confirm label="用框里的数据覆盖现有数据" onConfirm={importAll} /></div>
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
  if (tab === 'history') screen = <History G={G} setG={setG} open={open} setOpen={setOpen} />;
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
              <h1><ShinyText text="德州记分板" color={pal.fg} shineColor={pal.shine} speed={3} delay={2} /></h1>
              <div className="sync">数据保存在本机</div>
            </div>
            <GooeyNav
              items={NAV_ITEMS}
              activeIndex={TABS.indexOf(tab)}
              onChange={i => { window.location.hash = '#' + TABS[i]; }}
              theme={dark ? 'dark' : 'light'}
              color={pal.accent}
              activeTextColor={pal.accentFg}
              size="lg"
            />
          </header>
          <main key={screenKey}>{screen}</main>
        </div>
      </ClickSpark>
    </MotionConfig>
  );
}
