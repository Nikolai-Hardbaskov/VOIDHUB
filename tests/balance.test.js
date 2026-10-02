import test from 'node:test';
import assert from 'node:assert/strict';
import {SPECIES} from '../presets.js';
import {actor,initialState,resolveAttack,applyEvent,validateRecord,validateState,attackReport,ledger,addEvent,replay} from '../core.js';
import {CREATURE_PROFILES,WEAPON_TEMPLATES,ARMOR_TEMPLATES,profilesFor,applyCreatureProfile,weaponFromTemplate,armorFromTemplate,storyDefaults,damageRange,expectedDamage} from '../balance.js';
const fixed=values=>()=>{assert.ok(values.length,'unexpected roll');return values.shift();};
test('All 20 species have distinct editable profiles, with elite and monster variants',()=>{
 for(const species of SPECIES){const p=profilesFor(species);assert.ok(p.length,species);for(const profile of p){assert.ok(profile.maxHp>0);assert.equal(Object.keys(profile.stats).length,6);assert.ok(Object.values(profile.stats).every(n=>n>=1&&n<=100));}}
 for(const list of [CREATURE_PROFILES,WEAPON_TEMPLATES,ARMOR_TEMPLATES])assert.equal(new Set(list.map(r=>r.id)).size,list.length);
 assert.ok(profilesFor('человек').length>=3);assert.ok(profilesFor('тиранид').length>=4);assert.ok(profilesFor('демон').length>=2);
 assert.equal(profilesFor('Свой вариант').length,0);
});
test('Applying a profile preserves lost HP, wounds, effects, actual armor, and equipment',()=>{
 const current=actor({species:'космодесантник',hp:40,maxHp:100,wounds:[{region:'chest',name:'Рана'}],effects:['Оглушение'],armor:{head:7},weaponIds:['my-weapon'],rank:'Сержант'});
 const original=JSON.stringify(current),next=applyCreatureProfile(current,'astartes');
 assert.equal(next.maxHp,220);assert.equal(next.hp,160);assert.deepEqual(next.wounds,current.wounds);assert.deepEqual(next.effects,current.effects);assert.deepEqual(next.armor,current.armor);assert.deepEqual(next.weaponIds,current.weaponIds);assert.equal(next.rank,'Сержант');assert.equal(JSON.stringify(current),original);
 assert.throws(()=>applyCreatureProfile(current,'tau'));
 const down=applyCreatureProfile({...current,hp:0},'astartes');assert.equal(down.hp,0);assert.equal(down.status,'Выведен из боя');
 assert.throws(()=>applyCreatureProfile({...current,hp:NaN},'astartes'));
});
test('Natural armor follows custom body regions and does not grant worn equipment',()=>{
 const next=applyCreatureProfile(actor({species:'тиранид',anatomy:{core:'Тело',claw:'Коготь'}}),'tyranid-carnifex');
 assert.deepEqual(next.naturalArmor,{core:35,claw:35});assert.deepEqual(next.armor,{});assert.deepEqual(next.weaponIds,[]);
 const suit=armorFromTemplate('tau-crisis',{core:'Корпус',wing:'Крыло'},'suit');assert.deepEqual(suit.regions,['core','wing']);
 assert.deepEqual(armorFromTemplate('helmet',{core:'Тело'},'helmet').regions,[]);
});
test('All weapon and armor templates validate, instances are independent, null ammo supported',()=>{
 for(const weapon of WEAPON_TEMPLATES){assert.ok(validateRecord('weapons',weaponFromTemplate(weapon.id)));const r=damageRange(weapon);assert.ok(r.min<=r.mean&&r.mean<=r.max);}
 for(const armor of ARMOR_TEMPLATES)assert.ok(validateRecord('armor',armorFromTemplate(armor.id)));
 const a=weaponFromTemplate('bolter','a'),b=weaponFromTemplate('bolter','b');a.ammo=1;assert.equal(b.ammo,30);
 assert.equal(weaponFromTemplate('power-sword').ammo,null);assert.equal(armorFromTemplate('clothes').protection,0);
});
test('Equipped and natural protection combine, penetration applies once, damage reports are explicit',()=>{
 const state=initialState();state.player.weaponIds=['gun'];state.weapons=[weaponFromTemplate('bolter','gun')];state.enemies=[actor({id:'target',naturalArmor:{chest:14},armor:{chest:18}})];
 const result=resolveAttack(state,{targetId:'target',weaponId:'gun',region:'chest'},'combined',fixed([1,5,6]));
 assert.equal(result.damageRoll.total,41);assert.equal(result.protection,20);assert.equal(result.damage,21);assert.ok(attackReport(result).includes('броня 18 + природная 14 − пробитие 12'));
 applyEvent(state,{kind:'attack',payload:result});assert.equal(state.enemies[0].hp,79);
});
test('Hand weapons add strength exactly once and armor cannot increase damage',()=>{
 const state=initialState();state.player.stats.strength=75;state.player.weaponIds=['sword'];state.weapons=[weaponFromTemplate('power-sword','sword')];state.enemies=[actor({id:'target',armor:{chest:32}})];
 const r=resolveAttack(state,{targetId:'target',weaponId:'sword',region:'chest'},'melee',fixed([1,5,6]));assert.equal(r.strengthBonus,7);assert.equal(r.damage,46);
});
test('Exact hit damage handles protection stopping some or all dice, stronger weapons differ meaningfully',()=>{
 const lasgun=weaponFromTemplate('lasgun'),bolter=weaponFromTemplate('bolter'),plasma=weaponFromTemplate('plasma');
 assert.ok(Math.abs(expectedDamage(lasgun,0)-31)<1e-9);assert.equal(expectedDamage(lasgun,50),0);
 const stopped={mode:'ranged',damage:'1d2',penetration:0};assert.equal(expectedDamage(stopped,1),.5);
 assert.ok(expectedDamage(plasma,32)>expectedDamage(bolter,32));assert.ok(expectedDamage(bolter,32)>expectedDamage(lasgun,32));
});
test('New story records fill profiles; explicit injury and individual stats override defaults',()=>{
 const newEnemy=storyDefaults('enemies',{id:'n',species:'некрон',balanceProfile:'necron-warrior',hp:30,stats:{ranged:70}});
 const n=validateRecord('enemies',newEnemy);assert.equal(n.hp,30);assert.equal(n.maxHp,180);assert.equal(n.naturalArmor.chest,14);assert.equal(n.stats.ranged,70);assert.equal(n.stats.reaction,30);
 assert.equal(storyDefaults('enemies',{id:'large',species:'орк',maxHp:275}).hp,275);
 const gun=storyDefaults('weapons',{id:'g',templateId:'lasgun',ammo:0});assert.equal(gun.damage,'2d10+20');assert.equal(gun.ammo,0);
 assert.equal(storyDefaults('weapons',{id:'b',name:'Болтер'}).penetration,12);
});
test('Old campaigns acquire zero natural armor without changing HP or dice events; partial player stats preserve others',()=>{
 const old=initialState();delete old.player.naturalArmor;old.player.hp=47;old.player.stats.ranged=77;
 const state=validateState(old);assert.deepEqual(state.player.naturalArmor,{});assert.equal(state.player.hp,47);
 const book=ledger();book.base=state;addEvent(book,[],'update',{player:{stats:{melee:80}}});assert.equal(replay(book,[]).player.stats.ranged,77);assert.equal(replay(book,[]).player.stats.melee,80);
});
