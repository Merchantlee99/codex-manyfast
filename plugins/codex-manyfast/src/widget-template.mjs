export const MANIFEST_TEMPLATE_URI = "ui://codex-manyfast/planning-manifest.html";

export function manifestWidgetHtml() {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root { color-scheme: light dark; --bg:#ffffff; --surface:#f7f7f5; --line:#e6e6e2; --ink:#171717; --muted:#6b6b66; --accent:#111827; --ok:#137333; --warn:#a33a16; --tag:#ecece8; }
    @media (prefers-color-scheme: dark) { :root { --bg:#181817; --surface:#222220; --line:#363633; --ink:#f4f4f1; --muted:#aaa9a2; --accent:#f4f4f1; --ok:#69d18a; --warn:#ff9d7b; --tag:#2d2d2a; } }
    * { box-sizing:border-box; }
    body { margin:0; padding:0; background:transparent; color:var(--ink); font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .manifest { width:100%; max-width:760px; border:1px solid var(--line); border-radius:18px; overflow:hidden; background:var(--bg); box-shadow:0 14px 42px rgba(0,0,0,.08); }
    header { padding:20px 22px 16px; border-bottom:1px solid var(--line); display:flex; gap:16px; align-items:flex-start; justify-content:space-between; }
    .eyebrow { margin:0 0 7px; color:var(--muted); font-size:11px; letter-spacing:.1em; text-transform:uppercase; font-weight:750; }
    h1 { margin:0; font-size:21px; letter-spacing:-.025em; line-height:1.25; }
    .revision { color:var(--muted); font-size:12px; margin-top:5px; }
    .status { flex:none; border-radius:999px; padding:7px 10px; font-size:11px; font-weight:800; letter-spacing:.035em; background:color-mix(in srgb, var(--warn) 12%, transparent); color:var(--warn); }
    .status.ready { color:var(--ok); background:color-mix(in srgb, var(--ok) 12%, transparent); }
    main { padding:18px 22px 20px; display:grid; gap:16px; }
    .objective { font-size:15px; line-height:1.55; margin:0; }
    .objective small { display:block; color:var(--muted); font-size:11px; margin-bottom:4px; font-weight:700; }
    .metrics { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
    .metric { border:1px solid var(--line); background:var(--surface); border-radius:12px; padding:11px 12px; min-width:0; }
    .metric strong { display:block; font-size:20px; letter-spacing:-.04em; }
    .metric span { display:block; color:var(--muted); font-size:10px; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    section { border-top:1px solid var(--line); padding-top:15px; }
    .section-title { display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:8px; }
    h2 { margin:0; font-size:12px; letter-spacing:.02em; }
    .count { color:var(--muted); font-size:11px; }
    ul { list-style:none; padding:0; margin:0; display:grid; gap:7px; }
    li { display:grid; grid-template-columns:auto 1fr; gap:9px; font-size:12px; line-height:1.45; align-items:start; }
    .id { color:var(--muted); font:10px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; padding-top:2px; }
    .decision strong { display:block; font-size:12px; margin-bottom:1px; }
    .decision span { color:var(--muted); }
    .flag { color:var(--warn); font-weight:800; }
    .empty { color:var(--muted); font-size:12px; margin:0; }
    footer { border-top:1px solid var(--line); padding:11px 22px; display:flex; justify-content:space-between; gap:12px; color:var(--muted); font:10px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; }
    .error { padding:20px; color:var(--warn); font-size:13px; }
    @media (max-width:560px) { header, main { padding-left:16px; padding-right:16px; } .metrics { grid-template-columns:repeat(2,1fr); } footer { padding-left:16px; padding-right:16px; flex-direction:column; } }
  </style>
</head>
<body>
  <article class="manifest" id="root" aria-live="polite"><div class="error">Planning Manifest를 불러오는 중입니다.</div></article>
  <script>
    const root = document.getElementById('root');
    function el(tag, className, text) { const node=document.createElement(tag); if(className) node.className=className; if(text !== undefined) node.textContent=String(text); return node; }
    function list(items, render) { const ul=el('ul'); items.forEach(item=>ul.appendChild(render(item))); return ul; }
    function section(title, items, render, emptyText) { const s=el('section'); const head=el('div','section-title'); head.append(el('h2','',title),el('span','count',items.length)); s.appendChild(head); s.appendChild(items.length ? list(items,render) : el('p','empty',emptyText)); return s; }
    function render(data) {
      if (!data || !data.manifest || data.manifest.schemaVersion !== '1.0.0') { root.innerHTML=''; root.appendChild(el('div','error','Manifest schema를 확인할 수 없습니다. 내용을 추측해 표시하지 않았습니다.')); return; }
      const m=data.manifest; root.innerHTML='';
      const header=el('header'); const titleWrap=el('div'); titleWrap.append(el('p','eyebrow','Planning Manifest'),el('h1','',m.projectId),el('div','revision','Revision '+m.projectRevision+' · '+m.objective.status));
      const status=el('span','status '+(m.readiness.status==='ready'?'ready':''),m.readiness.status==='ready'?'READY':'NOT READY'); header.append(titleWrap,status); root.appendChild(header);
      const main=el('main'); const objective=el('p','objective'); objective.append(el('small','','CONFIRMED INTENT'),document.createTextNode(m.objective.statement)); main.appendChild(objective);
      const metrics=el('div','metrics'); [[m.acceptedDecisions.length,'확정 결정'],[m.openQuestions.length,'열린 질문'],[m.readiness.blockers.length,'Blocker'],[m.evidenceHealth.externalEvidence,'외부 근거']].forEach(([value,label])=>{ const card=el('div','metric'); card.append(el('strong','',value),el('span','',label)); metrics.appendChild(card); }); main.appendChild(metrics);
      main.appendChild(section('확정된 결정',m.acceptedDecisions,(item)=>{ const li=el('li'); li.append(el('span','id',item.id)); const body=el('div','decision'); body.append(el('strong','',item.decision),el('span','',item.question+' · 근거 '+item.evidenceCount)); li.appendChild(body); return li; },'아직 사용자에게 확정받은 결정이 없습니다.'));
      main.appendChild(section('지금 풀어야 할 질문',m.openQuestions,(item)=>{ const li=el('li'); li.append(el('span',item.blocking?'flag':'id',item.blocking?'BLOCK':'OPEN'),el('span','',item.question)); return li; },'열린 질문이 없습니다.'));
      main.appendChild(section('최근 변경',m.recentChanges,(item)=>{ const li=el('li'); li.append(el('span',item.blocking?'flag':'id',item.id),el('span','',item.summary)); return li; },'아직 기록된 변경이 없습니다.'));
      root.appendChild(main); const footer=el('footer'); footer.append(el('span','','snapshot '+data.snapshotId),el('span','',data.contentHash.slice(0,27)+'…')); root.appendChild(footer);
    }
    render(window.openai?.toolOutput);
    window.addEventListener('message',(event)=>{ if(event.source!==window.parent) return; const msg=event.data; if(msg?.jsonrpc==='2.0' && msg.method==='ui/notifications/tool-result') render(msg.params?.structuredContent); },{passive:true});
    window.addEventListener('openai:set_globals',(event)=>render(event.detail?.globals?.toolOutput ?? window.openai?.toolOutput),{passive:true});
  </script>
</body>
</html>`;
}
