/* 실행 엔진. 모든 원문 이외의 결정은 data.js의 R번호와 함께 아래에 주석으로 기록한다.
 * 브라우저와 Node에서 같은 함수를 실행한다. DOM·네트워크·시간에 의존하지 않는다.
 */
(function(root){
  'use strict';
  const D=typeof module!=='undefined'&&module.exports?require('./data.js'):root.MarbleData;
  const VERSION=1;
  const amount=n=>Math.round(n*10000)/10000;
  const rand=(rng,n)=>Math.min(n-1,Math.floor(rng()*n));
  const copy=x=>JSON.parse(JSON.stringify(x));
  const mapOf=s=>D.maps.find(m=>m.id===s.mapId);
  const current=s=>s.players[s.current];
  const log=(s,message)=>{s.log.push({turn:s.turn,message});if(s.log.length>600)s.log.shift();s.message=message;};
  const active=s=>s.players.filter(p=>!p.out);
  const allied=(a,b)=>a.id===b.id||(a.team!==null&&a.team===b.team);
  const owned=(s,id)=>s.estates.map((e,i)=>e?.owner===id?i:-1).filter(i=>i>=0);
  const worth=(s,p)=>amount(p.cash+owned(s,p.id).reduce((n,i)=>n+s.estates[i].paid/4,0)+p.assets.reduce((n,a)=>n+a.cost/4,0));
  // [고증/R06] ITEM에서 설치. 이름만 있는 아이템 지급 칸도 ITEM 지점으로 해석.
  const canInstall=s=>['item','giveItem','portalItem','toolItem'].includes(mapOf(s).cells[current(s).pos].type);
  function valid(n,min=0){return Number.isFinite(n)&&n>=min;}
  function newGame(options={},rng=Math.random){
    const map=D.maps.find(m=>m.id===options.mapId)||D.maps[0];
    const count=Number(options.count||map.players[0]);
    if(!Number.isInteger(count)||count<map.players[0]||count>map.players[1])throw Error('이 판의 인원 범위를 확인해 주세요.');
    const capital=options.capital===undefined?map.capital:Number(options.capital);
    if(!valid(capital,0)||capital>1e12)throw Error('시작 자금이 올바르지 않습니다.');
    const limit=Number(options.roundLimit??20);if(![0,10,20,40,60].includes(limit))throw Error('라운드 설정을 확인해 주세요.');
    const starts=map.layout==='cross'?map.arms.map(a=>a[a.length-1]):map.cells.map((t,i)=>t.type==='start'?i:-1).filter(i=>i>=0);
    const players=Array.from({length:count},(_,id)=>({id,name:String(options.names?.[id]||`플레이어 ${id+1}`).slice(0,24),bot:options.mode==='bots'?id!==0:false,
      cash:capital,pos:map.distributed?(starts[id%starts.length]??0):0,start:map.distributed?(starts[id%starts.length]??0):0,
      team:map.id==='business'&&count===4?id%2:null,out:false,skip:0,held:false,turns:0,laps:0,cornerVisits:{},cards:[],items:[],assets:[],diamonds:0,gold:0,
      discount:false,boost:false,reverse:false,equipment:false,penguin:false,travel:false,previous:null,blockedAt:null,coins:60000}));
    // [R04/R05] 선후 카드와 잃어버린 카드 덱을 무작위 순서·복원 목록 3장으로 대체.
    for(const p of players)for(let i=0;i<3;i++)p.cards.push(D.cards[rand(rng,D.cards.length)].id);
    const order=players.map(p=>p.id);for(let i=order.length-1;i>0;i--){const j=rand(rng,i+1);[order[i],order[j]]=[order[j],order[i]];}
    const s={version:VERSION,mapId:map.id,players,order,orderIndex:0,current:order[0],round:1,turn:1,roundLimit:limit,phase:'roll',pending:null,
      estates:map.cells.map(()=>null),traps:[],queue:[],log:[],message:'',dice:[1,1],double:false,fund:0,chain:0,results:null,
      badPlace:Number.isInteger(options.badPlace)?Math.max(0,Math.min(map.cells.length-1,options.badPlace)):0};
    log(s,`${map.title} · ${count}명. ${players[s.current].name}부터 시작합니다.`);
    startTurn(s);return s;
  }
  function startTurn(s){
    const p=current(s);p.turns++;s.chain=0;s.double=false;
    // [R07] 폭탄 설치 후 설치자의 다음 차례가 시작될 때 제거.
    s.traps=s.traps.filter(t=>!(t.kind==='bomb'&&t.owner===p.id&&t.expires<=p.turns));
    if(p.travel){p.travel=false;s.phase='end';chooseTravel(s,{name:'에어쇼',type:'travel'},false);}
    else s.phase='roll';
  }
  function pending(s,kind,title,choices,extra={}){s.phase='choice';s.pending={...extra,kind,title,choices};}
  function enqueue(s,...ops){s.queue.unshift(...ops);}
  function execute(s,action,rng=Math.random){
    if(!s||s.version!==VERSION)throw Error('저장 형식이 다릅니다. 새 게임을 시작해 주세요.');
    const next=copy(s); step(next,action,rng);return next;
  }
  function step(s,a,rng){
    if(s.phase==='gameover')throw Error('종료된 게임입니다. 새 판을 시작해 주세요.');
    const p=current(s),map=mapOf(s);
    if(a.type==='roll'){
      if(s.phase!=='roll')throw Error('먼저 현재 선택을 마쳐 주세요.');
      if(p.skip>0||p.held){if(p.skip>0)p.skip--;log(s,`${p.name}: ${p.held?'다음 말이 올 때까지 대기':`이번 차례 휴식 (남은 ${p.skip}회)`}.`);s.phase='end';return;}
      s.dice=[rand(rng,6)+1,rand(rng,6)+1];s.double=s.dice[0]===s.dice[1];s.phase='end';s.chain=0;
      log(s,`${p.name}: ${s.dice.join(' + ')} = ${s.dice[0]+s.dice[1]}${s.double?' · 더블!':''}`);
      enqueue(s,{type:'move',steps:s.dice[0]+s.dice[1],direction:1},{type:'land'});pump(s,rng);
    }else if(a.type==='end'){
      if(s.phase!=='end')throw Error('현재 행동을 마쳐 주세요.');
      if(!p.out&&s.double&&!p.skip&&!p.held&&!p.travel){s.double=false;s.phase='roll';log(s,`${p.name}: 더블로 한 번 더 굴립니다.`);return;}
      nextTurn(s,rng);
    }else if(a.type==='choose'){
      if(s.phase!=='choice'||!s.pending)throw Error('지금은 선택할 항목이 없습니다.');
      const opt=s.pending.choices.find(x=>String(x.value)===String(a.value));if(!opt)throw Error('가능한 선택을 골라 주세요.');
      const q=s.pending;s.pending=null;s.phase=q.resume||'end';resolveChoice(s,q,opt.value,rng);pump(s,rng);
    }else if(a.type==='sell'){
      if(!['roll','end','debt'].includes(s.phase))throw Error('선택을 마친 뒤 매각해 주세요.');
      const i=Number(a.tile),e=s.estates[i];if(!e||e.owner!==p.id)throw Error('내 소유지만 팔 수 있습니다.');
      const value=amount(e.paid/4);p.cash=amount(p.cash+value);s.estates[i]=null;log(s,`${map.cells[i].name} 매각: ${money(value)} (정가의 1/4).`);
      if(s.phase==='debt')tryDebt(s,rng);else checkWin(s);
    }else if(a.type==='sellAsset'){
      if(!['roll','end','debt'].includes(s.phase))throw Error('선택을 먼저 마쳐 주세요.');
      const i=Number(a.index);if(!Number.isInteger(i)||!p.assets[i])throw Error('자산을 찾을 수 없습니다.');
      const asset=p.assets.splice(i,1)[0];p.cash=amount(p.cash+asset.cost/4);log(s,`${asset.name} 매각: ${money(asset.cost/4)}. [보완 R11: 부가 자산에도 1/4 적용]`);
      if(s.phase==='debt')tryDebt(s,rng);
    }else if(a.type==='bankrupt'){
      if(s.phase!=='debt')throw Error('미납금이 있을 때만 파산할 수 있습니다.');
      const debt=s.pending;if(debt.to!==null)s.players[debt.to].cash=amount(s.players[debt.to].cash+p.cash);p.cash=0;
      eliminate(s,p,'파산');s.pending=null;s.phase='end';s.queue=[];checkLast(s,'파산',4000);afterElimination(s,rng);
    }else if(a.type==='card'){
      if(!['roll','end','debt'].includes(s.phase))throw Error('현재 선택부터 마쳐 주세요.');
      useCard(s,a.card,rng);pump(s,rng);
    }else if(a.type==='item'){
      if(!['roll','end'].includes(s.phase))throw Error('선택을 마친 뒤 설치해 주세요.');
      if(!canInstall(s))throw Error('아이템은 ITEM 또는 아이템 지급 칸에서만 설치할 수 있습니다.');
      if(!p.items.includes(a.item))throw Error('가지고 있지 않은 아이템입니다.');
      const resume=s.phase;let targets=map.cells.map((t,i)=>({t,i})).filter(({t,i})=>['property','blank'].includes(t.type)&&!s.traps.some(x=>x.tile===i));
      if(a.item==='hammer'||a.item==='drill')targets=targets.filter(({i})=>s.estates[i]&&!allied(p,s.players[s.estates[i].owner]));
      if(!targets.length)throw Error('설치 가능한 칸이 없습니다.');
      pending(s,'install',`${itemName(a.item)} 설치할 칸`,[...targets.map(({t,i})=>({value:i,label:`${i+1}. ${t.name}`})),{value:'cancel',label:'취소'}],{item:a.item,resume});
    }else throw Error('알 수 없는 행동입니다.');
  }
  function pump(s,rng){
    let safety=0;
    while(s.queue.length&&s.phase!=='choice'&&s.phase!=='debt'&&s.phase!=='gameover'){
      if(++safety>300){s.queue=[];log(s,'연쇄 처리를 중단했습니다. 다음 차례로 진행합니다. [R08]');break;}
      const op=s.queue.shift();
      if(current(s).out){s.queue=[];break;}
      if(op.type==='move')move(s,op,rng);
      if(op.type==='land')land(s,rng);
      if(op.type==='jump'){const p=current(s);p.previous=null;p.pos=op.tile;log(s,`${p.name} → ${mapOf(s).cells[p.pos].name}`);if(op.land!==false)enqueue(s,{type:'land'});}
      if(op.type==='cash'){const p=s.players[op.player??s.current];p.cash=amount(p.cash+op.amount);log(s,`${p.name}: ${op.label||'받기'} ${money(op.amount)}.`);}
      if(op.type==='pay')pay(s,op.amount,op.to??null,op.label,rng);
      if(op.type==='afterBaseFee')offerBuild(s,op.tile);
      if(op.type==='build')build(s,op.tile,op.level,op.free);
      if(op.type==='asset'){const p=current(s);p.assets.push({name:op.name,cost:op.cost});log(s,`${op.name} 구입.`);}
      if(op.type==='diamond'){current(s).diamonds+=op.count;log(s,`다이아 ${op.count}개 구입.`);}
      if(op.type==='shield'){current(s).cards.push('shield');log(s,'방패 카드 1장 획득.');}
      if(op.type==='repair'){s.estates[op.tile].damaged=false;log(s,`${mapOf(s).cells[op.tile].name} 수리.`);}
      if(op.type==='rpsChallenge')offerRps(s,op);
    }
    if(s.phase!=='gameover')checkWin(s);
  }
  function move(s,op,rng){
    const map=mapOf(s),p=current(s);if(op.steps<=0)return;
    let dest;
    if(map.layout==='cross'){
      if(p.pos===0){
        const choices=map.arms.map((arm,i)=>({value:i,label:['위쪽','오른쪽','아래쪽','왼쪽'][i]+` · ${map.cells[arm[0]].name}`}));
        pending(s,'direction','갈 방향을 골라 주세요',choices,{steps:op.steps,direction:op.direction});return;
      }
      const arm=map.arms.find(a=>a.includes(p.pos));const j=arm.indexOf(p.pos);
      const outward=p.previous===0||(p.previous!==null&&arm.indexOf(p.previous)<j);
      if(outward&&j<arm.length-1)dest=arm[j+1];else dest=j===0?0:arm[j-1];
    }else if(map.mode==='race')dest=Math.max(0,Math.min(map.cells.length-1,p.pos+op.direction));
    else dest=(p.pos+op.direction+map.cells.length)%map.cells.length;
    // [R08] BLOCK 앞에서 멈춘 기록은 다음 이동 때만 통과시키며 후진에도 같은 규칙을 쓴다.
    if(map.cells[dest].type==='block'&&p.blockedAt!==dest){p.blockedAt=dest;log(s,`BLOCK 앞에서 멈췄습니다. 다음 이동에 통과합니다.`);return;}
    p.blockedAt=null;p.previous=p.pos;p.pos=dest;
    const t=map.cells[dest];
    if(dest===p.start&&op.direction>0&&map.mode!=='race'){
      p.laps++;p.cash=amount(p.cash+map.salary);log(s,`${p.name}: 출발점 통과, ${money(map.salary)} 받기 · ${p.laps}바퀴.`);
      if(map.mode==='laps'&&p.laps>=5){finishGame(s,[p.id],'5바퀴 완주',0);return;}
    }
    if(map.layout==='cross'&&t.type==='start'&&dest!==p.start){p.cash=amount(p.cash+map.salary);log(s,'끝점 도착 보너스. [보완 R15]');}
    if(map.mode==='race'&&dest===map.cells.length-1){finishGame(s,[p.id],'도착점 완주',0);return;}
    if(op.steps>1)enqueue(s,{...op,steps:op.steps-1});
    if(t.type==='passFee')pay(s,t.amount,null,t.name,rng);
  }
  function land(s,rng){
    const map=mapOf(s),p=current(s),i=p.pos,t=map.cells[i];
    if(++s.chain>12){log(s,'연쇄 이동 12회에 도달해 이 칸에서 멈춥니다. [R08]');s.queue=[];return;}
    log(s,`${p.name}: ${t.name} 도착.`);
    if(t.side==='corner'&&t.type!=='start')p.cornerVisits[i]=(p.cornerVisits[i]||0)+1;
    const trap=s.traps.find(x=>x.tile===i&&!allied(p,s.players[x.owner]));
    if(trap&&['bomb','missile','blackhole'].includes(trap.kind)){
      if(consume(p.cards,'shield'))log(s,'방패가 공격을 막았습니다.');
      else if(trap.kind==='blackhole'){
        const exit=s.traps.find(x=>x.kind==='whitehole'&&x.owner===trap.owner);
        if(exit){enqueue(s,{type:'jump',tile:exit.tile});return;}
        p.skip=3;s.double=false;log(s,'화이트홀이 없어 3회 쉽니다. [R07]');return;
      }else{eliminate(s,p,itemName(trap.kind));s.queue=[];checkLast(s,itemName(trap.kind),trap.kind==='bomb'?3000:800);afterElimination(s,rng);return;}
    }
    const e=s.estates[i];
    if(t.type==='property'){
      if(e&&e.blocked){log(s,'해머로 건설이 금지된 땅입니다.');return;}
      if(e?.damaged){pending(s,'damaged','화재 건물',e.owner===p.id?[{value:'repair',label:'5억으로 수리'},{value:'skip',label:'그대로 두기'}]:[{value:'claim',label:'무료 인수'},{value:'skip',label:'지나가기'}],{tile:i});return;}
      if(!e&&t.baseFee){enqueue(s,{type:'afterBaseFee',tile:i});pay(s,t.baseFee,null,'기본 출입료',rng);return;}
      if(!e||e.owner===p.id){offerBuild(s,i);return;}
      if(allied(p,s.players[e.owner])){log(s,'같은 팀 소유지이므로 통행료가 없습니다. [보완 R17]');return;}
      const owner=s.players[e.owner];let rent=e.rent*(owner.boost?2:1);owner.boost=false;if(p.penguin)rent*=2;
      if(p.reverse){p.reverse=false;const received=Math.min(rent,owner.cash);owner.cash=amount(owner.cash-received);p.cash=amount(p.cash+received);log(s,`반대 구역: ${money(received)}를 받았습니다. [보완: 상대 현금 한도]`);return;}
      pay(s,rent,e.owner,`${t.name} 통행료`,rng);return;
    }
    switch(t.type){
      case 'rest':p.skip=t.turns;s.double=false;log(s,`${t.turns}회 쉽니다.`);break;
      case 'bigIsland':bigIsland(s);break;
      case 'crowdBig':if(s.players.length>=4)bigIsland(s);break;
      case 'crowdRest':if(s.players.length>=6){p.skip=3;s.double=false;log(s,'6인 이상: 3회 쉽니다. [대기 횟수 R09]');}break;
      case 'rankRest':{const rank=1+s.players.filter(x=>!x.out&&x.cash<p.cash).length;if(rank<=t.rank){p.skip=t.turns;s.double=false;log(s,`현금 하위 ${rank}위: ${t.turns}회 휴식. [보완: 코인을 현금으로 해석]`);}break;}
      case 'card':{const c=D.cards[rand(rng,D.cards.length)];p.cards.push(c.id);log(s,`${c.name} 카드 획득. [R05]`);break;}
      case 'item':{const item=D.items[rand(rng,D.items.length)];p.items.push(item.id);log(s,`${item.name} 획득. [R06]`);break;}
      case 'giveItem':p.items.push(t.item);log(s,`${itemName(t.item)} 획득.`);break;
      case 'portalItem':pending(s,'giveItem','블랙홀 / 화이트홀 선택',[{value:'blackhole',label:'블랙홀'},{value:'whitehole',label:'화이트홀'}]);break;
      case 'toolItem':pending(s,'giveItem','해머 / 드릴 선택',[{value:'hammer',label:'해머'},{value:'drill',label:'드릴'}]);break;
      case 'cash':p.cash=amount(p.cash+t.amount);break;
      case 'fee':pay(s,t.amount,null,t.name,rng);break;
      case 'collect':for(const other of active(s).filter(x=>!allied(x,p))){const n=Math.min(t.amount,other.cash);other.cash=amount(other.cash-n);p.cash=amount(p.cash+n);}log(s,'각 상대의 현금 한도에서 받았습니다. [보완: 즉시 수금은 현금 한도]');break;
      case 'collectOne':pending(s,'collectOne','1억을 받을 상대',active(s).filter(x=>!allied(p,x)).map(x=>({value:x.id,label:x.name})),{amount:t.amount});break;
      case 'travel':if(t.immediate)chooseTravel(s,t,true);else{p.travel=true;s.double=false;log(s,'다음 차례에 목적지를 선택합니다.');}break;
      case 'timedTravel':if(p.turns%10===0)chooseTravel(s,t,true);else log(s,'10번째 차례가 아니므로 이동하지 않습니다.');break;
      case 'ownTravel':chooseTravel(s,t,true,'own');break;
      case 'planetTravel':chooseTravel(s,t,true,'planet');break;
      case 'hospital':{const index=map.cells.findIndex(c=>c.name==='병원');if(index>=0)enqueue(s,{type:'jump',tile:index});break;}
      case 'freebuild':freebuild(s,t.random,rng);break;
      case 'landmark':{const targets=owned(s,p.id).filter(j=>s.estates[j].level<2);if(targets.length)pending(s,'landmark','랜드마크를 올릴 내 도시',targets.map(j=>({value:j,label:map.cells[j].name})));else log(s,'증축할 내 도시가 없어 지나갑니다. [R19]');break;}
      case 'festival':p.boost=true;log(s,'다음에 받는 통행료가 2배입니다. [R20]');break;
      case 'fundPay':s.fund=amount(s.fund+t.amount);pay(s,t.amount,null,'사회복지기금 납부',rng);break;
      case 'fund':p.cash=amount(p.cash+s.fund);log(s,`사회복지기금 ${money(s.fund)} 수령.`);s.fund=0;break;
      case 'rps':if(s.players.length===4){const captain=active(s).find(x=>x.team===p.team);if(captain?.id===p.id)offerRps(s,{reward:t.reward,business:true});else log(s,'팀장 차례에 가위바위보 ZONE을 이용합니다. [R17]');}else log(s,'4인 팀전 전용 칸입니다.');break;
      case 'asset':pending(s,'asset',`${t.name}: ${money(t.cost)}`,[{value:'buy',label:'구입'},{value:'skip',label:'지나가기'}],{tile:i});break;
      case 'escape':p.cards.push('escape');log(s,'독방 탈출 열쇠를 탈출권으로 보관합니다.');break;
      case 'brand':{const j=map.cells.findIndex((c,k)=>c.type==='brand'&&k!==i);if(j>=0)enqueue(s,{type:'jump',tile:j,land:false});break;}
      case 'diamond':pending(s,'diamond','다이아 상점 · 개당 5천만원',[{value:1,label:'1개 구입'},{value:2,label:'2개 구입'},{value:0,label:'지나가기'}]);break;
      case 'gold':p.cash=amount(p.cash+t.amount);if(t.name.includes('다이아')){p.diamonds++;p.cards.push('flight');}else p.gold++;log(s,`${money(t.amount)}와 ${t.name} 획득.`);break;
      case 'reverseRent':p.reverse=true;log(s,'다음 통행료 1회는 반대로 받습니다. [R15]');break;
      case 'halfCash':pay(s,p.cash/2,null,'은행 매출: 현금 절반 (자산 범위를 현금으로 보완)',rng);break;
      case 'penguin':p.cash+=10000;p.penguin=true;log(s,'은행에서 1억을 받고 이후 통행료를 2배로 냅니다.');break;
      case 'blizzard':{const others=active(s).filter(x=>x.id!==p.id);const controller=others[rand(rng,others.length)];chooseTravel(s,t,true);if(s.pending)s.pending.controller=controller?.id??p.id;log(s,'눈보라: 무작위 상대가 목적지를 정합니다. [이 판 보완]');break;}
      case 'spring':enqueue(s,{type:'move',steps:s.dice[0]+s.dice[1],direction:1},{type:'land'});break;
      case 'equipment':p.equipment=true;log(s,'이후 건설비에서 3억을 할인합니다.');break;
      case 'roulette':{const d=rand(rng,6)+1;if(d%2){pay(s,10000,null,`OX 룰렛 ${d}: −1억 [보완]`,rng);}else{p.cash+=10000;log(s,`OX 룰렛 ${d}: +1억 [보완]`);}break;}
      case 'hotel':pending(s,'hotel','5억을 내고 방패 획득',[{value:'buy',label:'구입'},{value:'skip',label:'지나가기'}]);break;
      case 'transport':if(p.turns%3===0)pending(s,'transport','대중교통 선택',[{value:'bus',label:'버스 · 300만원 · 3칸'},{value:'ship',label:'배 · 5천만원 · 5칸'},{value:'plane',label:'비행기 · 7천만원 · 7칸'},{value:'rocket',label:'로켓 · 1억 · 목적지 선택'},{value:'skip',label:'이용하지 않기'}]);else log(s,'3차례마다 이용할 수 있습니다.');break;
      case 'leak':for(const j of owned(s,p.id))s.estates[j].damaged=true;log(s,'내 건물 모두 화재. 도착 시 수리하거나 무료 인수될 수 있습니다. [이 판 보완]');break;
      case 'demolishAll':for(const other of active(s).filter(x=>!allied(x,p))){const candidates=owned(s,other.id);if(candidates.length)s.estates[candidates[rand(rng,candidates.length)]]=null;}log(s,'각 상대의 건물 하나를 무작위로 제거했습니다. [보완: 제거 대상 추첨]');break;
      case 'challenge':challenge(s,t.challenge);break;
      case 'finish':finishGame(s,[p.id],'도착점 완주',0);break;
    }
  }
  function bigIsland(s){const p=current(s);for(const other of s.players)if(other.id!==p.id&&other.pos===p.pos&&other.held){other.held=false;log(s,`${other.name}: 큰 무인도에서 풀려났습니다.`);}p.held=true;s.double=false;log(s,'다음 말이 올 때까지 큰 무인도에서 기다립니다.');}
  function offerBuild(s,i){
    const p=current(s),t=mapOf(s).cells[i],e=s.estates[i];
    if(mapOf(s).id==='diamond'&&p.diamonds<3){log(s,'건설하려면 다이아 3개가 필요합니다.');return;}
    if(e?.owner===p.id&&t.tourism&&t.name==='아폴로 11호'){chooseTravel(s,{name:'아폴로 11호'},true);return;}
    if(e?.owner===p.id&&t.tourism&&t.name==='에어뿅'){p.cash+=mapOf(s).salary;enqueue(s,{type:'jump',tile:p.start,land:false});return;}
    const level=e?e.level+1:1;const max=t.tiers?.length||2;
    if(level>max){log(s,'이미 최고 단계 건물입니다.');return;}
    const levels=t.tiers?Array.from({length:max-level+1},(_,j)=>level+j):[level];
    pending(s,'build',e?'내 건물 증축':'이곳에 건설할까요?',[
      ...levels.map(l=>({value:l,label:`${t.tiers?['심플','에버리지','퍼펙트'][l-1]:e?'2단계 증축':'건설'} · ${money(buildCost(s,i,l))}`})),{value:'skip',label:'지나가기'}],{tile:i});
  }
  function buildCost(s,i,level){const t=mapOf(s).cells[i],p=current(s),e=s.estates[i];let cost=t.tiers?t.tiers[level-1][0]-(e?t.tiers[e.level-1][0]:0):t.cost;
    cost=Math.max(0,cost-(p.equipment?30000:0));if(p.discount)cost/=2;return amount(cost);}
  function build(s,i,level=1,free=false){
    const p=current(s),t=mapOf(s).cells[i],e=s.estates[i];
    const paid=(e?.paid||0)+(t.tiers?t.tiers[level-1][0]-(e?t.tiers[e.level-1][0]:0):t.cost);
    s.estates[i]={owner:p.id,level,paid,rent:t.tiers?t.tiers[level-1][1]:amount(t.rent*level),damaged:false,blocked:false};
    if(!free)p.discount=false;log(s,`${t.name} ${level}단계 건설${free?' (무료)':''}.`);if(t.instantWin)finishGame(s,[p.id],`${t.name} 구입`,0);
  }
  function freebuild(s,random,rng){
    const map=mapOf(s),p=current(s);const targets=map.cells.map((t,i)=>({t,i})).filter(({t,i})=>t.type==='property'&&!s.estates[i]);
    if(map.id==='diamond'&&p.diamonds<3){log(s,'무료 건설에도 다이아 3개가 필요합니다. [보완 R16]');return;}
    if(!targets.length){log(s,'비어 있는 도시가 없어 무료 건설을 건너뜁니다.');return;}
    if(random)build(s,targets[rand(rng,targets.length)].i,1,true);
    else pending(s,'freebuild','무료로 건설할 도시',targets.map(({t,i})=>({value:i,label:`${i+1}. ${t.name}`})));
  }
  function chooseTravel(s,t,immediate,filter){
    const map=mapOf(s),p=current(s);const targets=map.cells.map((x,i)=>({x,i})).filter(({x,i})=>i!==p.pos&&(!filter||(filter==='own'?s.estates[i]?.owner===p.id:x.group==='planet')));
    if(!targets.length){log(s,'이동할 수 있는 목적지가 없습니다.');return;}
    const cost=t.cost||0;
    pending(s,'travel',`${t.name||'이동'} · 목적지 선택${cost?` (${money(cost)})`:''}`,[...targets.map(({x,i})=>({value:i,label:`${i+1}. ${x.name}`})),...(cost?[{value:'cancel',label:'이용하지 않기'}]:[])],{cost});
  }
  function resolveChoice(s,q,v,rng){
    const p=current(s),map=mapOf(s);
    switch(q.kind){
      case 'build':if(v!=='skip'){const cost=buildCost(s,q.tile,Number(v));if(p.cash<cost)throw Error('자금이 부족합니다. 지나간 뒤 자산을 정리할 수 있습니다.');p.cash=amount(p.cash-cost);build(s,q.tile,Number(v));}break;
      case 'freebuild':build(s,Number(v),1,true);break;
      case 'landmark':build(s,Number(v),2,true);break;
      case 'direction':{const next=map.arms[Number(v)][0];p.previous=0;p.pos=next;if(q.steps>1)enqueue(s,{type:'move',steps:q.steps-1,direction:q.direction});break;}
      case 'travel':if(v!=='cancel'){if(p.cash<q.cost)throw Error('이동 비용이 부족합니다.');p.cash=amount(p.cash-q.cost);enqueue(s,{type:'jump',tile:Number(v)});}break;
      case 'giveItem':p.items.push(v);log(s,`${itemName(v)} 획득.`);break;
      case 'asset':if(v==='buy'){const t=map.cells[q.tile];if(p.cash<t.cost)throw Error('구입할 돈이 부족합니다.');p.cash=amount(p.cash-t.cost);p.assets.push({name:t.asset,cost:t.cost});log(s,`${t.asset} 구입.`);}break;
      case 'diamond':{const n=Number(v);if(p.cash<n*5000)throw Error('다이아 구입 비용이 부족합니다.');p.cash-=n*5000;p.diamonds+=n;log(s,`다이아 ${n}개 구입.`);break;}
      case 'collectOne':{const other=s.players[Number(v)],n=Math.min(q.amount,other.cash);other.cash=amount(other.cash-n);p.cash=amount(p.cash+n);log(s,`${other.name}에게 ${money(n)} 받기. [현금 한도]`);break;}
      case 'install':if(v!=='cancel')install(s,q.item,Number(v));break;
      case 'destroy':if(v!=='cancel'){consume(p.cards,'destroy');s.estates[Number(v)]=null;log(s,`${map.cells[Number(v)].name} 도시 파괴.`);}break;
      case 'magnet':if(v!=='cancel'){consume(p.cards,'magnet');s.players[Number(v)].skip++;log(s,'자석: 상대가 다음 1회 쉽니다. [R05]');}break;
      case 'swapMine':if(v!=='cancel'){const other=map.cells.map((t,i)=>({t,i})).filter(({i})=>s.estates[i]&&!s.estates[i].blocked&&!allied(p,s.players[s.estates[i].owner]));pending(s,'swapOther','교환할 상대 도시',other.map(({t,i})=>({value:i,label:t.name})),{mine:Number(v),resume:q.resume});}break;
      case 'swapOther':{const j=Number(v),i=q.mine;consume(p.cards,'swap');[s.estates[i].owner,s.estates[j].owner]=[s.estates[j].owner,s.estates[i].owner];log(s,'두 도시의 소유권을 교환했습니다.');break;}
      case 'damaged':if(v==='repair'){if(p.cash<50000)throw Error('수리비가 부족합니다.');p.cash-=50000;s.estates[q.tile].damaged=false;}else if(v==='claim'){s.estates[q.tile].owner=p.id;s.estates[q.tile].damaged=false;log(s,'화재 건물을 무료 인수했습니다. [보완: 인수 시 수리 완료]');}break;
      case 'hotel':if(v==='buy'){if(p.cash<50000)throw Error('5억이 필요합니다.');p.cash-=50000;p.cards.push('shield');}break;
      case 'transport':if(v!=='skip'){const prices={bus:300,ship:5000,plane:7000,rocket:10000};if(p.cash<prices[v])throw Error('교통비가 부족합니다.');p.cash-=prices[v];if(v==='rocket')chooseTravel(s,{name:'로켓'},true);else enqueue(s,{type:'move',steps:{bus:3,ship:5,plane:7}[v],direction:1},{type:'land'});}break;
      case 'rpsOpponent':offerRpsHands(s,{...q,opponent:Number(v)});break;
      case 'rpsHand':{const hand=Number(v);if(q.stage==='first'){
        if(s.players[q.opponent].bot){finishRps(s,q,hand,rand(rng,3),rng);}
        else pending(s,'rpsHand',`${s.players[q.opponent].name}: 가위바위보 선택 (앞선 선택은 숨김)`,hands(),{...q,kind:undefined,stage:'second',first:hand,controller:q.opponent,title:undefined,choices:undefined});
      }else finishRps(s,q,q.first,hand,rng);break;}
    }
  }
  function consume(arr,id){const i=arr.indexOf(id);if(i<0)return false;arr.splice(i,1);return true;}
  function useCard(s,id,rng){
    const p=current(s),map=mapOf(s);if(!p.cards.includes(id))throw Error('가지고 있지 않은 카드입니다.');
    if(s.phase==='debt'&&id!=='waiver')throw Error('미납 중에는 벌금 면제 카드만 사용할 수 있습니다.');
    const resume=s.phase;
    if(id==='shield')throw Error('방패는 공격을 받을 때 자동으로 사용됩니다.');
    if(id==='waiver'){
      if(s.phase!=='debt')throw Error('벌금 면제는 청구 시 자동으로 사용됩니다.');consume(p.cards,id);s.pending=null;s.phase='end';log(s,'벌금 면제로 미납금을 취소했습니다.');pump(s,rng);return;
    }
    if(id==='escape'){if(!p.skip&&!p.held)throw Error('지금은 갇혀 있지 않습니다.');p.skip=0;p.held=false;consume(p.cards,id);log(s,'탈출권을 사용했습니다.');return;}
    if(['discount','boost','blank'].includes(id)){consume(p.cards,id);if(id!=='blank')p[id]=true;log(s,`${cardName(id)} 사용.`);return;}
    if(id==='flight'){consume(p.cards,id);chooseTravel(s,{name:'에어쇼 탑승'},true);if(s.pending)s.pending.resume=resume;return;}
    const targets=map.cells.map((t,i)=>({t,i})).filter(({i})=>s.estates[i]&&!s.estates[i].blocked&&!allied(p,s.players[s.estates[i].owner]));
    if(id==='destroy'){
      if(!targets.length)throw Error('파괴할 상대 도시가 없습니다.');pending(s,'destroy','파괴할 상대 도시',[...targets.map(({t,i})=>({value:i,label:t.name})),{value:'cancel',label:'취소'}],{resume});
    }else if(id==='magnet')pending(s,'magnet','자석을 사용할 상대',[...active(s).filter(x=>!allied(x,p)).map(x=>({value:x.id,label:x.name})),{value:'cancel',label:'취소'}],{resume});
    else if(id==='swap'){
      const mine=owned(s,p.id);if(!mine.length||!targets.length)throw Error('양쪽 모두 교환할 도시가 있어야 합니다.');
      pending(s,'swapMine','내 도시 중 교환할 곳',[...mine.map(i=>({value:i,label:map.cells[i].name})),{value:'cancel',label:'취소'}],{resume});
    }
  }
  function install(s,kind,i){
    const p=current(s);consume(p.items,kind);
    if(['hammer','drill'].includes(kind)){
      const target=s.estates[i];if(target&&consume(s.players[target.owner].cards,'shield')){log(s,'상대 방패가 건물을 지켰습니다.');return;}
      if(kind==='hammer'){s.estates[i]={owner:p.id,level:0,paid:0,rent:0,blocked:true};}
      else{const t=mapOf(s).cells[i];s.estates[i]={owner:p.id,level:1,paid:t.cost,rent:t.rent};}
    }else s.traps.push({kind,tile:i,owner:p.id,expires:p.turns+1});
    log(s,`${mapOf(s).cells[i].name}: ${itemName(kind)} 설치.`);
  }
  function pay(s,value,to,label,rng){
    const p=current(s),n=amount(value);if(n<=0)return;
    if(consume(p.cards,'waiver')){log(s,`${label}: 벌금 면제 카드 자동 사용.`);return;}
    if(p.cash>=n){p.cash=amount(p.cash-n);if(to!==null)s.players[to].cash=amount(s.players[to].cash+n);log(s,`${label}: ${money(n)} 지불.`);return;}
    s.phase='debt';s.pending={kind:'debt',amount:n,to,label};log(s,`${label} ${money(n)} 부족. 자산을 매각하거나 파산을 선택하세요.`);
  }
  function tryDebt(s,rng){const q=s.pending,p=current(s);if(p.cash>=q.amount){p.cash=amount(p.cash-q.amount);if(q.to!==null)s.players[q.to].cash=amount(s.players[q.to].cash+q.amount);log(s,`${q.label} 완납.`);s.pending=null;s.phase='end';pump(s,rng);}}
  function eliminate(s,p,reason){
    p.out=true;p.held=false;p.travel=false;p.skip=0;for(const i of owned(s,p.id))s.estates[i]=null;
    // [보완 R07] 설치자가 탈락하면 남아 있는 공격 아이템도 회수한다.
    s.traps=s.traps.filter(t=>t.owner!==p.id);log(s,`${p.name}: ${reason}으로 탈락.`);
  }
  function checkLast(s,reason,coins){const live=active(s);const teams=new Set(live.map(p=>p.team===null?'p'+p.id:'t'+p.team));if(teams.size<=1)finishGame(s,live.map(p=>p.id),reason,coins);}
  function checkWin(s){
    if(s.phase==='gameover')return;
    const map=mapOf(s);if(map.mode!=='estate'||map.layout==='cross')return;
    for(const p of active(s)){
      const ids=owned(s,p.id).filter(i=>!s.estates[i].blocked),group=key=>map.cells.map((t,i)=>t.type==='property'&&key(t)?i:-1).filter(i=>i>=0);
      if(map.id==='polar'&&ids.filter(i=>map.cells[i].group==='heart').length>=4){finishGame(s,[p.id],'하트 4개 건설',2600);return;}
      if(['polar','festival'].includes(map.id))continue; // [고증] 판에 적힌 하트4개/지구 매입 승리를 공통 독점보다 우선.
      for(const color of new Set(map.cells.map(t=>t.group).filter(Boolean))){const all=group(t=>t.group===color);if(all.length>=2&&all.every(i=>ids.includes(i))){finishGame(s,[p.id],'컬러 독점',2600);return;}}
      const tourism=group(t=>t.tourism);if(tourism.length>=4&&tourism.every(i=>ids.includes(i))){finishGame(s,[p.id],'관광지 독점',300);return;}
      for(const side of ['left','top','right','bottom']){const all=group(t=>t.side===side);if(all.length>=2&&all.every(i=>ids.includes(i))){finishGame(s,[p.id],'라인 독점',2800);return;}}
      const corners=map.cells.map((t,i)=>t.side==='corner'&&t.type!=='start'?i:-1).filter(i=>i>=0);
      if(corners.length>=3&&corners.filter(i=>(p.cornerVisits[i]||0)>=2).length>=3){finishGame(s,[p.id],'트리플 독점',500);return;}
    }
  }
  function finishGame(s,winners,reason,coins){
    if(s.phase==='gameover')return;
    const winSet=new Set(winners);for(const id of winners){const p=s.players[id];if(p.team!==null)for(const mate of s.players)if(mate.team===p.team)winSet.add(mate.id);}
    const ranks=s.players.map(p=>({id:p.id,name:p.name,total:worth(s,p),out:p.out})).sort((a,b)=>Number(a.out)-Number(b.out)||b.total-a.total);
    const won=[...winSet];for(const p of s.players)p.coins=Math.max(0,p.coins+(won.includes(p.id)?coins:-coins));
    s.phase='gameover';s.pending=null;s.queue=[];s.results={winners:won,reason,coins,ranks};log(s,`${won.map(id=>s.players[id].name).join(', ')} 승리 · ${reason}.`);
  }
  function nextTurn(s,rng){
    checkLast(s,'파산',4000);if(s.phase==='gameover')return;
    let visited=0;
    do{
      s.orderIndex=(s.orderIndex+1)%s.order.length;
      s.current=s.order[s.orderIndex];
      if(s.orderIndex===0){s.round++;if(s.roundLimit&&s.round>s.roundLimit){
        const live=active(s);const score=p=>p.team===null?worth(s,p):s.players.filter(x=>x.team===p.team).reduce((n,x)=>n+worth(s,x),0);
        const best=Math.max(...live.map(score));finishGame(s,live.filter(p=>score(p)===best).map(p=>p.id),'라운드 종료 · 자산 평가',0);return;
      }}
      s.current=s.order[s.orderIndex];visited++;
    }while(current(s).out&&visited<=s.players.length);
    s.turn++;s.queue=[];s.pending=null;startTurn(s);log(s,`${current(s).name} 차례 · ${s.round}라운드.`);
  }
  function challenge(s,n){
    if(n===1){enqueue(s,{type:'move',steps:10,direction:1},{type:'land'});return;}
    if(n===5){current(s).skip=1;s.double=false;log(s,'챌린지5 규칙 유실: 1회 휴식. [R21]');return;}
    offerRps(s,{challenge:n,remaining:n===4?2:1,used:[]});
  }
  const hands=()=>[{value:0,label:'✌ 가위'},{value:1,label:'✊ 바위'},{value:2,label:'✋ 보'}];
  function offerRps(s,options){
    const actor=options.actor??s.current;let others=active(s).filter(p=>p.id!==actor&&!options.used?.includes(p.id));
    if(options.business)others=others.filter(p=>p.team!==s.players[actor].team).slice(0,1);
    if(options.penalty){others=others.filter(p=>options.contenders.includes(p.id));}
    if(!others.length){log(s,'가위바위보 상대가 없습니다.');return;}
    pending(s,'rpsOpponent',`${s.players[actor].name}: 가위바위보 상대 선택`,others.map(p=>({value:p.id,label:p.name})),{...options,actor,controller:actor});
  }
  function offerRpsHands(s,q){
    const extras={actor:q.actor,opponent:q.opponent,challenge:q.challenge,remaining:q.remaining,used:q.used||[],reward:q.reward,business:q.business,penalty:q.penalty,contenders:q.contenders,stage:'first',controller:q.actor};
    pending(s,'rpsHand',`${s.players[q.actor].name}: 가위바위보 선택`,hands(),extras);
  }
  function finishRps(s,q,first,second,rng){
    if(first===second){log(s,'가위바위보 비겼습니다. 다시 선택하세요.');offerRpsHands(s,q);return;}
    const win=(first-second+3)%3===1,actor=s.players[q.actor];
    log(s,`${actor.name} ${['가위','바위','보'][first]} / ${s.players[q.opponent].name} ${['가위','바위','보'][second]}: ${win?actor.name:s.players[q.opponent].name} 승리.`);
    if(q.penalty){
      const loser=win?q.opponent:q.actor;const rest=q.contenders.filter(id=>id!==q.actor&&id!==q.opponent);rest.push(loser);
      if(rest.length===1){s.players[loser].pos=s.badPlace;s.players[loser].previous=null;log(s,`${s.players[loser].name}: 가위바위보 꼴찌로 지정 장소로 이동. [보완 R17: 칸 효과는 재발동하지 않음]`);}
      else offerRps(s,{penalty:true,contenders:rest,actor:rest[0]});return;
    }
    if(q.business){actor.rpsStreak=win?(actor.rpsStreak||0)+1:0;if(win){const reward=q.reward*Math.pow(2,Math.min(2,actor.rpsStreak-1));actor.cash+=reward;log(s,`${actor.rpsStreak}연승 · ${money(reward)} 받기.`);}return;}
    if(q.challenge===2)enqueue(s,{type:'move',steps:10,direction:win?1:-1},{type:'land'});
    if(q.challenge===3&&win)enqueue(s,{type:'move',steps:5,direction:1},{type:'land'});
    if(q.challenge===4){
      if(win&&q.remaining>1)offerRps(s,{challenge:4,remaining:q.remaining-1,used:[...q.used,q.opponent],actor:q.actor});
      else if(win)log(s,'두 상대를 이겨 챌린지를 통과했습니다.');
      else{actor.skip=1;s.double=false;log(s,'챌린지4 실패: 한 차례 쉽니다. [보완 R21]');}
    }
  }
  function afterElimination(s,rng){
    if(s.phase==='gameover'||s.mapId!=='business'||![3,5].includes(s.players.length))return;
    const contenders=active(s).map(p=>p.id);if(contenders.length>1)offerRps(s,{penalty:true,contenders,actor:contenders[0]});
  }
  function autoAction(s,rng=Math.random){
    const p=current(s),map=mapOf(s);
    if(s.phase==='roll'){
      if((p.skip||p.held)&&p.cards.includes('escape'))return {type:'card',card:'escape'};
      return {type:'roll'};
    }
    if(s.phase==='end'){
      // [보완 R12] AI는 가용 공격 아이템을 설치한 다음 차례를 마친다. 전략은 원본과 무관하다.
      const item=canInstall(s)&&p.items.find(id=>['bomb','missile','blackhole','whitehole'].includes(id)&&map.cells.some((t,i)=>['property','blank'].includes(t.type)&&!s.traps.some(x=>x.tile===i)));
      if(item)return {type:'item',item};return {type:'end'};
    }
    if(s.phase==='debt'){
      if(p.cards.includes('waiver'))return {type:'card',card:'waiver'};
      const mine=owned(s,p.id);if(mine.length)return {type:'sell',tile:mine.sort((a,b)=>s.estates[a].paid-s.estates[b].paid)[0]};
      if(p.assets.length)return {type:'sellAsset',index:0};return {type:'bankrupt'};
    }
    if(s.phase==='choice'){
      const q=s.pending;let choices=q.choices;
      if(q.kind==='build'){const level=choices.find(x=>x.value!=='skip'&&buildCost(s,q.tile,Number(x.value))<=p.cash*0.65);return {type:'choose',value:level?level.value:'skip'};}
      if(q.kind==='asset')return {type:'choose',value:p.cash>=map.cells[q.tile].cost*2?'buy':'skip'};
      if(q.kind==='diamond')return {type:'choose',value:p.cash>=10000?2:p.cash>=5000?1:0};
      if(q.kind==='hotel')return {type:'choose',value:p.cash>=100000?'buy':'skip'};
      if(q.kind==='damaged')return {type:'choose',value:choices.some(x=>x.value==='claim')?'claim':p.cash>=50000?'repair':'skip'};
      if(q.kind==='travel'&&p.cash<q.cost)return {type:'choose',value:'cancel'};
      if(q.kind==='transport')return {type:'choose',value:'skip'};
      choices=choices.filter(x=>x.value!=='cancel');
      return {type:'choose',value:choices[rand(rng,choices.length)].value};
    }
    return null;
  }
  function validateSave(s){
    try{
      if(!s||s.version!==VERSION||!mapOf(s)||!Array.isArray(s.players)||!Array.isArray(s.estates)||!Array.isArray(s.log)||!Array.isArray(s.traps)||!Array.isArray(s.queue))return false;
      const m=mapOf(s),n=s.players.length;if(n<m.players[0]||n>m.players[1]||s.estates.length!==m.cells.length)return false;
      if(!['roll','end','choice','debt','gameover'].includes(s.phase)||!Number.isInteger(s.current)||!s.players[s.current]||!valid(s.round,1)||!valid(s.turn,1))return false;
      if(!Array.isArray(s.order)||s.order.length!==n||new Set(s.order).size!==n||s.order.some(i=>!Number.isInteger(i)||!s.players[i])||s.order[s.orderIndex]!==s.current)return false;
      if(![0,10,20,40,60].includes(s.roundLimit))return false;
      for(const [i,p]of s.players.entries())if(p.id!==i||typeof p.name!=='string'||!valid(p.cash)||!Number.isInteger(p.pos)||!m.cells[p.pos]||!Array.isArray(p.cards)||!Array.isArray(p.items)||!Array.isArray(p.assets)||!p.cornerVisits||!valid(p.coins)||!valid(p.skip)||!valid(p.laps)||!p.cards.every(id=>D.cards.some(c=>c.id===id))||!p.items.every(id=>D.items.some(c=>c.id===id)))return false;
      for(const e of s.estates)if(e&&(!s.players[e.owner]||!valid(e.paid)||!valid(e.rent)||!valid(e.level)))return false;
      for(const t of s.traps)if(!m.cells[t.tile]||!s.players[t.owner]||!D.items.some(i=>i.id===t.kind))return false;
      if(s.phase==='choice'&&(!s.pending||typeof s.pending.kind!=='string'||!Array.isArray(s.pending.choices)||!s.pending.choices.length))return false;
      if(s.phase==='debt'&&(!s.pending||!valid(s.pending.amount)||(s.pending.to!==null&&!s.players[s.pending.to])))return false;
      if(s.phase==='gameover'&&(!s.results||!Array.isArray(s.results.winners)))return false;
      return true;
    }catch{return false;}
  }
  function money(n){if(n===0)return '0원';const sign=n<0?'−':'';n=Math.abs(n);const e=Math.floor(n/10000),rest=amount(n%10000);return sign+(e?`${e.toLocaleString('ko-KR')}억`:'')+(rest?`${rest.toLocaleString('ko-KR',{maximumFractionDigits:4})}만`:'')+'원';}
  const cardName=id=>D.cards.find(c=>c.id===id)?.name||id;
  const itemName=id=>D.items.find(c=>c.id===id)?.name||id;
  const E={VERSION,newGame,execute,autoAction,validateSave,mapOf,current,owned,worth,money,cardName,itemName,buildCost,canInstall};
  if(typeof module!=='undefined'&&module.exports)module.exports=E;root.MarbleEngine=E;
})(typeof globalThis!=='undefined'?globalThis:this);
