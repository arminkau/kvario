export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

.kvar {
  --ink:#131E26; --slate:#4A5D68; --mist:#8698A1;
  --paper:#E4EBE7; --surface:#FAFCFB; --line:#C6D3CD;
  --brass:#B8862B; --brass-dk:#8C6418;
  --band-1:#3E5566; --band-2:#63798A; --band-3:#8A9CA8; --band-4:#AEBCC3;
  --warn:#9A4A25;
  background:var(--paper); color:var(--ink);
  font-family:'IBM Plex Sans',system-ui,sans-serif;
  min-height:100vh; padding:26px 18px 60px; -webkit-font-smoothing:antialiased;
}
.kvar *{box-sizing:border-box}
.wrap{max-width:1080px;margin:0 auto}
.num{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums}
.dim{color:var(--mist)}
.brass{color:var(--brass-dk)}
.eyebrow{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--mist);font-weight:600}

.top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:14px}
.brand{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.brand h1{font-family:'Familjen Grotesk';font-size:26px;font-weight:700;letter-spacing:-.02em;margin:0}
.brand span{font-size:12.5px;color:var(--slate)}
.topRight{display:flex;align-items:center;gap:12px}
.save{font-size:11px;color:var(--mist);min-width:64px;text-align:right}
.save-error{color:var(--warn)}
.badge{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;padding:4px 11px;border-radius:999px;background:var(--brass);color:#fff}
.upgrade{font:inherit;font-size:12.5px;font-weight:600;padding:6px 15px;border-radius:999px;border:1px solid var(--brass);background:transparent;color:var(--brass-dk);cursor:pointer}
.upgrade:hover{background:var(--brass);color:#fff}

.countries{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:18px}
.cbtn{font:inherit;font-size:12.5px;font-weight:500;padding:6px 12px;border-radius:999px;cursor:pointer;border:1px solid var(--line);background:transparent;color:var(--slate);transition:.15s}
.cbtn:hover{border-color:var(--slate);color:var(--ink)}
.cbtn[data-on="true"]{background:var(--ink);border-color:var(--ink);color:var(--surface)}

.hero{background:var(--surface);border:1px solid var(--line);border-radius:4px;padding:30px 28px 24px;margin-bottom:14px}
.heroTop{display:flex;justify-content:space-between;align-items:flex-start;gap:22px;flex-wrap:wrap;margin-bottom:24px}
.bignum{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;font-size:clamp(38px,8vw,64px);font-weight:600;line-height:1;color:var(--brass-dk);letter-spacing:-.03em;margin:8px 0 6px}
.unit{font-size:.38em;margin-left:8px;color:var(--slate)}
.sub{font-size:13px;color:var(--slate)}
.toggleRow{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--slate)}
.switch{width:38px;height:21px;border-radius:999px;border:1px solid var(--line);background:var(--paper);position:relative;cursor:pointer;padding:0;flex:none;transition:.18s}
.switch[data-on="true"]{background:var(--brass);border-color:var(--brass)}
.switch::after{content:'';position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;background:var(--surface);transition:transform .18s;box-shadow:0 1px 2px rgba(0,0,0,.2)}
.switch[data-on="true"]::after{transform:translateX(17px)}

.bar{display:flex;height:46px;border-radius:3px;overflow:hidden;background:var(--paper)}
.seg{transition:flex-grow .5s cubic-bezier(.4,0,.2,1);min-width:2px}
.seg.mine{background:repeating-linear-gradient(-45deg,var(--brass) 0 7px,var(--brass-dk) 7px 14px)}
.barCap{display:flex;justify-content:space-between;margin-top:9px;font-size:11px;color:var(--mist)}
.legend{margin-top:20px;border-top:1px solid var(--line)}
.lrow{display:flex;align-items:baseline;gap:12px;padding:11px 0;border-bottom:1px solid var(--line)}
.swatch{width:9px;height:9px;border-radius:2px;flex:none;transform:translateY(-1px)}
.lname{font-size:13.5px;font-weight:500;min-width:112px}
.lnote{font-size:11.5px;color:var(--mist);flex:1}
.lamt{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;font-size:13.5px}
.lrow.mine{border-bottom:none;padding-top:14px}
.lrow.mine .lname,.lrow.mine .lamt{color:var(--brass-dk);font-weight:600;font-size:15px}
.caveat{margin-top:15px;font-size:11.5px;color:var(--mist);line-height:1.55}

.panel{background:var(--surface);border:1px solid var(--line);border-radius:4px;padding:20px 22px;margin-bottom:14px;position:relative;overflow:hidden}
.panelHead{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px;gap:12px}
.panelHead h2{font-family:'Familjen Grotesk';font-size:15px;font-weight:600;margin:0}

.envRow{display:flex;gap:34px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px}
.midnum{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;font-size:22px;font-weight:600;margin-top:5px}
.gap.warn .midnum{color:var(--warn)}
.gap.ok .midnum{color:var(--brass-dk)}
.envBar{height:7px;background:var(--paper);border-radius:999px;overflow:hidden}
.envFill{height:100%;background:var(--brass);transition:width .5s cubic-bezier(.4,0,.2,1)}

.locked .chart,.locked .chartFacts,.locked .chartRange,.locked .chartLegend,.locked .chartNote,.locked .mgControls,.locked .mgOut,.locked .fcRow,.locked .alert{filter:blur(5px);opacity:.4;pointer-events:none;user-select:none}
.lockOverlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(250,252,251,.75);z-index:2;text-align:center;padding:20px}
.lockOverlay p{font-size:13px;color:var(--slate);max-width:340px;margin:8px auto 14px;line-height:1.55}

.segbtns{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:14px}
.sb{font:inherit;font-size:12.5px;padding:6px 13px;border-radius:3px;border:1px solid var(--line);background:transparent;color:var(--slate);cursor:pointer}
.sb[data-on="true"]{background:var(--ink);border-color:var(--ink);color:var(--surface)}
.mgInputs{display:flex;gap:18px;flex-wrap:wrap}
.mgInputs label{font-size:11.5px;color:var(--mist);display:flex;flex-direction:column;gap:5px}
.mgOut{margin-top:18px;padding-top:16px;border-top:1px solid var(--line)}
.mgLead{font-family:'Familjen Grotesk';font-size:18px;line-height:1.45;margin:0 0 14px;font-weight:400}
.mgRows{display:grid;gap:0;max-width:400px;margin-bottom:14px}
.mgRows div{display:flex;justify-content:space-between;padding:7px 0;font-size:13px;border-bottom:1px solid var(--line)}
.mgRows b{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums}
.mgRows .tot{border-bottom:none;border-top:1px solid var(--ink);margin-top:2px;font-weight:600}
.mgRows .tot b{color:var(--brass-dk)}
.mgSmalt{font-size:11.5px;color:var(--mist);line-height:1.6;margin:10px 0 0;max-width:560px}
.mgHours{font-size:13px;color:var(--slate);margin:0;line-height:1.6}

.fcRow{display:flex;gap:34px;flex-wrap:wrap;margin-bottom:6px}

.settings{display:flex;gap:26px;flex-wrap:wrap;background:var(--surface);border:1px solid var(--line);border-radius:4px;padding:18px 22px;margin-bottom:14px}
.sblock{min-width:210px}
.slabel{font-size:12.5px;font-weight:600;margin-bottom:7px}
.shint{font-size:11px;color:var(--mist);line-height:1.5;margin-top:6px;max-width:290px}
.pctSign{margin-left:6px;font-size:13px;color:var(--slate)}
.presets{display:flex;gap:4px;flex-wrap:wrap;margin-top:7px}
.pbtn{font:inherit;font-size:11px;padding:3px 8px;border-radius:3px;cursor:pointer;border:1px solid var(--line);background:transparent;color:var(--slate)}
.pbtn:hover{border-color:var(--slate);color:var(--ink)}

.pending{background:var(--surface);border:1px dashed var(--line);border-radius:4px;padding:22px 24px;margin-bottom:14px}
.pending h3{font-family:'Familjen Grotesk';font-size:15px;margin:8px 0 6px;font-weight:600}
.pending p{font-size:13px;color:var(--slate);margin:0 0 14px;line-height:1.55}
.needs{display:flex;gap:6px;flex-wrap:wrap}
.need{font-family:'IBM Plex Mono',monospace;font-size:11px;padding:4px 9px;border:1px solid var(--line);border-radius:3px;color:var(--slate)}

.alert{display:flex;gap:11px;align-items:flex-start;border-left:3px solid var(--warn);background:var(--surface);padding:14px 18px;margin-bottom:14px;border-radius:0 4px 4px 0}
.panel .alert{margin:14px 0 0;padding-left:14px}
.alert p{margin:0;font-size:12.5px;color:var(--slate);line-height:1.55}
.alert strong{color:var(--ink)}
.bang{font-family:'IBM Plex Mono',monospace;color:var(--warn);font-weight:600}

.cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media (max-width:820px){.cols{grid-template-columns:1fr}.envRow,.fcRow{gap:22px}}
.item{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line);font-size:13px}
.iname{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.iamt{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;font-size:12.5px}
.tag{font-size:10px;letter-spacing:.06em;text-transform:uppercase;padding:2px 7px;border-radius:999px;border:1px solid var(--line);color:var(--mist);cursor:pointer;background:transparent;font-family:inherit}
.tag[data-paid="true"]{color:var(--brass-dk);border-color:var(--brass)}
.x{background:none;border:none;color:var(--mist);cursor:pointer;font-size:16px;line-height:1;padding:0 2px}
.x:hover{color:var(--warn)}
.empty{font-size:12.5px;color:var(--mist);padding:16px 0;line-height:1.55}
.limitNote{font-size:12px;color:var(--slate);padding:12px 0 0;margin:0}

.form{display:flex;gap:6px;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}
input,select{font:inherit;font-size:13px;padding:7px 9px;border:1px solid var(--line);border-radius:3px;background:var(--paper);color:var(--ink);min-width:0}
input:focus,select:focus,button:focus-visible{outline:2px solid var(--brass);outline-offset:1px}
.grow{flex:1;min-width:110px}
.w130{width:132px}.w90{width:92px}.w70{width:74px}
.big{font-size:19px;font-weight:600;padding:5px 9px}
.add{font:inherit;font-size:13px;font-weight:600;padding:8px 17px;border-radius:3px;border:1px solid var(--ink);background:var(--ink);color:var(--surface);cursor:pointer}
.add:hover{background:#000}
.add.wide{width:100%;padding:12px;font-size:14px;background:var(--brass);border-color:var(--brass)}
.add.wide:hover{background:var(--brass-dk)}
.linkbtn{background:none;border:none;padding:0;font:inherit;font-size:12px;color:var(--brass-dk);text-decoration:underline;cursor:pointer}
.linkbtn.center{display:block;margin:12px auto 0;color:var(--mist)}
.foot{margin-top:20px;font-size:11.5px;color:var(--mist);line-height:1.6;max-width:660px}

.modalBg{position:fixed;inset:0;background:rgba(19,30,38,.55);display:flex;align-items:center;justify-content:center;padding:20px;z-index:50;overflow-y:auto;-webkit-overflow-scrolling:touch}
.modal{background:var(--surface);border-radius:6px;padding:30px 30px 24px;max-width:440px;width:100%;border:1px solid var(--line)}
@media (max-width:560px){
  .modalBg{padding:0;align-items:stretch}
  .modal{border-radius:0;border:none;min-height:100vh;padding:26px 20px 22px;display:flex;flex-direction:column}
  .villkorText{max-height:none;flex:1}
  .billing{grid-template-columns:1fr}
}
.modal h2{font-family:'Familjen Grotesk';font-size:23px;margin:6px 0 16px;font-weight:700;letter-spacing:-.02em}
.perks{list-style:none;padding:0;margin:0 0 20px}
.perks li{font-size:13px;color:var(--slate);padding:7px 0 7px 20px;position:relative;line-height:1.5}
.perks li::before{content:'';position:absolute;left:0;top:14px;width:7px;height:7px;background:var(--brass);border-radius:2px}
.perks b{color:var(--ink)}
.billing{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px}
.bopt{font:inherit;text-align:left;padding:13px 14px;border-radius:4px;border:1px solid var(--line);background:transparent;cursor:pointer;display:flex;flex-direction:column;gap:3px}
.bopt[data-on="true"]{border-color:var(--brass);background:rgba(184,134,43,.07)}
.bname{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--mist);font-weight:600}
.bprice{font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:600}
.bnote{font-size:11px;color:var(--mist)}
.modalNote{font-size:11px;color:var(--mist);line-height:1.55;margin:12px 0 0}


.countryLine{display:flex;align-items:center;gap:10px;margin-bottom:18px;font-size:13px}
.countryLine b{font-weight:600}

.onboard{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.obCard{background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:36px 34px 30px;max-width:520px;width:100%}
.obTitle{font-family:'Familjen Grotesk';font-size:26px;font-weight:700;letter-spacing:-.02em;margin:20px 0 10px}
.obLead{font-size:13.5px;color:var(--slate);line-height:1.6;margin:0 0 24px}
.obList{display:grid;gap:7px;margin-bottom:20px}
.obOpt{font:inherit;text-align:left;padding:14px 16px;border-radius:4px;border:1px solid var(--line);background:transparent;cursor:pointer;display:grid;grid-template-columns:1fr auto;gap:3px 12px;align-items:center}
.obOpt:hover{border-color:var(--slate)}
.obOpt[data-on="true"]{border-color:var(--brass);background:rgba(184,134,43,.07)}
.obName{font-size:14.5px;font-weight:600}
.obMeta{font-family:'IBM Plex Mono',monospace;font-size:11.5px;color:var(--mist);grid-column:1}
.obTag{grid-row:1/3;grid-column:2;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--mist);border:1px solid var(--line);padding:3px 9px;border-radius:999px;white-space:nowrap}
.obTag.on{color:var(--brass-dk);border-color:var(--brass)}
.obWarn{font-size:12px;color:var(--slate);line-height:1.55;background:var(--paper);padding:12px 14px;border-radius:4px;margin:0 0 18px}


.trialBadge{font:inherit;font-size:12px;font-weight:600;padding:5px 13px;border-radius:999px;border:1px solid var(--brass);background:rgba(184,134,43,.1);color:var(--brass-dk);cursor:pointer;white-space:nowrap}
.trialBadge:hover{background:var(--brass);color:#fff}
.trialBar{display:flex;align-items:center;gap:16px;flex-wrap:wrap;justify-content:space-between;background:var(--surface);border:1px solid var(--brass);border-left-width:3px;border-radius:0 4px 4px 0;padding:14px 18px;margin-bottom:14px}
.trialBar.ended{border-color:var(--line);border-left-color:var(--slate)}
.trialBar p{margin:0;font-size:12.5px;color:var(--slate);line-height:1.55;flex:1;min-width:240px}
.trialBar strong{color:var(--ink)}
.obTrial{font-size:13px;color:var(--slate);line-height:1.6;background:rgba(184,134,43,.09);border-radius:4px;padding:13px 15px;margin:0 0 16px}
.obTrial b{color:var(--brass-dk)}
.modalLead{font-size:13px;color:var(--slate);line-height:1.55;margin:-8px 0 16px}


.authLabel{display:flex;flex-direction:column;gap:6px;font-size:11.5px;color:var(--mist);margin-bottom:14px}
.authLabel input{font-size:14px;padding:11px 12px}
.authError{font-size:12.5px;color:var(--warn);margin:-8px 0 12px}
.authOr{display:flex;align-items:center;gap:12px;margin:16px 0;color:var(--mist);font-size:11.5px}
.authOr::before,.authOr::after{content:'';flex:1;height:1px;background:var(--line)}
.authAlt{font:inherit;font-size:13.5px;font-weight:500;width:100%;padding:11px;border-radius:3px;border:1px solid var(--line);background:transparent;color:var(--ink);cursor:pointer}
.authAlt:hover{border-color:var(--slate)}
.authNote{font-size:11.5px;color:var(--mist);line-height:1.55;margin:18px 0 0}


.avdragSearch{width:100%;font-size:13.5px;padding:9px 11px;margin-bottom:12px}
.avdragList{border-top:1px solid var(--line)}
.avItem{border-bottom:1px solid var(--line)}
.avHead{width:100%;font:inherit;text-align:left;background:none;border:none;cursor:pointer;padding:11px 0;display:grid;grid-template-columns:auto 1fr auto;gap:3px 10px;align-items:center}
.avHead:hover .avName{color:var(--brass-dk)}
.avDot{width:8px;height:8px;border-radius:50%;flex:none;grid-row:1/3}
.avDot.yes{background:#2E7D5B}.avDot.part{background:var(--brass)}.avDot.no{background:var(--warn)}
.avName{font-size:13.5px;font-weight:600}
.avShort{grid-column:2;font-size:12px;color:var(--mist);line-height:1.45}
.avTag{grid-row:1/3;grid-column:3;font-size:10px;letter-spacing:.06em;text-transform:uppercase;padding:3px 9px;border-radius:999px;border:1px solid var(--line);color:var(--mist);white-space:nowrap}
.avTag.yes{color:#2E7D5B;border-color:#9BC4B0}
.avTag.part{color:var(--brass-dk);border-color:var(--brass)}
.avTag.no{color:var(--warn);border-color:#D8A98F}
.avDetail{font-size:12.5px;color:var(--slate);line-height:1.65;margin:0 0 14px;padding-left:18px;max-width:620px}
.hint{display:flex;gap:9px;align-items:flex-start;margin-top:12px;padding:11px 13px;background:var(--paper);border-radius:4px}
.hint .avDot{margin-top:5px}
.hint p{margin:0;font-size:12.5px;color:var(--slate);line-height:1.55}
.hint b{color:var(--ink)}


.lp{max-width:940px;margin:0 auto;padding-bottom:60px}
.lpNav{display:flex;justify-content:space-between;align-items:center;padding:6px 0 34px;gap:16px;flex-wrap:wrap}
.lpNavRight{display:flex;align-items:center;gap:16px}
.lpHero{padding:24px 0 44px;max-width:660px}
.lpH1{font-family:'Familjen Grotesk';font-size:clamp(32px,5.5vw,50px);line-height:1.08;letter-spacing:-.03em;font-weight:700;margin:0 0 20px}
.lpLead{font-size:16.5px;line-height:1.65;color:var(--slate);margin:0 0 28px;max-width:560px}
.lpCta{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.wide2{padding:13px 28px;font-size:14.5px;background:var(--brass);border-color:var(--brass)}
.wide2:hover{background:var(--brass-dk)}
.lpCtaNote{font-size:12.5px;color:var(--mist)}
.lpPanel{background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:28px 30px;margin-bottom:16px}
.lpSplitTop{display:flex;justify-content:space-between;align-items:flex-end;gap:28px;flex-wrap:wrap;margin:6px 0 22px}
.lpSplitNote{font-size:13px;color:var(--slate);line-height:1.6;max-width:330px;margin:0}
.lpLegend{display:flex;gap:20px;flex-wrap:wrap;margin-top:16px;font-size:12.5px;color:var(--slate)}
.lpLegend span{display:flex;align-items:center;gap:7px}
.lpLegend i{width:8px;height:8px;border-radius:2px;display:block}
.lpLegend b{font-family:'IBM Plex Mono',monospace;font-weight:500}
.lpLegend .mine{color:var(--brass-dk)}
.lpH2{font-family:'Familjen Grotesk';font-size:24px;font-weight:700;letter-spacing:-.02em;margin:10px 0 10px}
.lpBody{font-size:14px;line-height:1.65;color:var(--slate);margin:0 0 20px;max-width:520px}
.lpSliders{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px;margin:16px 0 22px}
.lpSliders label{display:flex;flex-direction:column;gap:9px;font-size:12.5px;color:var(--slate)}
.lpSliders b{font-family:'IBM Plex Mono',monospace;color:var(--ink);font-weight:600}
.lpSliders input[type=range]{width:100%;accent-color:var(--brass);padding:0;background:none;border:none}
.lpResult{border-top:1px solid var(--line);padding-top:18px}
.lpFeatures{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px;margin-bottom:16px}
.lpFeat{background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:20px 22px}
.lpFeat h4{font-family:'Familjen Grotesk';font-size:15px;font-weight:600;margin:0 0 8px}
.lpFeat p{font-size:12.5px;line-height:1.6;color:var(--slate);margin:0}
.lpPrice{display:flex;justify-content:space-between;align-items:center;gap:28px;flex-wrap:wrap}
.lpPriceCta{display:flex;flex-direction:column;gap:9px;align-items:flex-start}
.lpFoot{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;padding-top:22px;font-size:12px;color:var(--mist)}

.obForm{margin:20px 0 4px}
.obFormList{display:grid;gap:7px;margin-top:9px}
.obForm .obOpt{grid-template-columns:1fr}
.obForm .obMeta{font-family:inherit;font-size:12px;line-height:1.5;white-space:normal}

.chart{width:100%;height:auto;display:block;overflow:visible}
.chart .grid{stroke:var(--line);stroke-width:1}
.chart .axis{font-family:'IBM Plex Mono',monospace;font-size:10.5px;fill:var(--mist)}
.chart .line{fill:none;stroke:var(--brass);stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round}
.chart .lineB{stroke:var(--band-1);stroke-dasharray:5 4}
.chart .area{fill:var(--brass);opacity:.08}
.chart .cursor{stroke:var(--slate);stroke-width:1;stroke-dasharray:3 3}
.chart .threshold{stroke:var(--warn);stroke-width:1;stroke-dasharray:2 3}
.chart .dotBest{fill:var(--brass);stroke:var(--surface);stroke-width:2}
.chart .dotNow{fill:var(--ink);stroke:var(--surface);stroke-width:2}
.chartRange{width:100%;accent-color:var(--brass);margin:14px 0 4px;padding:0;background:none;border:none}
.chartFacts{display:flex;gap:30px;flex-wrap:wrap;margin:10px 0 6px}
.chartFacts div{display:flex;flex-direction:column;gap:3px}
.chartFacts span{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--mist);font-weight:600}
.chartFacts b{font-family:'IBM Plex Mono',monospace;font-size:16px;font-weight:600}
.chartFacts .warn{color:var(--warn)}
.chartLegend{display:flex;gap:20px;flex-wrap:wrap;margin-top:10px;font-size:12px;color:var(--slate)}
.chartLegend span{display:flex;align-items:center;gap:7px}
.chartLegend .dim{color:var(--mist)}
.sw{width:14px;height:2.5px;border-radius:2px;display:block}
.swA{background:var(--brass)}
.swB{background:var(--band-1)}
.chartNote{font-size:12.5px;color:var(--slate);line-height:1.6;margin:12px 0 0}

.toggleHead{width:100%;font:inherit;background:none;border:none;padding:0;cursor:pointer;text-align:left}
.toggleHead:hover h2{color:var(--brass-dk)}
.toggleHead .eyebrow{color:var(--brass-dk)}
.payrollSum{display:flex;gap:28px;flex-wrap:wrap;padding:14px 0 2px;border-top:1px solid var(--line);margin-top:8px}
.payrollSum div{display:flex;flex-direction:column;gap:3px}
.payrollSum b{font-family:'IBM Plex Mono',monospace;font-size:15px;font-weight:600}

.infoBtn{width:17px;height:17px;flex:none;border-radius:50%;border:1px solid var(--line);background:transparent;
  color:var(--mist);font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1;cursor:pointer;
  margin-right:auto;padding:0;display:inline-flex;align-items:center;justify-content:center}
.infoBtn:hover{border-color:var(--brass);color:var(--brass-dk)}
.infoBtn[data-on="true"]{background:var(--brass);border-color:var(--brass);color:#fff}
.panelHead h2{margin-right:9px}
.infoBox{font-size:12.5px;line-height:1.65;color:var(--slate);background:var(--paper);
  border-radius:4px;padding:14px 16px;margin:0 0 16px;max-width:640px}

.villkorKnapp{width:100%;font:inherit;display:flex;align-items:center;gap:13px;text-align:left;
  background:var(--paper);border:1px solid var(--line);border-radius:5px;padding:14px 16px;
  margin:6px 0 12px;cursor:pointer;color:var(--ink);transition:border-color .15s,background .15s}
.villkorKnapp:hover{border-color:var(--brass)}
.villkorKnapp.last{background:rgba(184,134,43,.08);border-color:var(--brass)}
.vkIkon{width:24px;height:24px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;
  background:var(--slate);color:var(--surface);font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600}
.villkorKnapp.last .vkIkon{background:var(--brass)}
.vkText{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}
.vkText b{font-size:13.5px;font-weight:600}
.vkText small{font-size:11.5px;color:var(--mist)}
.vkPil{color:var(--mist);font-size:15px;flex:none}
.villkorRad{display:flex;gap:11px;align-items:flex-start;margin:0 0 18px;font-size:12.5px;line-height:1.6;color:var(--slate);cursor:pointer}
.villkorRad input{width:19px;height:19px;flex:none;margin-top:1px;accent-color:var(--brass);padding:0}
.villkorRad.av{opacity:.45;cursor:not-allowed}
.villkorRad.av input{cursor:not-allowed}
.add:disabled{opacity:.4;cursor:not-allowed}
.add:disabled:hover{background:var(--brass)}
.wideModal{max-width:620px}
.villkorText{max-height:52vh;overflow-y:auto;-webkit-overflow-scrolling:touch;padding-right:8px;margin-bottom:18px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.villkorText h4{font-family:'Familjen Grotesk';font-size:13.5px;font-weight:600;margin:18px 0 6px}
.villkorText p{font-size:12.5px;line-height:1.7;color:var(--slate);margin:0}

.villkorInline{background:var(--paper);border-radius:5px;padding:16px 18px 14px;margin:0 0 14px}
.villkorInline.bare{background:none;padding:0;margin:0}
.villkorInline h4{font-family:'Familjen Grotesk';font-size:13px;font-weight:600;margin:16px 0 5px}
.villkorInline > div:first-of-type h4{margin-top:12px}
.villkorInline p{font-size:12.5px;line-height:1.7;color:var(--slate);margin:0}
.villkorInline .linkbtn{margin-top:16px}

.samtycke{position:sticky;top:0;z-index:40;margin:-26px -18px 20px;background:var(--surface);border-bottom:1px solid var(--line)}
.samtyckeInner{max-width:1080px;margin:0 auto;padding:16px 20px;display:flex;gap:20px;align-items:center;flex-wrap:wrap}
.samtyckeInner p{margin:0;flex:1;min-width:260px;font-size:12.5px;line-height:1.6;color:var(--slate)}
.samtyckeInner strong{color:var(--ink)}
.samtyckeKnappar{display:flex;gap:8px;flex-wrap:wrap}
.authAlt.smal{width:auto;padding:8px 16px;font-size:13px}
.dataText{font-size:13px;line-height:1.65;color:var(--slate);margin:0 0 16px;max-width:600px}
.dataKnappar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:22px}
.farlig{font:inherit;font-size:13px;font-weight:600;padding:8px 17px;border-radius:3px;
  border:1px solid var(--warn);background:transparent;color:var(--warn);cursor:pointer}
.farlig:hover{background:var(--warn);color:var(--surface)}
.lagringVal{border-top:1px solid var(--line);padding-top:16px;margin-bottom:16px}
.lagringRad{display:flex;gap:13px;align-items:flex-start;padding:10px 0}
.lagringRad b{font-size:13px;font-weight:600;display:block;margin-bottom:3px}
.lagringRad p{margin:0;font-size:12px;line-height:1.55;color:var(--mist);max-width:520px}
.switch:disabled{opacity:.55;cursor:not-allowed}

.regelTag{font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--brass-dk);
  border:1px solid var(--brass);border-radius:999px;padding:2px 8px;margin-left:8px;white-space:nowrap}
.vaxaVal{display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--slate);cursor:pointer;white-space:nowrap}
.vaxaVal input{width:16px;height:16px;accent-color:var(--brass);padding:0;flex:none}

.rapportLista{display:grid;gap:8px}
.rapportRad{display:flex;align-items:center;gap:16px;justify-content:space-between;
  border:1px solid var(--line);border-radius:5px;padding:14px 16px;flex-wrap:wrap}
.rapportRad b{font-size:13.5px;font-weight:600;display:block;margin-bottom:3px}
.rapportRad p{margin:0;font-size:12px;color:var(--mist);line-height:1.5;max-width:440px}

.rapportVy{max-width:900px;margin:0 auto;padding-bottom:50px}
.rapportVerktyg{display:flex;justify-content:space-between;align-items:center;
  padding:8px 0 20px;gap:16px;flex-wrap:wrap}

.rapport{background:var(--surface);border:1px solid var(--line);border-radius:5px;padding:44px 48px}
.rHuvud{display:flex;justify-content:space-between;gap:26px;flex-wrap:wrap;
  padding-bottom:22px;margin-bottom:28px;border-bottom:2px solid var(--ink)}
.rMarke{font-family:'Familjen Grotesk';font-size:15px;font-weight:700;letter-spacing:-.01em;margin-bottom:6px}
.rHuvud h1{font-family:'Familjen Grotesk';font-size:27px;font-weight:700;letter-spacing:-.02em;margin:0}
.rMeta{text-align:right;font-size:11.5px;color:var(--mist);line-height:1.7}
.rapport section{margin-bottom:34px;break-inside:avoid}
.rapport h2{font-family:'Familjen Grotesk';font-size:16px;font-weight:600;margin:0 0 10px;
  padding-bottom:7px;border-bottom:1px solid var(--line)}
.rForklaring{font-size:12.5px;line-height:1.7;color:var(--slate);margin:0 0 16px;max-width:660px}
.rRad{display:flex;align-items:baseline;gap:14px;padding:8px 0;border-bottom:1px solid var(--line);font-size:13px}
.rEtikett{min-width:190px}
.rNot{flex:1;font-size:11.5px;color:var(--mist)}
.rBelopp{margin-left:auto;font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums}
.rRad.stark{border-bottom:none;border-top:2px solid var(--ink);margin-top:4px;padding-top:11px;font-weight:600}
.rRad.stark .rBelopp{font-size:15px;color:var(--brass-dk)}
.rTabell{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:6px}
.rTabell th{text-align:left;font-size:10px;letter-spacing:.09em;text-transform:uppercase;
  color:var(--mist);font-weight:600;padding:0 10px 7px 0;border-bottom:1px solid var(--line)}
.rTabell td{padding:7px 10px 7px 0;border-bottom:1px solid var(--line);
  font-variant-numeric:tabular-nums}
.rTabell .h{text-align:right;font-family:'IBM Plex Mono',monospace}
.rTabell tfoot td{border-bottom:none;border-top:1px solid var(--ink);font-weight:600;padding-top:9px}
.rFot{margin-top:36px;padding-top:18px;border-top:1px solid var(--line)}
.rFot p{font-size:11px;line-height:1.65;color:var(--mist);margin:0 0 8px;max-width:680px}
.rSid{font-family:'IBM Plex Mono',monospace}

@media print{
  .kvar{background:#fff;padding:0;color:#000}
  .rapportVerktyg,.samtycke{display:none !important}
  .rapportVy{max-width:none;padding:0}
  .rapport{border:none;border-radius:0;padding:0;background:#fff}
  .rapport section{page-break-inside:avoid}
  .rFot{page-break-inside:avoid}
  @page{margin:18mm 16mm}
}

.w110{width:112px}
.utlandRad{display:flex;gap:18px;justify-content:space-between;align-items:flex-start;
  padding:13px 0;border-bottom:1px solid var(--line)}
.utlandRad b{font-size:13.5px;font-weight:600;display:block;margin-bottom:4px}
.utlandRad p{margin:0;font-size:12px;line-height:1.6;color:var(--slate);max-width:520px}
.utlandRad .fakturatext{margin-top:6px;font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--mist)}

.angerRad{display:flex;gap:11px;align-items:flex-start;margin:0 0 16px;font-size:12px;
  line-height:1.6;color:var(--slate);cursor:pointer}
.angerRad input{width:18px;height:18px;flex:none;margin-top:1px;accent-color:var(--brass);padding:0}

.adminIdentitet{display:flex;align-items:center;gap:14px;font-size:12.5px;color:var(--mist)}
.adminVy{max-width:1080px;margin:0 auto;padding-bottom:60px}
.adminTopp{display:flex;justify-content:space-between;align-items:flex-end;padding:6px 0 22px;gap:16px;flex-wrap:wrap}
.adminH1{font-family:'Familjen Grotesk';font-size:26px;font-weight:700;letter-spacing:-.02em;margin:5px 0 0}
.adminFlikar{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:18px}
.adminFlikar .sb{position:relative}
.prick{display:inline-flex;align-items:center;justify-content:center;min-width:17px;height:17px;
  margin-left:7px;padding:0 5px;border-radius:999px;background:var(--warn);color:#fff;font-size:10.5px;font-weight:600}
.nyckeltalRad{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-bottom:12px}
.nyckeltal{background:var(--surface);border:1px solid var(--line);border-radius:5px;padding:16px 18px;
  display:flex;flex-direction:column;gap:5px}
.nyckeltal b{font-family:'IBM Plex Mono',monospace;font-size:23px;font-weight:600}
.nyckeltal b.brass{color:var(--brass-dk)}
.nyckeltal small{font-size:11.5px;color:var(--mist)}
.adminPanel{background:var(--surface);border:1px solid var(--line);border-radius:5px;padding:22px 24px;margin-bottom:14px}
.adminPanel h3{font-family:'Familjen Grotesk';font-size:15px;font-weight:600;margin:0 0 14px}
.adminSok{width:100%;font-size:13.5px;padding:9px 11px;margin-bottom:14px}
.adminHjalp{font-size:12.5px;line-height:1.65;color:var(--slate);margin:0 0 16px;max-width:640px}
.adminPanel .rTabell td{font-size:12.5px}
.mono{font-family:'IBM Plex Mono',monospace;font-size:12px}
.plantag{font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;padding:3px 9px;border-radius:999px;white-space:nowrap}
.plantag.pro{background:rgba(184,134,43,.14);color:var(--brass-dk)}
.plantag.gratis{background:var(--paper);color:var(--mist)}
.utskickForm{display:grid;gap:14px;max-width:560px}
.utskickForm label{display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--mist)}
.utskickForm textarea{font:inherit;font-size:13.5px;padding:10px 11px;border:1px solid var(--line);
  border-radius:3px;background:var(--paper);color:var(--ink);resize:vertical;line-height:1.6}
.utskickForm select,.utskickForm input{font-size:13.5px;padding:9px 11px}

.tkHjalp{font-size:11.5px;color:var(--mist);line-height:1.55;margin:0 0 10px}
.testkonton{margin:20px 0 0;padding-top:18px;border-top:1px solid var(--line)}
.testkonto{width:100%;font:inherit;text-align:left;background:var(--paper);border:1px solid var(--line);
  border-radius:4px;padding:12px 14px;margin-bottom:7px;cursor:pointer;display:flex;flex-direction:column;gap:3px}
.testkonto:hover{border-color:var(--brass)}
.tkNamn{font-size:13.5px;font-weight:600;display:flex;align-items:center;gap:8px}
.tkBesk{font-size:11.5px;color:var(--mist);line-height:1.5}

.panelRad{display:flex;justify-content:space-between;align-items:baseline;gap:16px;margin-bottom:14px}
.panelRad h3{margin:0}
.manadRad{display:flex;align-items:center;gap:14px;padding:8px 0;font-size:12.5px}
.manadNamn{min-width:74px;color:var(--slate)}
.manadStapel{flex:1;height:9px;background:var(--paper);border-radius:999px;overflow:hidden;min-width:60px}
.manadFyll{height:100%;background:var(--brass);border-radius:999px;transition:width .5s cubic-bezier(.4,0,.2,1)}
.manadAntal{min-width:44px;text-align:right;color:var(--mist);font-size:11.5px}
.manadBelopp{min-width:88px;text-align:right;font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums}
.nyckeltal b.warn{color:var(--warn)}

.kommunVal{margin-top:8px;font-size:12.5px;padding:7px 9px;max-width:230px;width:100%}
.uppskattning{display:flex;gap:12px;align-items:flex-start;margin-top:16px;padding:13px 15px;
  background:var(--paper);border-radius:4px}
.uppEtikett{font-size:10px;letter-spacing:.1em;text-transform:uppercase;font-weight:600;
  color:var(--brass-dk);border:1px solid var(--brass);border-radius:999px;padding:3px 9px;
  white-space:nowrap;flex:none}
.uppskattning p{margin:0;font-size:11.5px;line-height:1.6;color:var(--slate)}

@media (prefers-reduced-motion:reduce){.seg,.switch,.switch::after,.envFill{transition:none}}
`;
