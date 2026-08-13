import React, { useMemo, useState, useEffect, useRef } from "react";
import { marginalskatt, AGA_FULL } from "./tax";

/* ============================================================
   Diagram

   Handritad SVG, inget bibliotek. Tre skäl: paketet förblir
   litet, allt följer designsystemet, och kurvorna räknas från
   samma skattemotor som resten av appen — inga dubbla sanningar.
   ============================================================ */

const kr = (n) => Math.round(n || 0).toLocaleString("sv-SE").replace(/\u00a0/g, " ");
const short = (n) =>
  Math.abs(n) >= 1000 ? Math.round(n / 1000) + "k" : String(Math.round(n));

/* Rita en polyline i ett normerat koordinatsystem. */
function path(points, xs, ys) {
  return points.map((p, i) => (i ? "L" : "M") + xs(p[0]).toFixed(1) + " " + ys(p[1]).toFixed(1)).join(" ");
}

/* Linjen ritas ut vid montering. Diskret, en gång, inte en loop. */
function useDraw(dep) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const len = el.getTotalLength();
    el.style.transition = "none";
    el.style.strokeDasharray = len;
    el.style.strokeDashoffset = len;
    el.getBoundingClientRect();
    el.style.transition = "stroke-dashoffset .9s cubic-bezier(.4,0,.2,1)";
    el.style.strokeDashoffset = "0";
  }, [dep]);
  return ref;
}

function Frame({ children, height = 190, yTicks = [], xLabels = [] }) {
  const W = 620, H = height, P = { t: 14, r: 14, b: 26, l: 52 };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img">
      {yTicks.map((t) => (
        <g key={t.v}>
          <line x1={P.l} x2={W - P.r} y1={t.y} y2={t.y} className="grid" />
          <text x={P.l - 8} y={t.y + 4} className="axis" textAnchor="end">{t.label}</text>
        </g>
      ))}
      {xLabels.map((t) => (
        <text key={t.x} x={t.x} y={H - 8} className="axis" textAnchor="middle">{t.label}</text>
      ))}
      {children}
    </svg>
  );
}

/* ---------- 1. Löneoptimeraren ----------
   Svarar på: hur mycket lön ska jag ta ut ur mitt AB?
   Kurvan har en topp. Den toppen är värd tiotusentals kronor. */

export function Loneoptimeraren({ form, revenue, costs, settings, payroll = 0, payrollAvgifter = null, onPick }) {
  const W = 620, H = 190, P = { t: 14, r: 14, b: 26, l: 52 };

  const data = useMemo(() => {
    // Inget golv. Har bolaget ingen täckning ska det synas, inte döljas
    // bakom en påhittad siffra.
    const maxLon = Math.max(0, Math.floor((revenue - costs - payroll - (payrollAvgifter ?? payroll * AGA_FULL)) / 1.3142 / 12));
    const pts = [];
    for (let i = 0; i <= 50; i++) {
      const l = (maxLon * i) / 50;
      pts.push([l, form.compute({ revenue, costs, settings: { ...settings, lonManad: l }, payroll, payrollAvgifter }).kvar]);
    }
    const best = pts.reduce((a, b) => (b[1] > a[1] ? b : a));
    return { pts, best, maxLon };
  }, [form, revenue, costs, settings.kommunalskatt, settings.utdelning]);

  const lo = Math.min(...data.pts.map((p) => p[1]));
  const hi = Math.max(...data.pts.map((p) => p[1]));
  const span = Math.max(1, hi - lo);
  const xs = (v) => P.l + (v / Math.max(1, data.maxLon)) * (W - P.l - P.r);
  const ys = (v) => P.t + (1 - (v - lo) / span) * (H - P.t - P.b);

  const ref = useDraw(data.pts.length + revenue);
  const onskad = settings.lonManad || 0;
  const current = Math.min(onskad, data.maxLon);
  const kapad = onskad > current + 1;
  const cur = form.compute({ revenue, costs, settings, payroll, payrollAvgifter }).kvar;
  const loss = Math.max(0, data.best[1] - cur);

  const yTicks = [0, 0.5, 1].map((f) => ({ v: lo + span * f, y: ys(lo + span * f), label: short(lo + span * f) }));
  const xLabels = [0, 0.5, 1].map((f) => ({ x: xs(data.maxLon * f), label: short(data.maxLon * f) }));

  if (data.maxLon < 500) {
    return (
      <p className="chartNote">
        Bolaget har ingen täckning för egen lön vid nuvarande siffror. Omsättningen räcker
        inte till efter kostnader{payroll > 0 ? " och personal" : ""}. Lägg in fler fakturor
        eller sänk kostnaderna så dyker kurvan upp.
      </p>
    );
  }

  return (
    <div>
      <Frame yTicks={yTicks} xLabels={xLabels}>
        <path d={`${path(data.pts, xs, ys)} L ${xs(data.maxLon)} ${H - P.b} L ${P.l} ${H - P.b} Z`} className="area" />
        <path ref={ref} d={path(data.pts, xs, ys)} className="line" />
        <g style={{ transform: `translate(${xs(data.best[0])}px, ${ys(data.best[1])}px)`, transition: "transform .5s" }}>
          <circle r="5" className="dotBest" />
        </g>
        <g style={{ transform: `translate(${xs(current)}px, 0px)`, transition: "transform .25s" }}>
          <line y1={P.t} y2={H - P.b} className="cursor" />
          <circle cy={ys(cur)} r="4" className="dotNow" />
        </g>
      </Frame>

      <input type="range" min="0" max={Math.round(data.maxLon)} step="500" value={Math.round(current)}
             onChange={(e) => onPick(+e.target.value)} className="chartRange" />

      <div className="chartFacts">
        <div><span>Din lön</span><b>{kr(current)} kr/mån</b></div>
        <div><span>Bästa läget</span><b className="brass">{kr(data.best[0])} kr/mån</b></div>
        <div><span>{loss > 500 ? "Du missar" : "Du ligger rätt"}</span>
          <b className={loss > 500 ? "warn" : "brass"}>{loss > 500 ? kr(loss) + " kr/år" : "✓"}</b></div>
      </div>
      {kapad && (
        <p className="chartNote">
          Du har ställt in {ckr(onskad)} kr, men bolaget har bara täckning för {ckr(current)} kr
          i månaden inklusive arbetsgivaravgifter. Kurvan räknar på det lägre beloppet.
        </p>
      )}
      {loss > 500 && (
        <button className="linkbtn" onClick={() => onPick(Math.round(data.best[0] / 500) * 500)}>
          Sätt lönen till det bästa läget
        </button>
      )}
    </div>
  );
}

/* ---------- 2. Brytpunkten ----------
   Svarar på: lönar sig ett aktiebolag för mig, och i så fall från vilken vinst? */

export function Brytpunkten({ forms, revenue, costs, settings, payroll = 0, payrollAvgifter = null, activeForm }) {
  const W = 620, H = 190, P = { t: 14, r: 14, b: 26, l: 52 };
  const MAX = Math.max(900000, revenue * 1.4);

  const data = useMemo(() => {
    const e = [], a = [];
    for (let i = 0; i <= 40; i++) {
      const r = (MAX * i) / 40;
      const c = costs * (r / Math.max(1, revenue) || 0);
      e.push([r, forms.enskild.compute({ revenue: r, costs: c, settings, payroll, payrollAvgifter }).kvar]);
      // Jämför mot ett rimligt löneuttag, inte mot noll lön
      const lon = Math.min(45000, Math.max(0, (r - c) / 1.3142 / 12) * 0.55);
      a.push([r, forms.ab.compute({ revenue: r, costs: c, settings: { ...settings, lonManad: lon, utdelning: true }, payroll, payrollAvgifter }).kvar]);
    }
    let cross = null;
    for (let i = 1; i < e.length; i++) {
      const d0 = a[i - 1][1] - e[i - 1][1], d1 = a[i][1] - e[i][1];
      if (d0 <= 0 && d1 > 0) { cross = e[i][0]; break; }
    }
    return { e, a, cross };
  }, [forms, revenue, costs, settings.kommunalskatt]);

  const hi = Math.max(...data.e.map((p) => p[1]), ...data.a.map((p) => p[1]));
  const xs = (v) => P.l + (v / MAX) * (W - P.l - P.r);
  const ys = (v) => P.t + (1 - v / Math.max(1, hi)) * (H - P.t - P.b);
  const r1 = useDraw(data.e.length), r2 = useDraw(data.a.length + 1);

  const yTicks = [0, 0.5, 1].map((f) => ({ v: hi * f, y: ys(hi * f), label: short(hi * f) }));
  const xLabels = [0, 0.5, 1].map((f) => ({ x: xs(MAX * f), label: short(MAX * f) }));

  return (
    <div>
      <Frame yTicks={yTicks} xLabels={xLabels}>
        {data.cross && (
          <g>
            <line x1={xs(data.cross)} x2={xs(data.cross)} y1={P.t} y2={H - P.b} className="threshold" />
            <text x={xs(data.cross) + 6} y={P.t + 12} className="axis">Brytpunkt {short(data.cross)}</text>
          </g>
        )}
        <path ref={r1} d={path(data.e, xs, ys)} className="line lineB" />
        <path ref={r2} d={path(data.a, xs, ys)} className="line" />
        <g style={{ transform: `translate(${xs(revenue)}px, 0px)`, transition: "transform .4s" }}>
          <line y1={P.t} y2={H - P.b} className="cursor" />
        </g>
      </Frame>
      <div className="chartLegend">
        <span><i className="sw swB" />Enskild firma</span>
        <span><i className="sw swA" />Aktiebolag</span>
        <span className="dim">Lodrät linje = din omsättning</span>
      </div>
    </div>
  );
}

/* ---------- 3. Marginalkurvan ----------
   Svarar på: var sitter mina skattetrösklar, och hur nära är jag? */

export function Marginalkurvan({ form, revenue, costs, settings, payroll = 0, payrollAvgifter = null }) {
  const W = 620, H = 170, P = { t: 14, r: 14, b: 26, l: 52 };
  const MAX = Math.max(1000000, revenue * 1.5);

  const pts = useMemo(() => {
    const out = [];
    for (let i = 1; i <= 50; i++) {
      const r = (MAX * i) / 50;
      const c = costs * (r / Math.max(1, revenue) || 0);
      out.push([r, marginalskatt(form, { revenue: r, costs: c, settings, payroll, payrollAvgifter })]);
    }
    return out;
  }, [form, revenue, costs, settings.kommunalskatt, settings.avgiftslage, settings.lonManad]);

  const xs = (v) => P.l + (v / MAX) * (W - P.l - P.r);
  const ys = (v) => P.t + (1 - v / 0.7) * (H - P.t - P.b);
  const ref = useDraw(pts.length);
  const now = marginalskatt(form, { revenue, costs, settings, payroll, payrollAvgifter });

  const yTicks = [0, 0.35, 0.7].map((v) => ({ v, y: ys(v), label: Math.round(v * 100) + "%" }));
  const xLabels = [0, 0.5, 1].map((f) => ({ x: xs(MAX * f), label: short(MAX * f) }));

  return (
    <div>
      <Frame height={H} yTicks={yTicks} xLabels={xLabels}>
        <path d={`${path(pts, xs, ys)} L ${xs(MAX)} ${H - P.b} L ${xs(pts[0][0])} ${H - P.b} Z`} className="area" />
        <path ref={ref} d={path(pts, xs, ys)} className="line" />
        <g style={{ transform: `translate(${xs(revenue)}px, 0px)`, transition: "transform .4s" }}>
          <line y1={P.t} y2={H - P.b} className="cursor" />
          <circle cy={ys(now)} r="4" className="dotNow" />
        </g>
      </Frame>
      <p className="chartNote">
        Varje steg uppåt är en tröskel. Just nu kostar nästa intjänad hundralapp dig{" "}
        <b>{Math.round(now * 100)} kr</b> i skatt och avgifter.
      </p>
    </div>
  );
}
