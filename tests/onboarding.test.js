import test from 'node:test';
import assert from 'node:assert/strict';
import {Hub} from '../bridge.js';
import {actor,ledger,hash,addEvent,validateLedger} from '../core.js';
import {validateProfile} from '../onboarding.js';

const player=()=>actor({name:'Кай',species:'человек',affiliation:'Астра Милитарум',role:'Медик',origin:'Мир-улей',background:'Полковой госпиталь',traits:['Хирургические навыки']});
function setup(){
 let requests=0,prompt='';
 const ctx={chatId:'creation',characterId:0,chat:[{is_user:false,name:'NPC',mes:'Приветствие'}],chatMetadata:{voidhub:ledger()},extensionSettings:{},saveChat:async()=>{},saveMetadata:async()=>{},setExtensionPrompt:(id,value)=>prompt=value,generateRaw:async()=>{requests++;return '{"update":{}}';}};
 const hub=new Hub(()=>ctx);return {hub,ctx,requests:()=>requests,prompt:()=>prompt};
}
test('Creation requires a name and identity fields; empty traits need an explicit choice',()=>{
 for(const key of ['name','species','affiliation','role','origin','background'])assert.throws(()=>validateProfile({...player(),[key]:''}),/Укажите/);
 assert.throws(()=>validateProfile({...player(),name:'{{user}}'}),/имя/);
 assert.throws(()=>validateProfile({...player(),traits:[]}),/особенности/);
 assert.deepEqual(validateProfile({...player(),traits:[]},{noTraits:true}).traits,[]);
 assert.equal(validateProfile({...player(),species:'Свой вид',name:' Кай '}).name,'Кай');
});
test('No context or automatic AI synchronization before the user creates a profile',async()=>{
 const s=setup();assert.equal(s.hub.injection(),'');s.hub.inject();assert.equal(s.prompt(),'');await s.hub.sync(true);assert.equal(s.requests(),0);
 s.hub.update({player:{name:'Предложение ИИ',profileCreated:true}},'story');assert.equal(s.hub.profileReady(),false);
 await assert.rejects(()=>s.hub.send('Начало игры'),/Сначала/);await assert.rejects(()=>s.hub.vox('channel','Вопрос'),/Сначала/);
});
test('Main chat stays usable before opening VOIDHUB; beginning setup gates campaign generation',async()=>{
 const s=setup();let aborts=0;await s.hub.beforeGeneration([],8192,v=>{if(v)aborts++;},'normal');assert.equal(aborts,0);
 s.hub.startProfile();await s.hub.beforeGeneration([],8192,v=>{if(v)aborts++;},'normal');assert.equal(aborts,1);assert.equal(s.requests(),0);
});
test('Confirmed creation unlocks the campaign and survives a swiped greeting',()=>{
 const s=setup();s.hub.startProfile();s.hub.completeProfile(player());assert.equal(s.hub.profileReady(),true);assert.equal(s.hub.book.profileStarted,false);
 s.ctx.chat[0].mes='Другое приветствие';assert.equal(s.hub.state().player.name,'Кай');assert.equal(s.hub.state().player.role,'Медик');assert.ok(s.hub.injection().includes('Хирургические навыки'));
 const other=new Hub(()=>s.ctx);assert.equal(other.profileReady(),true);
});
test('Review of an existing campaign keeps injuries, items and missions',()=>{
 const s=setup();s.hub.book.base.player=player();s.hub.book.base.resources=[{id:'r',name:'Запас',value:42}];s.hub.book.base.missions=[{id:'m',title:'Задача',status:'active',goals:[]}];
 addEvent(s.hub.book,s.hub.path,'update',{player:{hp:62,wounds:[{name:'Ранение',region:'head'}]}},{source:'story'});
 const value=s.hub.state().player;s.hub.completeProfile(value);assert.equal(s.hub.state().player.hp,62);assert.equal(s.hub.state().player.wounds.length,1);assert.equal(s.hub.state().resources[0].value,42);assert.equal(s.hub.state().missions[0].status,'active');
 s.ctx.chat[0].mes='Изменённая ветка';assert.equal(s.hub.state().player.hp,100);
});
test('Creation status survives export and import, is per chat and cannot be forged by a story operation',()=>{
 const s=setup();s.hub.completeProfile(player());const exported=s.hub.export();assert.equal(validateLedger(JSON.parse(exported).book).profileCreated,true);
 s.ctx.chatId='other';s.ctx.chatMetadata={voidhub:ledger()};assert.equal(s.hub.profileReady(),false);
 const message={is_user:true,name:'User',mes:'Операция',extra:{voidhub:{uid:'fake',operation:{player:{role:'Медик'}},intentSignature:hash('Операция')}}};s.ctx.chat.push(message);s.hub.applyOperation(message);assert.equal(s.hub.book.events.length,0);
 s.hub.import(exported);assert.equal(s.hub.profileReady(),true);assert.equal(s.hub.state().player.name,'Кай');
});
