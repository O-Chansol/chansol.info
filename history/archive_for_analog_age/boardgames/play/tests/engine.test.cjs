'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const D=require('../data.js');
const E=require('../engine.js');
const rng=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const game=(id='economy',count)=>E.newGame({mapId:id,count:count||D.maps.find(m=>m.id===id).players[0],mode:'local',roundLimit:20},rng(3));
const choose=(s,value)=>E.execute(s,{type:'choose',value},rng(2));
const roll=(s,a,b)=>{let i=0;return E.execute(s,{type:'roll'},()=>(([a,b][i++]||1)-.5)/6);};
const p=s=>E.current(s);
function landAt(s,i){s.phase='choice';s.pending={kind:'travel',title:'test travel',choices:[{value:i,label:'test'}],cost:0};s.queue=[];return choose(s,i);}
function own(s,index,owner,cost=1000,rent=100){s.estates[index]={owner,level:1,paid:cost,rent};}

test('24개 원본 맵과 14개 설명서의 실제 파일이 있고 모든 칸에 유효한 좌표가 있다',()=>{
  assert.equal(D.maps.length,24);assert.equal(D.manuals.length,14);assert.equal(new Set(D.maps.map(m=>m.id)).size,24);
  for(const m of D.maps){assert.ok(fs.existsSync(path.resolve(__dirname,'..',m.source)),m.source);assert.ok(m.cells.length>0);
    for(const [i,t]of m.cells.entries()){assert.equal(t.id,i);assert.ok(t.name);assert.equal(typeof t.note,'string');for(const key of ['x','y','w','h'])assert.ok(Number.isFinite(t[key]),m.id+' '+key);
      assert.ok(t.x>=0&&t.y>=0&&t.x+t.w<=100.01&&t.y+t.h<=100.01,m.id+' '+t.name);
      if(t.type==='property')assert.ok(Number.isFinite(t.cost)&&t.cost>=0&&Number.isFinite(t.rent)&&t.rent>=0);
    }
  }
  for(const s of D.manuals)assert.ok(fs.existsSync(path.resolve(__dirname,'..',s.src)));
});
test('공통 주석 R01–R24 및 실험/미완성 맵의 보완 표시',()=>{
  assert.equal(Object.keys(D.NOTES).length,24);
  for(const id of ['everything','theme-draft','expensive-draft','first'])assert.ok(D.maps.find(m=>m.id===id).status);
});
test('원본의 인원 제한, 시작 자금, 카드3장, 코인60000',()=>{
  assert.throws(()=>E.newGame({mapId:'economy',count:2}));const s=game();assert.equal(s.players.length,3);
  for(const x of s.players){assert.equal(x.cards.length,3);assert.equal(x.coins,60000);assert.equal(x.cash,50000);}
  assert.equal(p(game('rainbow')).cash,20000);assert.equal(p(game('world')).cash,3000000);
});
test('시작점을 통과하면 1회 보너스, 더블이면 차례 유지',()=>{
  let s=game();p(s).pos=25;p(s).cards=[];const id=s.current;s=roll(s,1,1);assert.equal(p(s).cash,60000);assert.equal(p(s).laps,1);assert.equal(s.phase,'choice');
  s=choose(s,'skip');s=E.execute(s,{type:'end'});assert.equal(s.current,id);assert.equal(s.phase,'roll');
});
test('순간이동에는 출발점 보너스가 붙지 않는다',()=>{let s=game();const n=p(s).cash;s=landAt(s,0);assert.equal(p(s).cash,n);assert.equal(p(s).laps,0);});
test('구매·재방문 증축·1/4 매각의 회계',()=>{
  let s=game();p(s).cards=[];s=landAt(s,1);s=choose(s,1);const id=s.current;assert.equal(s.estates[1].owner,id);assert.equal(p(s).cash,46000);
  s=landAt(s,1);s=choose(s,2);assert.equal(s.estates[1].level,2);assert.equal(s.estates[1].rent,4000);assert.equal(p(s).cash,42000);
  s=E.execute(s,{type:'sell',tile:1});assert.equal(p(s).cash,44000);assert.equal(s.estates[1],null);
});
test('통행료는 방문자에게서 소유자로 정확히 이동한다',()=>{
  let s=game();const visitor=s.current,owner=s.players.find(x=>x.id!==visitor).id;p(s).cards=[];own(s,1,owner,4000,2000);
  s=landAt(s,1);assert.equal(s.players[visitor].cash,48000);assert.equal(s.players[owner].cash,52000);
});
test('부족한 통행료는 미납 상태에서 매각하고 완납할 수 있다',()=>{
  let s=game();const owner=s.players.find(x=>x.id!==s.current).id;p(s).cards=[];p(s).cash=1000;own(s,1,owner,4000,2000);own(s,2,s.current,8000,1000);
  s=landAt(s,1);assert.equal(s.phase,'debt');s=E.execute(s,{type:'sell',tile:2});assert.equal(s.phase,'end');assert.equal(p(s).cash,1000);assert.equal(s.players[owner].cash,52000);
});
test('파산은 남은 현금 전달, 소유지 해제, 활성 차례 진행을 보장한다',()=>{
  let s=game();const loser=s.current,owner=s.players.find(x=>x.id!==loser).id;p(s).cards=[];p(s).cash=100;own(s,1,owner,4000,2000);own(s,2,loser,200,10);
  s=landAt(s,1);s=E.execute(s,{type:'bankrupt'});assert.equal(s.players[loser].out,true);assert.equal(s.estates[2],null);assert.equal(s.players[owner].cash,50100);
  s=E.execute(s,{type:'end'});assert.notEqual(s.current,loser);assert.ok(E.validateSave(s));
});
test('소유권 없는 매각/돈 부족 구매는 원래 상태를 바꾸지 않는다',()=>{
  let s=game();assert.throws(()=>E.execute(s,{type:'sell',tile:1}));p(s).cash=1;s=landAt(s,1);const snapshot=JSON.stringify(s);assert.throws(()=>choose(s,1));assert.equal(JSON.stringify(s),snapshot);
});
test('벌금 면제는 청구 1회만 막고 방패는 공격 1회만 막는다',()=>{
  let s=game();const other=s.players.find(x=>x.id!==s.current).id;p(s).cards=['waiver','shield'];own(s,1,other,4000,2000);
  s=landAt(s,1);assert.equal(p(s).cash,50000);assert.ok(!p(s).cards.includes('waiver'));
  s.traps.push({kind:'missile',tile:2,owner:other,expires:99});s=landAt(s,2);assert.equal(p(s).out,false);assert.ok(!p(s).cards.includes('shield'));
  s=choose(s,'skip');s=landAt(s,2);assert.equal(p(s).out,true);
});
test('폭탄은 설치자 다음 차례에 사라지고 미사일은 유지된다',()=>{
  let s=game();const owner=s.current;const victim=s.players.find(x=>x.id!==owner).id;
  s.traps=[{kind:'bomb',tile:1,owner,expires:p(s).turns+1},{kind:'missile',tile:2,owner,expires:1}];
  s.phase='end';for(let i=0;i<3;i++){s.phase='end';s=E.execute(s,{type:'end'});}assert.equal(s.current,owner);assert.ok(!s.traps.some(x=>x.kind==='bomb'));assert.ok(s.traps.some(x=>x.kind==='missile'));
});
test('블랙홀은 연결한 화이트홀로 보내고 주회 보너스를 주지 않는다',()=>{
  let s=game();const owner=s.players.find(x=>x.id!==s.current).id;p(s).cards=[];s.traps=[{kind:'blackhole',tile:1,owner},{kind:'whitehole',tile:3,owner}];const cash=p(s).cash;
  s=landAt(s,1);assert.equal(p(s).pos,3);assert.equal(p(s).cash,cash);
});
test('큰 무인도는 새 말이 도착하면 기존 말을 풀어준다',()=>{
  let s=game('magic');const map=E.mapOf(s),i=map.cells.findIndex(t=>t.type==='bigIsland');const other=s.players.find(x=>x.id!==s.current);other.pos=i;other.held=true;
  s=landAt(s,i);assert.equal(s.players[other.id].held,false);assert.equal(p(s).held,true);
});
test('BLOCK 바로 앞에서 멈췄다가 다음 이동에 통과',()=>{
  let s=game('items');const i=E.mapOf(s).cells.findIndex(t=>t.type==='block');p(s).pos=i-1;p(s).cards=[];
  s=roll(s,1,2);assert.equal(p(s).pos,i-1);if(s.phase==='choice')s=choose(s,'skip');s.phase='roll';s=roll(s,1,2);assert.equal(p(s).pos,i+2);
});
test('에브리웨어는 각기 다른 모서리, 크로스는 각 팔 끝에서 출발',()=>{
  const s=game('everywhere');assert.equal(new Set(s.players.map(x=>x.start)).size,4);
  const cross=game('cross');assert.equal(new Set(cross.players.map(x=>x.start)).size,4);
});
test('크로스 중앙에서 방향 선택은 남은 이동 수를 보존한다',()=>{
  let s=game('cross-notebook');p(s).pos=0;p(s).previous=null;s=roll(s,1,2);assert.equal(s.pending.kind,'direction');assert.equal(s.pending.steps,3);
  s=choose(s,1);const arm=E.mapOf(s).arms[1];assert.equal(p(s).pos,arm[2]);assert.ok(E.validateSave(s));
});
test('일반 도시 전체 같은 색 소유 시 컬러 독점',()=>{
  let s=game();const m=E.mapOf(s);for(const t of m.cells.filter(t=>t.group==='red'))own(s,t.id,s.current,t.cost,t.rent);
  s=landAt(s,0);assert.equal(s.phase,'gameover');assert.equal(s.results.reason,'컬러 독점');
});
test('북극/남극은 하트 3개 라인으로 이기지 않고 4개에서 승리',()=>{
  let s=game('polar'),hearts=E.mapOf(s).cells.filter(t=>t.group==='heart');for(const t of hearts.slice(0,3))own(s,t.id,s.current,t.cost,t.rent);
  s=landAt(s,0);assert.notEqual(s.phase,'gameover');own(s,hearts[3].id,s.current,20000,20000);s=landAt(s,0);assert.equal(s.results.reason,'하트 4개 건설');
});
test('페스티벌의 지구 매입은 즉시 승리',()=>{
  let s=game('festival');p(s).cash=500000;const earth=E.mapOf(s).cells.findIndex(t=>t.instantWin);s=landAt(s,earth);s=choose(s,1);assert.equal(s.phase,'gameover');assert.equal(s.results.reason,'지구 구입');
});
test('다이아 건설 제한과 비소모 정책',()=>{
  let s=game('diamond');s=landAt(s,1);assert.equal(s.phase,'end');p(s).diamonds=3;s=landAt(s,1);s=choose(s,1);assert.equal(p(s).diamonds,3);
});
test('비싸맵은 기본 출입료와 건설 후 통행료가 별개',()=>{
  let s=game('expensive');p(s).cards=[];const i=E.mapOf(s).cells.findIndex(t=>t.name==='프랑스');const n=p(s).cash;s=landAt(s,i);assert.equal(p(s).cash,n-3000);assert.equal(s.pending.kind,'build');
});
test('퍼스트맵은 20억 칸을 지나갈 때도 지불',()=>{
  let s=game('first');p(s).cards=[];const i=E.mapOf(s).cells.findIndex(t=>t.type==='passFee');p(s).pos=i-1;const cash=p(s).cash;s=roll(s,1,2);assert.equal(p(s).cash,cash-200000);
});
test('미완성 경주판은 먼저 다섯 바퀴를 돌면 승리',()=>{let s=game('everything');p(s).laps=4;p(s).pos=25;s=roll(s,1,2);assert.equal(s.phase,'gameover');assert.equal(s.results.reason,'5바퀴 완주');});
test('BEST1 마지막 칸을 초과하는 이동도 정확히 도착하여 끝난다',()=>{let s=game('best1');p(s).pos=E.mapOf(s).cells.length-2;s=roll(s,6,5);assert.equal(s.phase,'gameover');assert.equal(s.results.reason,'도착점 완주');});
test('같은 기기 가위바위보는 선택을 숨겨 전달하고 결과를 계산',()=>{
  let s=game('best1');const i=E.mapOf(s).cells.findIndex(t=>t.challenge===3);s=landAt(s,i);const other=s.pending.choices[0].value;s=choose(s,other);assert.equal(s.pending.kind,'rpsHand');
  const alternate=choose(s,0);s=choose(s,1);assert.equal(s.pending.kind,'rpsHand');assert.equal(s.pending.controller,other);assert.equal(s.pending.stage,'second');assert.equal(s.pending.title,alternate.pending.title);assert.deepEqual(s.pending.choices,alternate.pending.choices);
  s=choose(s,0);assert.notEqual(s.pending?.kind,'rpsHand');assert.ok(E.validateSave(s));
});
test('새 저장 형식만 받고 손상 저장을 거부한다',()=>{
  const s=game();assert.ok(E.validateSave(JSON.parse(JSON.stringify(s))));assert.ok(!E.validateSave({}));assert.ok(!E.validateSave({...s,version:999}));
  const bad=JSON.parse(JSON.stringify(s));bad.players[0].cash=-1;assert.ok(!E.validateSave(bad));bad.players[0].cash=10;bad.players[0].pos=999;assert.ok(!E.validateSave(bad));
});
test('모든 맵 최소/최대 인원과 8개 시드, 총 368판 완주 및 매 행동 저장 검증',()=>{
  let completed=0;for(const m of D.maps)for(const count of new Set(m.players))for(let seed=1;seed<=8;seed++){
    const random=rng(seed);let s=E.newGame({mapId:m.id,count,roundLimit:20},random),steps=0;
    while(s.phase!=='gameover'&&steps++<5000){s=E.execute(s,E.autoAction(s,random),random);assert.ok(E.validateSave(s),`${m.id}/${count}/${seed}/${steps}`);}
    assert.equal(s.phase,'gameover',m.id+' did not finish');assert.ok(s.results.winners.length>0);completed++;
  }assert.equal(completed,368);
});
