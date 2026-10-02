import {Hub} from './bridge.js';
import {UI} from './ui.js';

let hub,ui;
const notify=(text,kind='info')=>{
 const toast=globalThis.toastr;
 if(toast?.[kind])toast[kind](text,'VOIDHUB',{timeOut:kind==='error'?15000:5000,preventDuplicates:true});
 else console[kind==='error'?'error':'info']('[VOIDHUB]',text);
};
globalThis.voidhubBeforeGeneration=async(...args)=>{if(hub)await hub.beforeGeneration(...args);};

function initialize(){
 if(hub)return;
 const context=()=>globalThis.SillyTavern.getContext();
 hub=new Hub(context,notify,()=>ui?.render());ui=new UI(hub);ui.mount();
 const c=context(),types=c.eventTypes||c.event_types;
 const listen=(name,handler)=>{if(types?.[name])c.eventSource.on(types[name],handler);};
 listen('CHAT_CHANGED',()=>{
  hub.restoreDraft();hub.error='';hub.pending=null;ui.editor=null;ui.scroll={};ui.channelId=null;
  hub.inject();ui.render();
 });
 listen('MESSAGE_SENT',()=>{if(hub.ready()){const message=context().chat.at(-1);if(message?.is_user)hub.applyOperation(message);hub.inject();}});
 for(const name of ['CHARACTER_MESSAGE_RENDERED','MESSAGE_EDITED','MESSAGE_DELETED','MESSAGE_SWIPED'])listen(name,()=>{
  if(hub.internal)return;
  hub.inject();ui.render();
  void hub.sync().catch(error=>hub.fail(error));
 });
 for(const name of ['USER_MESSAGE_RENDERED','GENERATION_ENDED','GENERATION_STOPPED'])listen(name,()=>{hub.restoreDraft();ui.chatReports();ui.status();});
 if(c.SlashCommandParser&&c.SlashCommand)c.SlashCommandParser.addCommandObject(c.SlashCommand.fromProps({name:'voidhub',callback:async()=>{ui.open();return '';},helpString:'Открыть терминал VOIDHUB.'}));
 hub.inject();
}
const initial=globalThis.SillyTavern?.getContext?.();
if(initial?.eventSource&&(initial.eventTypes||initial.event_types)?.APP_READY)initial.eventSource.on((initial.eventTypes||initial.event_types).APP_READY,initialize);
else if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
