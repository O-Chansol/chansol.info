/* [웹판 추가 R12] 서가, 설정, 원본 대조, 자동 저장, 컴퓨터 조작과 접근성 UI.
 * 외부 서비스에 플레이 기록을 보내지 않는다. 실행 규칙은 engine.js, 근거는 data.js.
 */
(() => {
  'use strict';
  const D=window.MarbleData,E=window.MarbleEngine,$=s=>document.querySelector(s);
  const colors=['#bc6749','#436c58','#667cad','#b18b3e','#8a6695','#568b8c','#ad6480','#68703d','#936c4c','#52657e'];
  const groups={red:'#d68e85',yellow:'#d7c267',green:'#88ac85',blue:'#8caac4',purple:'#b099c7',orange:'#d5a066',brown:'#ba9473',heart:'#d89e9e',planet:'#a2adc5',country:'#9cac8f'};
  const SAVE_KEY='chansol-world-marble-v1';
  let state=null,page='library',filter='all',search='',selected=0,readable=false,zoom=1,botsPaused=false,botTimer=null,rolling=false,actionTimer=null,toastTimer=null,sourceRotation=0,saveOk=true;
  const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const era=m=>m.era==='sketchbook'?'스케치북 시기':'종합장 시기';
  const controlsPlayer=()=>state?.players[state.pending?.controller??state.current];
  const isComputer=()=>Boolean(controlsPlayer()?.bot);
  const actionsBlocked=()=>rolling||isComputer();
  function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,5000);}
  function loadSave(){try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)return;if(raw.length>2e6)throw Error();const saved=JSON.parse(raw);if(!E.validateSave(saved))throw Error();state=saved;$('#resume-button').hidden=false;$('#game-nav').hidden=false;}catch{toast('저장된 판을 읽지 못했습니다. 새 판을 시작할 수 있습니다.');}}
  function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));saveOk=true;}catch{saveOk=false;}$('#save-status').textContent=saveOk?'이 브라우저에 자동 저장됩니다.':'자동 저장을 사용할 수 없습니다. 브라우저를 닫으면 진행을 잃을 수 있어요.';}
  function showPage(next){
    if(next==='game'&&!state)return;clearTimeout(botTimer);page=next;
    for(const p of ['library','game','notes'])$('#'+p+'-page').hidden=p!==next;
    document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===next));
    if(next==='game'){renderGame();scheduleBot();}
    if(next==='notes')renderNotes();
    document.title=next==='game'?`${E.mapOf(state).title} — 세계의 마블`:'세계의 마블 — 다시 펼친 보드게임';
    window.scrollTo({top:0,behavior:'instant'});
  }
  function renderLibrary(){
    const maps=D.maps.filter(m=>(filter==='all'||m.era===filter)&&m.title.toLowerCase().includes(search.toLowerCase()));
    $('#map-grid').innerHTML=maps.map((m,i)=>`<button class="map-card" data-setup="${m.id}" aria-label="${escape(m.title)} 설정, ${m.players[0]}에서 ${m.players[1]}인">
      <div class="map-thumbnail"><img src="${escape(m.source)}" alt="${escape(m.title)} 원본 판" loading="lazy" decoding="async"></div>
      <div class="map-card-body"><div class="map-kicker"><span>${m.era==='sketchbook'?'SKETCHBOOK':'NOTEBOOK'} / ${String(D.maps.filter(x=>x.era===m.era).indexOf(m)+1).padStart(2,'0')}</span>${m.status?`<span class="status-badge">${escape(m.status)}</span>`:''}</div><h3>${escape(m.title)}</h3><div class="map-meta"><span>${m.players[0]===m.players[1]?m.players[0]:m.players.join('–')}인</span><span>${m.layout==='cross'?'갈림길':m.mode==='race'?'도착 경주':m.mode==='laps'?'5바퀴 경주':'도시 · 아이템'}</span><span class="card-arrow">↗</span></div></div></button>`).join('')||'<p class="empty-search">이름이 일치하는 맵이 없습니다.</p>';
  }
  function openSetup(id){
    clearTimeout(botTimer);const map=D.maps.find(m=>m.id===id);if(!map)return;
    $('#setup-map').value=id;$('#setup-title').textContent=map.title;$('#setup-description').textContent=`${era(map)} · ${map.cells.length}칸${map.duration?` · 원본 예상 시간 ${map.duration}`:''}`;
    $('#setup-count').innerHTML=Array.from({length:map.players[1]-map.players[0]+1},(_,i)=>`<option value="${map.players[0]+i}">${map.players[0]+i}명</option>`).join('');
    $('#setup-capital').value=map.capital;$('#capital-hint').textContent=`${E.money(map.capital)}로 시작합니다. 주회 보너스 ${E.money(map.salary)}.`;
    $('#setup-notice').innerHTML=`${map.status?`<strong>${escape(map.status)} · </strong>`:''}${escape(map.notes?.[0]||'원본 판의 글씨와 남아 있는 설명서를 함께 읽어 복원했습니다.')}<br>기본 20라운드와 초기 자금·카드 효과는 보완 규칙입니다. ‘복원 노트’에서 모두 확인할 수 있습니다.`;
    $('#bad-place-label').hidden=id!=='business';$('#bad-place').innerHTML=map.cells.map((t,i)=>`<option value="${i}">${i+1}. ${escape(t.name)}</option>`).join('');
    $('#setup-error').textContent='';$('#overwrite-notice').hidden=!state||state.phase==='gameover';renderNames();$('#setup-dialog').showModal();
  }
  function renderNames(){const count=Number($('#setup-count').value),bots=$('#setup-mode').value==='bots';const old=[...document.querySelectorAll('.setup-name')].map(i=>i.value);
    $('#setup-names').innerHTML=Array.from({length:count},(_,i)=>`<label><span style="color:${colors[i]}">●</span> ${i+1}번 ${bots&&i?'컴퓨터':'플레이어'}<input class="setup-name" type="text" maxlength="24" aria-label="${i+1}번 이름" value="${escape(old[i]||(bots?(i?'컴퓨터 '+i:'나'):'플레이어 '+(i+1)))}" required></label>`).join('');}
  function startGame(event){event.preventDefault();try{
    const names=[...document.querySelectorAll('.setup-name')].map(i=>i.value.trim());if(names.some(n=>!n))throw Error('플레이어 이름을 입력해 주세요.');
    state=E.newGame({mapId:$('#setup-map').value,count:Number($('#setup-count').value),mode:$('#setup-mode').value,names,roundLimit:Number($('#setup-rounds').value),capital:Number($('#setup-capital').value),badPlace:Number($('#bad-place').value)});
    clearTimeout(actionTimer);rolling=false;botsPaused=false;selected=state.players[state.current].pos;zoom=1;readable=false;
    $('#setup-dialog').close();$('#game-nav').hidden=false;$('#resume-button').hidden=false;save();showPage('game');
  }catch(error){$('#setup-error').textContent=error.message;}}
  function act(action,animate=false){
    clearTimeout(botTimer);if(rolling)return;
    if(animate){rolling=true;$('#dice').classList.add('rolling');renderActions();actionTimer=setTimeout(()=>{rolling=false;perform(action);},450);}else perform(action);
  }
  function perform(action){
    try{const previous=state.phase;state=E.execute(state,action);selected=E.current(state).pos;save();renderGame();if(previous!=='gameover'&&state.phase==='gameover')showResults();scheduleBot();}
    catch(error){if(isComputer()){botsPaused=true;renderActions();}toast(error.message);scheduleBot();}
  }
  function scheduleBot(){clearTimeout(botTimer);if(page!=='game'||!state||state.phase==='gameover'||botsPaused||rolling||document.querySelector('dialog[open]'))return;
    if(isComputer())botTimer=setTimeout(()=>{const action=E.autoAction(state);if(action)act(action,action.type==='roll');},850);
  }
  function renderGame(){
    if(!state)return;const m=E.mapOf(state),p=E.current(state);
    $('#game-era').textContent=`${era(m)} / ${m.cells.length}칸${m.status?' / '+m.status:''}`;$('#game-title').textContent=m.title;
    $('#players').innerHTML=state.players.map(x=>`<div class="player-card ${x.id===p.id?'current':''} ${x.out?'out':''}" style="--player-color:${colors[x.id]}"><div class="player-card-head"><span class="player-avatar">${x.id+1}</span><span>${escape(x.name)}</span><span class="player-type">${x.bot?'COM':'사람'}</span></div><strong>${E.money(x.cash)}</strong><small>${x.out?'탈락':`${E.owned(state,x.id).filter(i=>!state.estates[i].blocked).length}개 소유${x.held?' · 큰 무인도':x.skip?` · ${x.skip}회 휴식`:''}${x.team!==null?' · '+(x.team+1)+'팀':''}`}</small></div>`).join('');
    renderBoard();renderActions();renderTile();renderInventory();renderEstates();
    $('#game-log').innerHTML=state.log.slice(-35).reverse().map(entry=>`<li><small>${entry.turn}</small>${escape(entry.message)}</li>`).join('');
    $('#save-status').textContent=saveOk?'이 브라우저에 자동 저장됩니다.':'자동 저장을 사용할 수 없습니다. 브라우저를 닫으면 진행을 잃을 수 있어요.';
  }
  function renderBoard(){
    const m=E.mapOf(state),board=$('#board'),p=E.current(state);
    board.className='board'+(readable?' readable':'')+(m.synthetic?' synthetic':'')+(m.mode==='race'?' race':'');board.style.width=(zoom*100)+'%';
    if($('#board-image').getAttribute('src')!==m.source)$('#board-image').src=m.source;
    $('#board-image').alt=m.title+' 원본 판';$('#zoom-label').textContent=Math.round(zoom*100)+'%';
    $('#original-view').classList.toggle('active',!readable);$('#readable-view').classList.toggle('active',readable);
    const q=state.phase==='choice'?state.pending:null,targetKinds=['build','freebuild','landmark','travel','install','destroy','swapMine','swapOther'];
    const targetSet=q&&targetKinds.includes(q.kind)?new Set(q.choices.map(c=>String(c.value))):null;
    $('#board-tiles').innerHTML=m.cells.map((t,i)=>{
      const e=state.estates[i],trap=state.traps.find(x=>x.tile===i);const title=`${i+1}. ${t.name}${t.type==='property'?` · 건설 ${E.money(t.cost)} · 통행료 ${E.money(t.rent)}`:''}${t.note?' · 복원 주석 있음':''}`;
      return `<button class="board-tile ${i===selected?'selected':''} ${i===p.pos?'current-tile':''}" data-tile="${i}" data-kind="${t.type}" style="left:${t.x}%;top:${t.y}%;width:${t.w}%;height:${t.h}%;--tile-color:${groups[t.group]||'#a8b99b'}" aria-label="${escape(title)}" title="${escape(title)}"><span class="tile-index">${i+1}</span><span class="tile-readable">${escape(t.name)}${t.type==='property'?`<small>${E.money(t.cost).replace('원','')}</small>`:''}</span>${e?`<span class="tile-owner" style="--player-color:${colors[e.owner]}">${e.blocked?'건설 금지':`${e.owner+1}번 · ${e.level}단계${e.damaged?' · 화재':''}`}</span>`:''}${trap?`<span class="tile-trap">${escape(E.itemName(trap.kind))}</span>`:''}${!e&&t.note?'<span class="tile-uncertain">주석</span>':''}${targetSet?.has(String(i))?'<span class="tile-trap">선택 가능</span>':''}</button>`;
    }).join('');
    // [R12] 기존 말 노드를 재사용해 이전 위치에서 새 위치까지 화면상으로 이동한다.
    const tokens=$('#board-tokens');
    for(const x of state.players){let el=tokens.querySelector(`[data-player="${x.id}"]`);if(x.out){el?.remove();continue;}if(!el){el=document.createElement('div');el.dataset.player=x.id;tokens.append(el);}const t=m.cells[x.pos];
      const peers=state.players.filter(y=>!y.out&&y.pos===x.pos),rank=peers.findIndex(y=>y.id===x.id),cols=Math.min(3,peers.length),rows=Math.ceil(peers.length/cols);
      el.className='pawn'+(x.id===p.id?' current':'');el.textContent=x.id+1;el.setAttribute('aria-label',`${x.name}: ${t.name}`);el.style.setProperty('--player-color',colors[x.id]);
      el.style.left=(t.x+t.w/2+(rank%cols-(cols-1)/2)*Math.min(2.3,t.w/cols))+'%';el.style.top=(t.y+t.h*.53+(Math.floor(rank/cols)-(rows-1)/2)*Math.min(3,t.h/rows))+'%';
    }
    $('#cell-list-content').innerHTML=m.cells.map((t,i)=>`<button data-tile="${i}">${i+1}. ${escape(t.name)}${t.note?' <span class="orange">*</span>':''}</button>`).join('');
  }
  function renderActions(){
    const p=E.current(state),controller=controlsPlayer();$('#round-label').textContent=`${state.roundLimit?Math.min(state.round,state.roundLimit):state.round}${state.roundLimit?' / '+state.roundLimit:''} 라운드 · ${state.turn}번째 차례`;
    $('#turn-name').textContent=state.phase==='gameover'?'여행을 마쳤어요':controller.name+'의 차례';
    $('#turn-status').textContent=state.phase==='choice'?state.pending.title:state.phase==='debt'?`${state.pending.label}: ${E.money(state.pending.amount)}가 필요해요.`:state.message;
    $('#pause-bots').hidden=!state.players.some(x=>x.bot);$('#pause-bots').textContent=botsPaused?'자동 진행 재개':'자동 진행 멈춤';
    const patterns={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
    $('#dice').classList.toggle('rolling',rolling);$('#dice').setAttribute('aria-label',`주사위 ${state.dice.join(', ')}`);
    $('#dice').innerHTML=state.dice.map(v=>`<div class="die" aria-hidden="true">${Array.from({length:9},(_,i)=>`<span class="${patterns[v].includes(i)?'':'empty'}"></span>`).join('')}</div>`).join('');
    const automated=isComputer(),disabled=automated||rolling;
    let html='';
    if(state.phase==='gameover')html='<div class="gameover-actions"><button class="primary" data-action="results">결과 다시 보기 →</button><button class="subtle" data-action="new">새 판 펼치기</button></div>';
    else if(state.phase==='choice')html=`<div class="choice-list">${state.pending.choices.map(c=>`<button data-choice="${escape(c.value)}" ${disabled?'disabled':''}>${escape(c.label)}</button>`).join('')}</div>`;
    else if(state.phase==='debt')html=`<p class="debt-warning">아래 소유지를 팔아 돈을 마련하세요.<br>부족한 돈: ${E.money(Math.max(0,state.pending.amount-p.cash))}</p><button class="subtle wide" data-action="bankrupt" ${disabled?'disabled':''}>파산하고 이번 판에서 나가기</button>`;
    else if(state.phase==='roll')html=`<button class="primary" data-action="roll" ${disabled?'disabled':''}>${rolling?'주사위를 굴리는 중…':p.skip||p.held?'이번 차례 쉬기':'주사위 굴리기'} <span>${p.skip||p.held?'→':'⚄'}</span></button>`;
    else html=`<button class="primary" data-action="end" ${disabled?'disabled':''}>${state.double&&!p.skip&&!p.held&&!p.travel?'더블 · 한 번 더 굴리기':'차례 마치기'} <span>→</span></button>`;
    if(automated&&state.phase!=='gameover')html+=`<div class="computer-label">${botsPaused?'자동 진행을 멈췄어요. 재개 버튼을 누르세요.':escape(controller.name)+'가 생각하고 있어요…'}</div>`;
    $('#turn-actions').innerHTML=html;
  }
  const typeLabels={property:'도시 · 건설',start:'출발점',item:'아이템',card:'카드',rest:'휴식',block:'이동 제한',travel:'여행',blank:'통과 칸',junction:'갈림길',freebuild:'무료 건설'};
  const typeRules={property:'빈 도시는 건설할 수 있고, 상대 소유지에서는 통행료를 냅니다. 재방문하면 증축할 수 있습니다. [R03]',start:'자신의 출발점을 앞으로 통과하면 주회 보너스를 받습니다. 순간이동은 제외합니다. [R08]',item:'복원한 아이템 6종 중 하나를 무작위로 얻습니다. [R06]',card:'설명서에 남은 카드 이름 10종 중 하나를 얻습니다. 효과·확률은 보완했습니다. [R05]',block:'바로 앞에서 1회 멈춘 뒤, 다음 이동에 통과합니다. [R08]',rest:'이 칸에 적힌 횟수만큼 자기 차례를 쉽니다. 탈출권을 사용할 수 있습니다. [R09]',travel:'일반 에어쇼는 다음 자기 차례, 즉시 이동 문구가 있는 칸은 지금 목적지를 고릅니다. [R08]',blank:'도착해도 효과가 없는 칸입니다. 빈칸을 그대로 보존했습니다. [R13/R14]',junction:'중앙에 들어오면 방향을 고릅니다. 끝에서는 되돌아옵니다. [R15]',diamond:'다이아는 개당 5천만원, 한 번에 2개까지. 건설에는 3개 이상이 필요합니다. [R16]',festival:'다음에 받는 통행료 1회를 2배로 합니다. [보완 R20]',bigIsland:'다른 말이 이곳에 올 때까지 기다립니다. 탈출권을 사용할 수 있습니다. [R09]'};
  function renderTile(){
    const m=E.mapOf(state),t=m.cells[selected]||m.cells[0],e=state.estates[t.id],q=state.pending;
    const canChoose=state.phase==='choice'&&['freebuild','landmark','travel','install','destroy','swapMine','swapOther'].includes(q.kind)&&q.choices.some(c=>String(c.value)===String(t.id));
    $('#tile-detail').innerHTML=`<span class="detail-tag">${t.id+1}번째 칸 · ${escape(typeLabels[t.type]||'특수 칸')}</span><h2 style="margin-top:12px">${escape(t.name)}</h2>${t.type==='property'?`<div class="detail-price"><span>건설비</span><strong>${E.money(t.cost)}</strong></div><div class="detail-price"><span>기본 통행료</span><strong>${E.money(t.rent)}</strong></div>${e?`<p>${e.blocked?'건설 금지':escape(state.players[e.owner].name)+' 소유 · '+e.level+'단계 · 현재 통행료 '+E.money(e.rent)}</p>`:''}`:''}${t.amount!==undefined?`<div class="detail-price"><span>금액</span><strong>${E.money(t.amount)}</strong></div>`:''}${t.turns?`<p>${t.turns}회 휴식</p>`:''}<p>${escape(typeRules[t.type]||'판에 남은 글씨를 바탕으로 실행합니다. 자세한 해석은 이 판의 주석과 공통 복원 노트에 기록했습니다.')}</p>${t.note?`<p class="detail-note"><strong>전사 · 보완 주석</strong><br>${escape(t.note)}</p>`:'<p class="small">칸 이름·표시 수치를 사진에서 전사했습니다. 실행 방식에는 공통 보완 규칙이 적용됩니다.</p>'}${canChoose?`<button class="primary wide" data-choice="${t.id}" ${actionsBlocked()?'disabled':''}>이 칸 선택 →</button>`:''}<button class="source-button" data-source-map="${m.id}">이 칸의 원본 사진 보기 ↗</button>`;
  }
  function renderInventory(){
    const p=E.current(state),blocked=actionsBlocked()||!['roll','end','debt'].includes(state.phase);
    $('#inventory-count').textContent=(p.cards.length+p.items.length)+'개';
    function list(arr,item=false){const ids=[...new Set(arr)];return ids.map(id=>{const name=item?E.itemName(id):E.cardName(id);const desc=item?'ITEM 또는 아이템 지급 칸에서 설치합니다. R06/R07 참조.':D.cards.find(c=>c.id===id).description;return `<button class="inventory-card ${item?'item':''}" data-${item?'item':'card'}="${id}" title="${escape(desc)}" ${blocked||(item&&!E.canInstall(state))?'disabled':''}><span>${item?'◇':'▱'}</span>${escape(name)} <small>×${arr.filter(x=>x===id).length}</small></button>`;}).join('');}
    $('#inventory').innerHTML=`<div class="inventory-list">${list(p.cards)||'<span class="empty-text">가지고 있는 카드가 없어요.</span>'}</div><p class="inventory-subhead">설치할 아이템</p><div class="inventory-list">${list(p.items,true)||'<span class="empty-text">ITEM 칸에서 아이템을 얻어보세요.</span>'}</div><p class="inventory-help">아이템 설치는 ITEM·아이템 지급 칸에서만 가능해요.<br>방패·벌금 면제는 필요할 때 자동으로 사용합니다. ${p.diamonds?'다이아 '+p.diamonds+'개 · ':''}${p.gold?'순금 '+p.gold+'개 · ':''}대전 점수 ${p.coins.toLocaleString('ko-KR')}코인</p>`;
  }
  function renderEstates(){
    const p=E.current(state),m=E.mapOf(state),ids=E.owned(state,p.id),disabled=actionsBlocked()||!['roll','end','debt'].includes(state.phase);
    $('#estate-count').textContent=ids.filter(i=>!state.estates[i].blocked).length+'곳';
    $('#estate-list').innerHTML=ids.map(i=>{const e=state.estates[i];return `<div class="estate-row"><span>${escape(m.cells[i].name)}<small>${e.blocked?'건설 금지':e.level+'단계'} · 매각 ${E.money(e.paid/4)}</small></span><button data-sell="${i}" ${disabled?'disabled':''}>매각</button></div>`;}).join('')+p.assets.map((a,i)=>`<div class="estate-row"><span>${escape(a.name)}<small>매각 ${E.money(a.cost/4)}</small></span><button data-sell-asset="${i}" ${disabled?'disabled':''}>매각</button></div>`).join('')||'<p class="empty-text">아직 가진 도시가 없어요.<br>도착한 도시에서 첫 건물을 지어보세요.</p>';
  }
  function auditHTML(m,full=true){
    return `<p>${escape(era(m))} · ${m.cells.length}칸 · ${m.players.join('–')}인${m.status?' · '+escape(m.status):''}</p><button class="source-button" data-source-map="${m.id}">원본 사진과 비교 ↗</button><p>초기 자금 ${E.money(m.capital)} / 주회 보너스 ${E.money(m.salary)}. 초기 자금은 별도 표기가 없으면 R02 보완값입니다.</p>${(m.notes||[]).map(n=>`<p class="detail-note">${escape(n)}</p>`).join('')}<p>모든 칸에 공통 주석 R01–R24가 적용됩니다. 개별 주석이 없는 가격도 사진 판독을 옮긴 잠정 전사입니다. 경계 좌표는 사진에 맞춘 근사치입니다.</p>${full?`<ul class="audit-cells">${m.cells.map(t=>`<li><strong>${t.id+1}. ${escape(t.name)}</strong>${t.type==='property'?`건설 ${E.money(t.cost)} / 통행 ${E.money(t.rent)}<br>`:''}${t.turns?t.turns+'회 휴식<br>':''}${escape(t.note||typeRules[t.type]||'판의 표기 전사. 작동 방식은 공통 주석 및 맵별 보완 사항 참조.')}</li>`).join('')}</ul>`:''}`;
  }
  let notesRendered=false;
  function renderNotes(){if(notesRendered)return;notesRendered=true;
    $('#manuals').innerHTML=D.manuals.map((s,i)=>`<button class="source-card" data-manual="${i}"><img src="${escape(s.src)}" loading="lazy" alt="${escape(s.title)} 원본"><span>${escape(s.title)}</span></button>`).join('');
    $('#restoration-notes').innerHTML=Object.entries(D.NOTES).map(([id,text])=>`<article class="note-row" id="note-${id}"><h3>${id}</h3><p>${escape(text)}</p></article>`).join('');
    $('#map-audit').innerHTML=D.maps.map(m=>`<details class="map-audit-item" data-audit="${m.id}"><summary>${escape(m.title)} <small>· ${escape(era(m))}</small></summary><div></div></details>`).join('');
    document.querySelectorAll('[data-audit]').forEach(el=>el.addEventListener('toggle',()=>{if(el.open&&!el.lastElementChild.innerHTML)el.lastElementChild.innerHTML=auditHTML(D.maps.find(m=>m.id===el.dataset.audit));}));
  }
  function showMapNotes(){clearTimeout(botTimer);const m=E.mapOf(state);$('#map-note-content').innerHTML=`<h2>${escape(m.title)}</h2>${auditHTML(m)}`;$('#map-note-dialog').showModal();}
  function openSource(src,title,manual=false){clearTimeout(botTimer);$('#source-title').textContent=title;$('#source-image').onload=rotateSource;$('#source-image').src=src;$('#source-image').alt=title+' 원본';$('#full-source').href=src;$('#source-caption').textContent='보관 중인 원본 파일입니다. 회전은 보기 방향만 바꾸며 사진 파일은 수정하지 않습니다.';sourceRotation=manual?-90:0;$('#source-dialog').showModal();rotateSource();}
  function rotateSource(){const img=$('#source-image'),wrap=$('.source-image-wrap'),sideways=Math.abs(sourceRotation%180)===90;
    const w=img.naturalWidth||4032,h=img.naturalHeight||3024,scale=Math.min((wrap.clientWidth-12)/(sideways?h:w),(wrap.clientHeight-12)/(sideways?w:h));
    img.style.width=w*scale+'px';img.style.height=h*scale+'px';img.style.transform=`translate(-50%, -50%) rotate(${sourceRotation}deg)`;wrap.scrollTo(0,0);
  }
  function showResults(){clearTimeout(botTimer);if(!state.results)return;const r=state.results;
    $('#result-title').textContent=r.winners.map(id=>state.players[id].name).join(', ')+(r.winners.length>1?' 공동 우승!':'의 승리!');
    $('#result-reason').textContent=r.reason+(r.coins?` · ${r.coins.toLocaleString('ko-KR')}코인`:'');
    $('#result-ranks').innerHTML=r.ranks.map((p,i)=>`<div class="result-rank"><span>${i+1}. ${escape(p.name)} ${p.out?'(탈락)':''}</span><strong>${E.money(p.total)}</strong></div>`).join('');
    if(!$('#result-dialog').open)$('#result-dialog').showModal();
  }
  function download(name,text,type='text/plain;charset=utf-8'){const url=URL.createObjectURL(new Blob(['\ufeff'+text],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  document.addEventListener('click',event=>{
    const b=event.target.closest('button,a');if(!b)return;
    if(b.dataset.page)showPage(b.dataset.page);
    if(b.classList.contains('brand')){event.preventDefault();showPage('library');}
    if(b.dataset.filter){filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));renderLibrary();}
    if(b.dataset.setup)openSetup(b.dataset.setup);
    if(b.classList.contains('close-dialog'))b.closest('dialog').close();
    if(b.dataset.tile!==undefined&&state){selected=Number(b.dataset.tile);renderBoard();renderTile();}
    if(b.dataset.choice!==undefined&&!actionsBlocked())act({type:'choose',value:b.dataset.choice});
    if(b.dataset.card&&!actionsBlocked())act({type:'card',card:b.dataset.card});
    if(b.dataset.item&&!actionsBlocked())act({type:'item',item:b.dataset.item});
    if(b.dataset.sell!==undefined&&!actionsBlocked())act({type:'sell',tile:Number(b.dataset.sell)});
    if(b.dataset.sellAsset!==undefined&&!actionsBlocked())act({type:'sellAsset',index:Number(b.dataset.sellAsset)});
    if(b.dataset.sourceMap){const m=D.maps.find(x=>x.id===b.dataset.sourceMap);openSource(m.source,m.title);}
    if(b.dataset.manual!==undefined){const source=D.manuals[Number(b.dataset.manual)];openSource(source.src,source.title,true);}
    if(b.dataset.action){if(b.dataset.action==='results')showResults();else if(b.dataset.action==='new')openSetup(state.mapId);else if(!actionsBlocked())act({type:b.dataset.action},b.dataset.action==='roll');}
  });
  $('#quick-start').addEventListener('click',()=>openSetup('economy'));
  $('#resume-button').addEventListener('click',()=>showPage('game'));
  $('#map-search').addEventListener('input',event=>{search=event.target.value;renderLibrary();});
  $('#setup-form').addEventListener('submit',startGame);
  $('#setup-count').addEventListener('change',renderNames);
  $('#setup-mode').addEventListener('change',()=>{$('#setup-names').innerHTML='';renderNames();});
  $('#setup-capital').addEventListener('input',()=>{$('#capital-hint').textContent=E.money(Number($('#setup-capital').value)||0)+'로 시작합니다.';});
  $('#new-game-button').addEventListener('click',()=>openSetup(state.mapId));
  $('#map-notes-button').addEventListener('click',showMapNotes);
  $('#original-view').addEventListener('click',()=>{readable=false;renderBoard();});
  $('#readable-view').addEventListener('click',()=>{readable=true;renderBoard();});
  $('#zoom-in').addEventListener('click',()=>{zoom=Math.min(3,zoom+.5);renderBoard();});
  $('#zoom-out').addEventListener('click',()=>{zoom=Math.max(1,zoom-.5);renderBoard();});
  $('#source-link').addEventListener('click',()=>{const m=E.mapOf(state);openSource(m.source,m.title);});
  $('#rotate-source').addEventListener('click',()=>{sourceRotation+=90;rotateSource();});
  window.addEventListener('resize',()=>{if($('#source-dialog').open)rotateSource();});
  $('#pause-bots').addEventListener('click',()=>{botsPaused=!botsPaused;clearTimeout(botTimer);renderActions();scheduleBot();});
  $('#play-again').addEventListener('click',()=>{$('#result-dialog').close();openSetup(state.mapId);});
  $('#download-log').addEventListener('click',()=>download('세계의마블-플레이기록.txt',E.mapOf(state).title+'\n'+state.log.map(e=>`[${e.turn}] ${e.message}`).join('\n')));
  $('#download-audit').addEventListener('click',()=>download('세계의마블-전체복원주석.json',JSON.stringify({notes:D.NOTES,manuals:D.manuals,maps:D.maps},null,2),'application/json;charset=utf-8'));
  document.querySelectorAll('dialog').forEach(d=>{d.addEventListener('close',scheduleBot);d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});});
  // [R12] 탭을 숨기거나 복원 노트를 읽는 동안 컴퓨터가 계속 플레이하지 않도록 일시 중단.
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(botTimer);else scheduleBot();});
  window.addEventListener('beforeunload',()=>{if(state)save();});
  renderLibrary();loadSave();
})();
