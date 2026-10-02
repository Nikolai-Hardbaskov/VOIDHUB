import test from 'node:test';
import assert from 'node:assert/strict';
import {actor,initialState,resolveAttack,applyEvent,validateState,ledger,addEvent,replay,validateLedger} from '../core.js';
import {effectFromTemplate,activeEffects,effectiveStat} from '../effects.js';
import {abilityFromTemplate,resolveTreatment,resolveAbility,resolveRound,resolveInitiative,eventKind} from '../tactics.js';
const fixed=values=>()=>{assert.ok(values.length,'unexpected die');return values.shift();};
function medical(){const s=initialState();s.player.hp=40;s.player.wounds=[{id:'w',region:'chest',name:'Рана',treated:false}];s.player.effects=[effectFromTemplate('bleeding','blood')];s.inventory=[{id:'kit',name:'Аптечка',tag:'medkit',ownerId:'player',amount:2}];return s;}
function commit(s,r){applyEvent(s,{kind:eventKind(r),payload:r});return s;}
test('First aid heals within max HP, spends a supply, treats a wound, stops bleeding; replay is idempotent',()=>{
 const s=medical(),before=JSON.stringify(s),r=resolveTreatment(s,{kind:'heal',actorId:'player',targetId:'player',supplyId:'kit'},'care',fixed([20,5,6]));assert.equal(JSON.stringify(s),before);commit(s,r);assert.equal(s.player.hp,61);assert.equal(s.inventory[0].amount,1);assert.equal(s.player.wounds[0].treated,true);assert.equal(s.player.effects.length,0);
 const book=ledger();book.base=medical();addEvent(book,[],'mechanic',r,{id:r.id});addEvent(book,[],'mechanic',r,{id:r.id});assert.equal(replay(book,[]).player.hp,61);assert.equal(replay(book,[]).inventory[0].amount,1);assert.equal(validateLedger(book).events.length,1);
});
test('Failed aid consumes one supply and does not heal; inappropriate body, missing or чужой supply rejected',()=>{
 const s=medical();commit(s,resolveTreatment(s,{kind:'heal',actorId:'player',targetId:'player',supplyId:'kit'},'failed',fixed([99])));assert.equal(s.player.hp,40);assert.equal(s.inventory[0].amount,1);s.player.species='некрон';assert.throws(()=>resolveTreatment(s,{kind:'heal',actorId:'player',targetId:'player',supplyId:'kit'},'bio'));s.player.species='человек';s.inventory[0].ownerId='enemy';assert.throws(()=>resolveTreatment(s,{kind:'heal',actorId:'player',targetId:'player',supplyId:'kit'},'stolen'));
});
test('Stabilization keeps HP 0 and stops bleeding; revival by medical care only outside combat and never after destroyed',()=>{
 const s=medical();s.player.hp=0;s.squad=[actor({id:'medic',name:'Медик'})];s.inventory[0].ownerId='medic';s.battle.active=true;
 commit(s,resolveTreatment(s,{kind:'stabilize',actorId:'medic',targetId:'player',supplyId:'kit'},'stable',fixed([1])));assert.equal(s.player.hp,0);assert.equal(s.player.stabilized,true);assert.equal(s.player.effects.length,0);
 assert.throws(()=>resolveTreatment(s,{kind:'heal',actorId:'medic',targetId:'player',supplyId:'kit'},'combat'));s.battle.active=false;commit(s,resolveTreatment(s,{kind:'heal',actorId:'medic',targetId:'player',supplyId:'kit'},'recovery',fixed([1,1,1])));assert.equal(s.player.hp,12);
 s.player.destroyed=true;assert.throws(()=>resolveTreatment(s,{kind:'heal',actorId:'medic',targetId:'player',supplyId:'kit'},'dead'));
});
test('Effects alter attack skill once and shield absorbs then depletes before wounds',()=>{
 const s=initialState();s.player.weaponIds=['gun'];s.player.effects=[effectFromTemplate('suppressed','sup')];s.enemies=[actor({id:'e',effects:[effectFromTemplate('ward','ward')]})];s.weapons=[{id:'gun',name:'Лазган',mode:'ranged',damage:'2d10+20',penetration:5,ammo:9,cost:1,type:'лазерный'}];
 const r=resolveAttack(s,{actorId:'player',targetId:'e',weaponId:'gun'},'a',fixed([1,1,5,6]));assert.equal(r.chance,30);assert.equal(r.shieldAbsorbed,31);assert.equal(r.damage,0);commit(s,r);assert.equal(s.enemies[0].effects[0].shieldPoints,9);assert.equal(s.enemies[0].hp,100);assert.equal(s.enemies[0].wounds.length,0);
});
test('End of round ticks damage once, poison can resist before damage, expires counters, preserves text effects',()=>{
 const s=medical();s.player.effects.push(effectFromTemplate('stunned','stun'),'Описание без числового действия');const r=resolveRound(s,'r',fixed([4]));commit(s,r);assert.equal(s.player.hp,33);assert.equal(s.battle.round,2);assert.ok(!activeEffects(s.player).some(e=>e.templateId==='stunned'));assert.ok(s.player.effects.includes('Описание без числового действия'));
 s.player.effects=[effectFromTemplate('poisoned','p')];const hp=s.player.hp;commit(s,resolveRound(s,'p-round',fixed([1])));assert.equal(s.player.hp,hp);assert.equal(s.player.effects.length,0);
});
test('Initiative uses reaction+die, deterministic ties, only visible living actors, preserves existing dice',()=>{
 const s=initialState();s.player.stats.reaction=40;s.squad=[actor({id:'ally',stats:{...s.player.stats,reaction:60}})];s.enemies=[actor({id:'dead',hp:0}),actor({id:'hidden',visible:false})];const r=resolveInitiative(s,'init',fixed([10,1]),true);commit(s,r);assert.deepEqual(s.battle.order.map(o=>o.actorId),['ally','player']);assert.equal(s.battle.round,1);const next=resolveInitiative(s,'next',()=>{throw Error('no new dice');});assert.equal(next.patch.battle.order[0].die,1);
});
test('Psychic ability requires assignment and access, perils harm caster, charges and cooldown consumed on failed use',()=>{
 const s=initialState(),ability={...abilityFromTemplate('warp-bolt','psi'),charges:2};s.abilities=[ability];s.player.abilityIds=['psi'];s.enemies=[actor({id:'e'})];assert.throws(()=>resolveAbility(s,{actorId:'player',targetId:'e',abilityId:'psi'},'untrained'));s.player.psychic=true;s.battle.active=true;
 commit(s,resolveAbility(s,{actorId:'player',targetId:'e',abilityId:'psi'},'perils',fixed([99,5,6])));assert.equal(s.player.hp,79);assert.equal(s.enemies[0].hp,100);assert.equal(s.abilities[0].charges,1);assert.equal(s.player.cooldowns.psi,2);assert.throws(()=>resolveAbility(s,{actorId:'player',targetId:'e',abilityId:'psi'},'cooldown'));s.player.species='тау';s.battle.round=2;assert.throws(()=>resolveAbility(s,{actorId:'player',targetId:'e',abilityId:'psi'},'tau'));
});
test('Reanimation at zero HP is opt-in, once per fight, preserves wounds and cannot revive a destroyed body',()=>{
 const s=initialState();s.player.species='некрон';s.player.hp=0;s.player.wounds=[{id:'w',name:'Повреждение'}];s.player.abilityIds=['re'];s.abilities=[abilityFromTemplate('reanimation','re')];commit(s,resolveAbility(s,{actorId:'player',targetId:'player',abilityId:'re'},'revive',fixed([1,5,6])));assert.equal(s.player.hp,31);assert.equal(s.player.wounds.length,1);assert.equal(s.player.reanimationUsed,true);s.player.hp=0;assert.throws(()=>resolveAbility(s,{actorId:'player',targetId:'player',abilityId:'re'},'repeat'));s.player.reanimationUsed=false;s.player.destroyed=true;assert.throws(()=>resolveAbility(s,{actorId:'player',targetId:'player',abilityId:'re'},'destroyed'));
});
test('Old text effects stay descriptive and unknown stat changes do not gain extra bonuses',()=>{
 const s=validateState({player:{effects:['Благословение'],stats:{ranged:70}}});assert.equal(effectiveStat(s.player,'ranged'),70);assert.equal(s.abilities.length,0);
});
test('Shared medical stock is available to allies, never enemy actors; an active fight cannot restart',async()=>{
 const {availableSupply,resolveAction}=await import('../tactics.js');const s=medical();s.squad=[actor({id:'ally'})];s.enemies=[actor({id:'enemy'})];s.inventory[0].ownerId='party';assert.equal(availableSupply(s,'ally','medkit').length,1);assert.equal(availableSupply(s,'enemy','medkit').length,0);s.battle.active=true;assert.throws(()=>resolveAction(s,{kind:'start'},'restart'));
});
