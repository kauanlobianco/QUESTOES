"""Gera banco-questoes/preview_quiz.html a partir do banco único (banco-final/banco-questoes.json).
Uso: python scripts/montar_banco_final.py && python scripts/gerar_preview.py"""
import glob, json, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
questoes = []
for p in [os.path.join(BASE, "banco-final", "banco-questoes.json")]:
    questoes += json.load(open(p, encoding="utf-8"))["questoes"]
dados = json.dumps(questoes, ensure_ascii=False).replace("</", "<\\/")

HTML = r"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Preview do Quiz</title>
<style>
:root{--bg:#f6f5f2;--card:#fff;--ink:#1d1d1f;--muted:#6b6b70;--line:#e3e1dc;--ok:#1f8a4c;--okbg:#e6f4ec;--bad:#c0392b;--badbg:#fbeaea;--chip:#efeee9;
--EMP:#e67e22;--EST:#7d3cff;--FIN:#1f8a4c;--LID:#d63a4a;--MKT:#e0458f;--OPE:#1b8ea8}
@media (prefers-color-scheme:dark){:root{--bg:#141416;--card:#1e1e22;--ink:#ececee;--muted:#a1a1a8;--line:#2e2e34;--okbg:#14301f;--badbg:#3a1a1a;--chip:#2a2a30}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
header{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line);padding:12px 16px}
h1{font-size:18px;margin:0 0 8px}.filtros{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
select,input[type=search],input[type=number]{background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:6px 8px;font:inherit}
label.chk{font-size:13px;color:var(--muted);display:flex;gap:4px;align-items:center}
.resumo{font-size:13px;color:var(--muted);margin-top:6px}
main{max-width:860px;margin:0 auto;padding:16px}
.card{background:var(--card);border:1px solid var(--line);border-left:6px solid var(--area);border-radius:14px;padding:16px;margin-bottom:16px}
.meta{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}.chip{background:var(--chip);border-radius:999px;padding:2px 10px;font-size:12px;color:var(--muted)}
.chip.area{background:var(--area);color:#fff;font-weight:600}.chip.base{background:#f1c40f;color:#222;font-weight:600}.chip.web{background:#2d7ff9;color:#fff}
.cen{background:var(--chip);border-radius:10px;padding:10px 12px;margin:8px 0;font-size:14px}.cen b{display:block;margin-bottom:4px}
.enun{font-weight:600;font-size:16px;margin:10px 0}
.alts{display:grid;gap:8px}.alt{text-align:left;background:var(--card);color:var(--ink);border:2px solid var(--line);border-radius:10px;padding:10px 12px;font:inherit;cursor:pointer}
.alt:hover{border-color:var(--area)}.alt.ok{border-color:var(--ok);background:var(--okbg)}.alt.bad{border-color:var(--bad);background:var(--badbg)}.alt.off{opacity:.35;pointer-events:none}
.alt .fb{display:none;font-size:13px;margin-top:6px;color:var(--muted)}.mostrar .alt .fb{display:block}
.acoes{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.btn{background:var(--chip);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:6px 10px;font:inherit;font-size:13px;cursor:pointer}
.resp{display:none;margin-top:12px;border-top:1px dashed var(--line);padding-top:10px}.respondida .resp{display:block}
.curto{font-weight:600}.curto.ok{color:var(--ok)}.curto.bad{color:var(--bad)}.det{font-size:13px;color:var(--muted);margin-top:6px}
details{margin-top:8px;font-size:13px;color:var(--muted)}pre{white-space:pre-wrap;font-size:12px}
.bar{height:6px;background:var(--chip);border-radius:3px;overflow:hidden;margin:8px 0}.bar i{display:block;height:100%;width:100%;background:var(--area);transition-property:width;transition-timing-function:linear}
.oculta .cen,.oculta .enun,.oculta .alts,.oculta .acoes{filter:blur(7px);pointer-events:none;user-select:none}
.vazio{text-align:center;color:var(--muted);padding:40px}
</style></head><body>
<header><h1>Preview do Quiz — Mestre dos Negócios</h1>
<div class="filtros">
<select id="fArea"><option value="">Todas as áreas</option><option value="EMP">Empreendedorismo</option><option value="EST">Estratégia</option><option value="FIN">Finanças</option><option value="LID">Liderança</option><option value="MKT">Marketing</option><option value="OPE">Operações</option></select>
<select id="fMec"><option value="">Todas as mecânicas</option><option value="giro">Giro</option><option value="coroa">Coroa</option><option value="duelo">Duelo</option><option value="desempate">Desempate</option></select>
<select id="fBloom"><option value="">Todo Bloom</option><option>lembrar</option><option>entender</option><option>aplicar</option><option>analisar</option><option>avaliar</option></select>
<select id="fFonte"><option value="">Fonte NLM e WEB</option><option value="NLM">Só NLM</option><option value="WEB">Contém WEB</option></select>
<input id="fBusca" type="search" placeholder="Buscar texto ou ID">
<select id="fDif"><option value="">Toda dificuldade</option><option>1</option><option>2</option><option>3</option><option>4</option></select>
<label class="chk"><input id="fShuf" type="checkbox">Embaralhar alternativas</label>
<label class="chk"><input id="fTimer" type="checkbox" checked>Timer do jogo</label>
<button class="btn" id="bReset">Zerar respostas</button>
</div><div class="resumo" id="resumo"></div></header>
<main id="lista"></main>
<script id="dados" type="application/json">__DADOS__</script>
<script>
const Q=JSON.parse(document.getElementById('dados').textContent);
const NOMES={EMP:'Empreendedorismo',EST:'Estratégia',FIN:'Finanças',LID:'Liderança',MKT:'Marketing',OPE:'Operações'};
const placar={c:0,t:0};const $=id=>document.getElementById(id);
function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function filtrar(){const d=$('fDif').value,a=$('fArea').value,m=$('fMec').value,b=$('fBloom').value,f=$('fFonte').value,s=$('fBusca').value.toLowerCase();
return Q.filter(q=>(!d||q.dificuldade==d)&&(!a||q.area===a)&&(!m||q.mecanicas.includes(m))&&(!b||q.bloom===b)
&&(!f||(f==='NLM'?q.fonte.origem==='NLM':q.fonte.origem.includes('WEB')))&&(!s||JSON.stringify(q).toLowerCase().includes(s)))}
function card(q){const el=document.createElement('article');el.className='card';el.style.setProperty('--area',`var(--${q.area})`);
const base=false;
let h=`<div class="meta"><span class="chip area">${NOMES[q.area]}</span><span class="chip">${esc(q.id)}</span><span class="chip">${esc(q.subtema)} · ${esc(q.microtema)}</span>
<span class="chip">${q.mecanicas.join(' + ')}</span><span class="chip">Bloom: ${q.bloom}</span><span class="chip">dif. ${q.dificuldade}/5</span><span class="chip">${q.tempo_seg}s · ${q.xp} XP</span>
<span class="chip ${q.fonte.origem.includes('WEB')?'web':''}">${q.fonte.origem}</span>${base?'<span class="chip base">Base original</span>':''}
${(q.areas_secundarias||[]).map(x=>`<span class="chip">+ ${NOMES[x]}</span>`).join('')}${q.validade?.tipo==='datado'?`<span class="chip">datado: ${esc(q.validade.referencia)}</span>`:''}</div>`;
const tm=$('fTimer').checked;if(tm){el.classList.add('oculta');h+=`<div><button class="btn bstart">▶ Começar · ${q.tempo_seg}s</button><div class="bar"><i></i></div></div>`}
if(q.cenario)h+=`<div class="cen"><b>${esc(q.cenario.titulo||'Cenário')}</b>${esc(q.cenario.texto)}</div>`;
h+=`<div class="enun">${esc(q.enunciado)}</div>`;
if(q.tipo==='multipla_escolha'){const alts=$('fShuf').checked?shuffle(q.alternativas):q.alternativas;
h+=`<div class="alts">${alts.map((x,i)=>`<button class="alt" data-id="${x.id}"><b>${'ABCD'[i]})</b> ${esc(x.texto)}<div class="fb">${x.correta?'✔ Correta.':'✘ '+esc(x.feedback)+(x.erro_comum?` <i>(erro: ${esc(x.erro_comum)})</i>`:'')}</div></button>`).join('')}</div>
<div class="acoes"><button class="btn b50">Eliminar 2 (power-up)</button><button class="btn btodos">Ver feedback de todas</button></div>`}
else{h+=`<div class="acoes"><input type="number" step="any" class="num" placeholder="Sua resposta (${esc(q.resposta_numerica.unidade)})"><button class="btn bnum">Responder</button></div>`}
h+=`<div class="resp"><div class="curto"></div><div class="det">${esc(q.feedback.explicacao)}</div>
<details><summary>Fonte, revisão e origem</summary><p><b>Ficha:</b> ${esc(q.fonte.ficha)}${q.feedback.saiba_mais?` — ${esc(q.feedback.saiba_mais)}`:''}</p>
${q.fonte.arquivos?`<p><b>Arquivos NotebookLM:</b> ${q.fonte.arquivos.map(esc).join('; ')}</p>`:''}${q.fonte.urls?`<p><b>Web:</b> ${q.fonte.urls.map(u=>`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a>`).join('<br>')}</p>`:''}
${q.cenario?`<p><b>Artefato:</b> ${esc(q.cenario.artefato)} · <b>Restrição:</b> ${esc(q.cenario.restricao)}</p>`:''}
<p><b>Revisão (${esc(q.revisao.status)}):</b> ${esc(q.revisao.notas||'')}</p>
${base&&q.origem_questao.original?`<p><b>Questão original (${esc(q.origem_questao.ref)}):</b></p><pre>${esc(JSON.stringify(q.origem_questao.original,null,1))}</pre>`:''}</details></div>`;
el.innerHTML=h;
let t0=0,tid=0;const bar=el.querySelector('.bar i');
const fim=(ok,msg)=>{clearTimeout(tid);if(bar){bar.style.width=getComputedStyle(bar).width;bar.style.transitionDuration='0s'}
if(t0)msg=(msg?msg+' ':'')+`(${((Date.now()-t0)/1000).toFixed(1)}s de ${q.tempo_seg}s)`;el.classList.add('respondida');const c=el.querySelector('.curto');c.className='curto '+(ok?'ok':'bad');c.textContent=(ok?'Acertou! ':'Errou. ')+msg+' — '+q.feedback.curto;placar.t++;if(ok)placar.c++;resumo()};
el.querySelectorAll('.alt').forEach(b=>b.onclick=()=>{if(el.classList.contains('respondida'))return;const x=q.alternativas.find(a=>a.id===b.dataset.id);
el.querySelectorAll('.alt').forEach(o=>{const y=q.alternativas.find(a=>a.id===o.dataset.id);if(y.correta)o.classList.add('ok')});
if(!x.correta)b.classList.add('bad');b.querySelector('.fb').style.display='block';fim(x.correta,x.correta?'':x.feedback)});
const bs=el.querySelector('.bstart');if(bs)bs.onclick=()=>{el.classList.remove('oculta');bs.style.display='none';t0=Date.now();
bar.style.transitionDuration=q.tempo_seg+'s';requestAnimationFrame(()=>requestAnimationFrame(()=>bar.style.width='0%'));
tid=setTimeout(()=>{if(el.classList.contains('respondida'))return;el.querySelectorAll('.alt').forEach(o=>{if(q.alternativas.find(a=>a.id===o.dataset.id)?.correta)o.classList.add('ok')});t0=0;fim(false,'Tempo esgotado!')},q.tempo_seg*1000)};
const b50=el.querySelector('.b50');if(b50)b50.onclick=()=>{const er=shuffle([...el.querySelectorAll('.alt')].filter(o=>!q.alternativas.find(a=>a.id===o.dataset.id).correta)).slice(0,2);er.forEach(o=>o.classList.add('off'));b50.disabled=true};
const bt=el.querySelector('.btodos');if(bt)bt.onclick=()=>el.classList.toggle('mostrar');
const bn=el.querySelector('.bnum');if(bn)bn.onclick=()=>{if(el.classList.contains('respondida'))return;const v=parseFloat(el.querySelector('.num').value);const r=q.resposta_numerica;
const ok=Math.abs(v-r.valor)<=r.tolerancia;const e=(r.valores_errados_comuns||[]).find(x=>x.valor===v);fim(ok,ok?'':`Resposta: ${r.valor} ${r.unidade}. Diferença: ${isNaN(v)?'—':Math.abs(v-r.valor)}.${e?' Erro típico: '+e.erro_comum+'.':''}`)};
return el}
function resumo(){const v=filtrar();$('resumo').textContent=`${v.length} de ${Q.length} questões · placar desta sessão: ${placar.c}/${placar.t}`}
function render(){const v=filtrar(),L=$('lista');L.innerHTML='';if(!v.length)L.innerHTML='<div class="vazio">Nenhuma questão com esses filtros.</div>';v.forEach(q=>L.appendChild(card(q)));resumo()}
['fArea','fMec','fBloom','fFonte','fShuf','fDif','fTimer'].forEach(i=>$(i).onchange=render);$('fBusca').oninput=render;$('bReset').onclick=()=>{placar.c=placar.t=0;render()};render();
</script></body></html>"""

out = os.path.join(BASE, "preview_quiz.html")
open(out, "w", encoding="utf-8").write(HTML.replace("__DADOS__", dados))
print(f"{out} — {len(questoes)} questões")
