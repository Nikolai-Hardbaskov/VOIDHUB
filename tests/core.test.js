import test from 'node:test';
import assert from 'node:assert/strict';
import {actor,initialState,ledger,addEvent,messagePath,replay,resolveAttack,applyEvent,validateState,parseDice,accessibleChannels,contextState} from '../core.js';
import {SPECIES,PROFILES} from '../presets.js';

function scenario(){const state=initialState();state.player.stats.ranged=60;state.player.weaponIds=['gun'];state.weapons=[{id:'gun',name:'Тестовое оружие',mode:'ranged',damage:'2d10+20',penetration:8,ammo:10,cost:1,type:'энергетический'}];state.enemies=[actor({id:'enemy',name:'Противник',armor:{chest:15}})];return state;}
const fixed=values=>()=>{if(!values.length)throw Error('Unexpected die');return values.shift();};
test('Exact requested species and contextual presets',()=>{
 assert.equal(SPECIES.length,20);assert.ok(SPECIES.includes('фелинид'));assert.ok(SPECIES.includes('примарх'));
 assert.ok(!PROFILES['тау'].affiliations.includes('Клан орков'));
 assert.ok(PROFILES['круут'].affiliations.includes('Империя Тау'));
 for(const species of SPECIES){assert.ok(PROFILES[species].origins.length);assert.ok(PROFILES[species].backgrounds.length);assert.ok(Object.keys(PROFILES[species].traits).length);}
});
test('Hit, aim modifier, penetration, damage, body wound and ammo',()=>{
 const state=scenario(),result=resolveAttack(state,{actorId:'player',targetId:'enemy',weaponId:'gun',region:'chest',modifiers:[{reason:'Прицеливание',value:10}]},'attack',fixed([32,4,7]));
 assert.equal(result.chance,50);assert.equal(result.damage,24);assert.equal(result.hpAfter,76);assert.equal(state.enemies[0].hp,100);
 applyEvent(state,{kind:'attack',payload:result});assert.equal(state.enemies[0].hp,76);assert.equal(state.weapons[0].ammo,9);assert.equal(state.enemies[0].wounds[0].region,'chest');
});
test('A miss spends ammo but creates no wound or damage',()=>{
 const state=scenario(),result=resolveAttack(state,{actorId:'player',targetId:'enemy',weaponId:'gun',region:'chest'},'miss',fixed([99]));
 applyEvent(state,{kind:'attack',payload:result});assert.equal(state.weapons[0].ammo,9);assert.equal(state.enemies[0].hp,100);assert.equal(state.enemies[0].wounds.length,0);
});
test('Armor can stop damage and penetration cannot create negative armor',()=>{
 const state=scenario();state.enemies[0].armor.chest=100;let r=resolveAttack(state,{actorId:'player',targetId:'enemy',weaponId:'gun',region:'chest'},'blocked',fixed([1,1,1]));assert.equal(r.damage,0);
 state.weapons[0].penetration=200;r=resolveAttack(state,{actorId:'player',targetId:'enemy',weaponId:'gun',region:'chest'},'penetrated',fixed([1,1,1]));assert.equal(r.damage,22);
});
test('Invalid attacks and dice never mutate game state',()=>{
 const state=scenario(),original=JSON.stringify(state);assert.throws(()=>resolveAttack(state,{targetId:'other',weaponId:'gun'},'invalid'));
 assert.equal(JSON.stringify(state),original);state.weapons[0].ammo=0;assert.throws(()=>resolveAttack(state,{targetId:'enemy',weaponId:'gun'},'empty'));
 assert.throws(()=>parseDice('0d10+20'));assert.throws(()=>parseDice('alert(1)'));
});
test('Replay is idempotent, editable and branch-sensitive',()=>{
 const book=ledger();book.base=scenario();const chat=[{name:'U',is_user:true,mes:'Выстрел'}],path=messagePath(chat);
 const result=resolveAttack(book.base,{actorId:'player',targetId:'enemy',weaponId:'gun',region:'chest'},'same',fixed([1,4,7]));
 addEvent(book,path,'attack',result,{id:'same'});addEvent(book,path,'attack',result,{id:'same'});
 assert.equal(book.events.length,1);assert.equal(replay(book,path).enemies[0].hp,76);assert.equal(replay(book,path).enemies[0].hp,76);
 const sibling=structuredClone(chat);sibling[0].mes='Ухожу';assert.equal(replay(book,messagePath(sibling)).enemies[0].hp,100);
 chat.length=0;assert.equal(replay(book,messagePath(chat)).enemies[0].hp,100);
});
test('Later manual edits win over earlier story state',()=>{
 const book=ledger(),path=messagePath([{name:'NPC',mes:'Ранен',is_user:false}]);addEvent(book,path,'update',{player:{hp:40}});addEvent(book,path,'update',{player:{hp:70}});assert.equal(replay(book,path).player.hp,70);
});
test('Closed channel knowledge boundaries and full histories',()=>{
 const state=initialState();state.channels=[{id:'mine',participants:['player','a'],messages:Array.from({length:25},(_,i)=>({from:'a',text:'Message '+i})),public:false},{id:'other',participants:['b','c'],messages:[{text:'SECRET'}],public:false},{id:'public',participants:[],messages:[],public:true}];
 assert.deepEqual(accessibleChannels(state).map(c=>c.id),['mine','public']);assert.deepEqual(accessibleChannels(state,'b').map(c=>c.id),['other','public']);assert.equal(contextState(state).channels[0].messages.length,25);
});
test('State validates exotic anatomy, zero HP and removes prototype keys',()=>{
 const value=JSON.parse('{"player":{"hp":0,"maxHp":200,"anatomy":{"core":"Ядро","wing":"Крыло"},"__proto__":{"polluted":true}}}');
 const state=validateState(value);assert.equal(state.player.hp,0);assert.equal(state.player.maxHp,200);assert.deepEqual(state.player.anatomy,{core:'Ядро',wing:'Крыло'});assert.equal({}.polluted,undefined);
});
