// Campaign presets are qualitative starting rules, not a complete canonical authority engine.
export const TRAVEL_MODES=[['surface','Наземный путь'],['orbit','Орбита / посадка'],['realspace','Обычное пространство'],['warp','Варп-переход'],['webway','Паутина'],['necron','Некронская технология'],['bioship','Биокорабль'],['custom','Свой способ']];
export const JOURNEY_STAGES={planned:'Маршрут выбран',awaiting_access:'Запрошен доступ',underway:'В пути',interrupted:'Переход прерван',ready_to_arrive:'Готов к прибытию',arrived:'Прибыл',cancelled:'Отменён'};
export const CAREER_TYPES={promotion:'Повышение',appointment:'Назначение',transfer:'Перевод',release:'Освобождение от службы',contract:'Завершение договора',desertion:'Самовольный уход',defection:'Смена стороны'};
const service=(id,name,ranks,exits,note)=>({id,name,ranks,exits,note});
export const SERVICE_PROFILES=[
 service('guard','Астра Милитарум',['Гвардеец','Капрал','Сержант','Лейтенант','Капитан','Полковник'],['release','transfer','contract','custom'],'Назначение требует уполномоченного командования; самовольный уход может быть дезертирством.'),
 service('navy','Имперский Флот',['Член экипажа','Старшина','Офицер','Капитан'],['release','transfer','custom'],'Должность и допуск к системам задаются отдельно. Капитанский титул сам по себе не даёт корабль.'),
 service('astartes','Адептус Астартес',['Неофит','Боевой брат','Ветеран','Сержант','Лейтенант','Капитан','Магистр капитула'],['transfer','custom'],'Связь с капитулом и клятвы не являются обычным трудовым договором.'),
 service('custodes','Адептус Кустодес',['Кустодий','Капитан щита'],['custom'],'Служба требует отдельного сюжетного основания для смены обязанностей; обычной отставки нет.'),
 service('mechanicus','Адептус Механикус',['Адепт','Техножрец','Магос'],['transfer','release','custom'],'Титулы, специализация и иерархия конкретной кузницы уточняются по истории.'),
 service('sororitas','Адепта Сороритас',['Сестра','Сестра-настоятельница','Канонисса'],['transfer','custom'],'Действуют обеты и правила конкретного ордена.'),
 service('inquisition','Инквизиция / окружение',['Агент','Доверенное лицо','Инквизитор'],['release','transfer','custom'],'Инквизиторский статус не получается обычной автоматической лестницей опыта.'),
 service('rogue','Вольный торговец / окружение',['Член свиты','Специалист','Офицер','Капитан'],['contract','release','transfer','custom'],'Полномочия вольного торговца и статус члена его свиты различаются.'),
 service('tau','Империя Тау / каста',["Ла","Уи","Вре","Эль","О"],['transfer','release','custom'],'Каста и принадлежность не меняются от повышения ранга; обязанности определяются ролью.'),
 service('ork','Орочья иерархия',['Бойз','Ноб','Варбосс'],['recognition','custom'],'Положение подтверждается силой, признанием и событиями, а не кадровым приказом Империума.'),
 service('necron','Некронская династия',['Воин','Династическая должность','Лорд','Владыка'],['transfer','custom'],'Должности не служат автоматическим превращением в другой тип некрона.'),
 service('aeldari','Пути и сообщества аэльдари',['Ученик Пути','Практик Пути','Мастер / должность'],['path','recognition','custom'],'Путь и конкретная община важнее универсальной военной лестницы.'),
 service('drukhari','Кабал / культ / ковен',['Участник','Доверенное лицо','Должность в организации'],['recognition','custom'],'Положение связано с покровителем, интригами и условиями конкретной организации.'),
 service('chaos','Хаос / культ / воинская группа',['Последователь','Чемпион','Должность в группе'],['recognition','custom'],'Клятвы, зависимость и последствия разрыва определяются конкретным покровителем.'),
 service('votann','Лиги Вотанна / родичи',['Родич','Хернкин','Каль'],['recognition','transfer','custom'],'Примеры ролей, не автоматическая лестница превращения; действуют обязанности перед общиной.'),
 service('hive','Флот-улей / синаптическая структура',['Биофункция','Синаптическая роль'],['restructure','severed','custom'],'Изменение функции или утрата связи подтверждаются по сюжету; обычной отставки нет.'),
 service('independent','Независимый / договор',['Свой ранг','Договорная должность'],['contract','release','recognition','custom'],'Действуют условия договора; независимость не отменяет уже принятые обязательства.'),
];
export const EXIT_BASES={release:'Разрешённое освобождение',transfer:'Утверждённый перевод',contract:'Выполненный договор',recognition:'Признание / условия сообщества',path:'Смена Пути',restructure:'Изменение биофункции',severed:'Подтверждённая утрата связи',custom:'Особое основание по истории'};
const array=value=>Array.isArray(value)?value:[];
const text=value=>typeof value==='string'?value:'';
export function serviceFor(player){if(player.serviceProfile)return SERVICE_PROFILES.find(p=>p.id===player.serviceProfile)||SERVICE_PROFILES.at(-1);const affiliation=String(player.affiliation||'').toLocaleLowerCase();const match=[['улей','hive'],['милитарум','guard'],['флот','navy'],['астартес','astartes'],['кустодес','custodes'],['механикус','mechanicus'],['сороритас','sororitas'],['инквиз','inquisition'],['торгов','rogue'],['тау','tau'],['орк','ork'],['некрон','necron'],['аэльдари','aeldari'],['друкари','drukhari'],['хаос','chaos'],['вотанн','votann'],['улей','hive']].find(([needle])=>affiliation.includes(needle));return SERVICE_PROFILES.find(p=>p.id===match?.[1])||SERVICE_PROFILES.at(-1);}
export function normalCampaignRecord(collection,record){
 if(collection==='routes'){
  record.name=text(record.name)||'Маршрут';record.origin=text(record.origin);record.destination=text(record.destination);record.mode=TRAVEL_MODES.some(([id])=>id===record.mode)?record.mode:'custom';record.steps=Math.max(1,Math.min(100,Math.floor(Number(record.steps)||3)));
  record.risk=['safe','watch','dangerous','unknown'].includes(record.risk)?record.risk:'unknown';for(const field of ['accessGranted','transportConfirmed','conditionsConfirmed','landingRequired','landingGranted'])record[field]=record[field]===true;record.requirements=array(record.requirements).map(String);
 }
 if(collection==='journeys'){record.status=Object.hasOwn(JOURNEY_STAGES,record.status)?record.status:'planned';record.progress=Math.max(0,Math.floor(Number(record.progress)||0));record.travelerIds=array(record.travelerIds).map(String);}
 if(collection==='careerEvents'){record.type=Object.hasOwn(CAREER_TYPES,record.type)?record.type:'appointment';record.status=['pending','proposal','confirmed','rejected'].includes(record.status)?record.status:'pending';record.knownIds=array(record.knownIds).map(String);}
 if(collection==='memories'){record.ownerId=text(record.ownerId)||'player';record.text=text(record.text);record.source=text(record.source)||'manual';record.confirmed=record.confirmed===true;record.public=record.public===true;record.sharedWith=array(record.sharedWith).map(String);record.reliability=text(record.reliability)||'Сообщено';}
 return record;
}
export function visibleMemories(state,viewer='player'){return (state.memories||[]).filter(m=>m.confirmed&&(m.ownerId===viewer||m.public||m.sharedWith?.includes(viewer)));}
