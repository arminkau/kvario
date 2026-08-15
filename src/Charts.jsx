import React, { useMemo, useState, useEffect, useRef } from "react";
import { marginalskatt } from "./tax";

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

/* ---------- Marginalkurvan ----------
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
