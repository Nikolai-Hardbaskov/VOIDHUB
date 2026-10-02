// Original VOIDHUB balance, not official tabletop profiles. Stats and equipment remain editable.
import {REGIONS,clone,parseDice,uid} from './core.js';
const keys=['ranged','melee','strength','toughness','reaction','will'];
const stats=values=>Object.fromEntries(keys.map((k,i)=>[k,values[i]]));
const creature=(id,species,name,maxHp,values,naturalProtection=0,note='')=>({id,species,name,maxHp,stats:stats(values),naturalProtection,note});
export const CREATURE_PROFILES=[
 creature('human-civilian','человек','Гражданский',60,[25,25,30,30,35,35]),
 creature('human-soldier','человек','Обученный боец',100,[45,40,40,40,45,45]),
 creature('human-veteran','человек','Ветеран',120,[60,55,45,50,55,55]),
 creature('mutant','мутант','Мутант среднего размера',110,[35,45,45,45,40,40],0,'Мутации и размеры требуют индивидуальной настройки.'),
 creature('ogryn','огрин','Огрин',260,[35,55,85,80,30,40]),
 creature('ratling','ратлинг','Ратлинг',65,[65,25,25,30,60,40]),
 creature('daemon-lesser','демон','Малый демон',150,[35,65,60,60,55,65],0,'Варп-защита и изгнание пока описываются по сюжету; отдельного спасброска нет.'),
 creature('daemon-greater','демон','Великий демон',1200,[60,90,95,95,65,95],0,'Крупный противник; конкретный демон настраивается отдельно. Варп-защита не автоматизирована.'),
 creature('astartes','космодесантник','Астартес',220,[65,65,75,75,60,65]),
 creature('astartes-veteran','космодесантник','Ветеран Астартес',280,[75,75,80,80,65,75]),
 creature('aeldari','аэльдари','Аэльдари',85,[55,50,35,35,75,60]),
 creature('aeldari-aspect','аэльдари','Воин Аспекта',110,[70,65,40,45,85,70]),
 creature('drukhari','друкари','Друкари',85,[55,60,35,35,75,55]),
 creature('drukhari-elite','друкари','Элитный воин друкари',120,[65,80,45,45,85,65]),
 creature('ork-boy','орк','Орк-бойз',160,[30,60,65,65,40,45]),
 creature('ork-nob','орк','Орк-ноб',300,[40,75,80,80,40,60]),
 creature('ork-warboss','орк','Орк-варбосс',600,[50,85,95,90,45,80]),
 creature('necron-warrior','некрон','Некрон-воин',180,[55,45,60,65,30,60],14,'Живой металл учитывается как природная защита. Реанимация пока по сюжету.'),
 creature('necron-immortal','некрон','Некрон-бессмертный',240,[65,50,65,75,35,65],18),
 creature('necron-lord','некрон','Некрон-лорд',450,[75,80,80,85,50,85],24),
 creature('tau','тау','Воин Тау',85,[60,25,30,35,45,45],0,'Боевой костюм — отдельная экипировка, не свойство расы.'),
 creature('kroot','круут','Круут',100,[45,60,50,45,60,40]),
 creature('vespid','веспид','Веспид',100,[55,40,40,45,65,40],6,'Полёт учитывается в обстановке, не даёт скрытого бонуса к попаданию.'),
 creature('tyranid-termagant','тиранид','Термагант',65,[40,35,35,35,50,30],6),
 creature('tyranid-hormagaunt','тиранид','Хормагаунт',80,[20,55,40,40,70,30],6),
 creature('tyranid-warrior','тиранид','Тиранид-воин',280,[55,70,75,75,55,60],18),
 creature('tyranid-carnifex','тиранид','Карнифекс',900,[40,75,95,95,30,65],35,'Крупное существо; нужны тяжёлое вооружение и подходящая анатомия.'),
 creature('tyranid-tyrant','тиранид','Тиран улья',1100,[75,90,95,95,65,90],35),
 creature('genestealer','генокрад','Чистокровный генокрад',160,[20,80,60,50,85,55],8),
 creature('genestealer-hybrid','генокрад','Гибрид',90,[45,45,40,40,50,45]),
 creature('primarch','примарх','Примарх — основа для настройки',1500,[95,95,100,100,90,100],0,'Сюжетная фигура. Уникальные силы и снаряжение задаются отдельно; HP не моделируют все возможности.'),
 creature('custodian','кустодий','Кустодий',450,[85,90,90,90,80,90]),
 creature('felinid','фелинид','Фелинид',85,[40,40,35,35,60,40]),
 creature('votann','вотанн','Воин родичей',120,[55,45,45,55,35,55]),
 creature('jokaero','джокаэро','Джокаэро',80,[45,30,35,40,45,50],0,'Устройства и их возможности выбираются по конкретному персонажу.'),
];
const gun=(id,name,damage,penetration,ammo,type,description='',cost=1)=>({id,name,mode:'ranged',damage,penetration,ammo,cost,type,description});
const blade=(id,name,damage,penetration,type='режущий',description='')=>({id,name,mode:'melee',damage,penetration,ammo:null,cost:1,type,description});
export const WEAPON_TEMPLATES=[
 gun('autopistol','Автопистолет','1d10+14',2,18,'кинетический'),
 gun('autogun','Автоматическая винтовка','2d10+16',4,30,'кинетический'),
 gun('laspistol','Лазпистолет','1d10+18',3,30,'лазерный'),
 gun('lasgun','Лазган','2d10+20',5,60,'лазерный'),
 gun('hotshot','Хот-шот лазган','2d10+28',16,30,'лазерный'),
 gun('bolt-pistol','Болт-пистолет','2d10+25',10,10,'взрывной'),
 gun('bolter','Болтер','2d10+30',12,30,'взрывной','Версия под владельца; человеческий и астартесский образцы различаются по истории.'),
 gun('heavy-bolter','Тяжёлый болтер','3d10+40',18,60,'взрывной','Одна атака — короткая очередь; 3 единицы боезапаса. Отдельных многократных попаданий пока нет.',3),
 gun('plasma','Плазменное ружьё','3d10+45',30,12,'плазменный','Обычный режим. Перегрев и усиленный выстрел пока не рассчитываются.'),
 gun('melta','Мельтаган','4d10+65',50,6,'энергетический','Базовый профиль для близкой дистанции. На неподходящей дальности действие должно быть отклонено по сюжету.'),
 gun('lascannon','Лазпушка','5d10+90',65,10,'лазерный','Тяжёлое оружие; нужны установка или подходящий носитель.'),
 gun('pulse-rifle','Импульсная винтовка Тау','2d10+28',10,36,'энергетический'),
 gun('rail-rifle','Рельсовая винтовка Тау','3d10+55',40,8,'кинетический','Пехотное оружие; не корабельный и не танковый рейлган.'),
 gun('shuriken','Сюрикенная катапульта','2d10+24',14,40,'режущий'),
 gun('splinter','Осколочная винтовка друкари','2d10+20',8,30,'кинетический','Профиль отражает прямую травму. Яд пока по сюжету; по небиологическим целям не начисляется отравление.'),
 gun('slugga','Слагга','2d10+20',4,12,'кинетический'),
 gun('shoota','Шута','2d10+25',6,30,'кинетический'),
 gun('gauss-flayer','Гаусс-свежеватель','2d10+30',20,40,'энергетический','Условный счётчик заряда; изменяется или отключается вручную.'),
 gun('gauss-blaster','Гаусс-бластер','3d10+35',25,30,'энергетический'),
 gun('ion-blaster','Ионный бластер родичей','2d10+30',16,24,'энергетический'),
 gun('kroot-rifle','Винтовка круутов','2d10+18',4,20,'кинетический','Для ближнего боя выбирается отдельный профиль штыка.'),
 gun('neutron-blaster','Нейтронный бластер веспидов','2d10+30',20,20,'энергетический'),
 gun('fleshborer','Пожиратель плоти','2d10+18',5,20,'кинетический','Боезапас — условные биозаряды; восстановление только по истории.'),
 blade('knife','Боевой нож','1d10+8',2),
 blade('bayonet','Штык / клинки винтовки круутов','1d10+10',3),
 blade('chainsword','Цепной меч','2d10+15',8),
 blade('power-sword','Силовой меч','2d10+30',30),
 blade('power-fist','Силовой кулак','3d10+45',40,'ударный','Бонус силы добавляется обычным правилом; отдельных дополнительных множителей нет.'),
 blade('choppa','Чоппа','2d10+18',6),
 blade('power-klaw','Силовая клешня','3d10+45',40,'режущий'),
 blade('rending-claws','Раздирающие когти','2d10+25',20),
 blade('monstrous-talons','Когти крупного тиранида','4d10+50',35),
 blade('guardian-spear-melee','Копьё стража · клинок','3d10+40',35),
 gun('guardian-spear-gun','Копьё стража · болтер','2d10+30',12,20,'взрывной'),
 blade('warscythe','Боевая коса некронов','3d10+40',40),
];
const armor=(id,name,protection,coverage='all',description='')=>({id,name,protection,coverage,regions:coverage==='torso'?['chest','abdomen']:coverage==='helmet'?['head']:Object.keys(REGIONS),description});
export const ARMOR_TEMPLATES=[
 armor('clothes','Одежда / без брони',0),
 armor('light-vest','Лёгкий защитный жилет',6,'torso'),
 armor('flak','Флак-броня · полный комплект',10),
 armor('carapace','Панцирная броня · полный комплект',18),
 armor('helmet','Панцирный шлем',18,'helmet'),
 armor('human-power','Силовая броня человеческого размера',28),
 armor('astartes-power','Силовая броня Астартес',32),
 armor('terminator','Терминаторская броня',48),
 armor('auramite','Аурамитовая броня кустодия',50),
 armor('aeldari-mesh','Сетчатая броня аэльдари',10),
 armor('aspect','Броня Воина Аспекта',18),
 armor('drukhari','Броня кабалита',10),
 armor('tau-combat','Броня воина огня',16),
 armor('tau-crisis','Боевой костюм «Кризис»',40,'all','Только если костюм есть в истории и доступен владельцу. Системы костюма и отдельный запас прочности ещё не реализованы.'),
 armor('ork-scrap','Самодельная броня орков',10),
 armor('ork-heavy','Тяжёлая броня орков',22),
 armor('mega-armour','Мегаброня',44),
 armor('votann','Вакуумная броня родичей',20),
];
export function profilesFor(species){return CREATURE_PROFILES.filter(p=>p.species===species);}
export function applyCreatureProfile(current,profileId){
 const p=CREATURE_PROFILES.find(p=>p.id===profileId);if(!p)throw Error('Выберите боевой профиль');
 if(current.species!==p.species)throw Error('Боевой профиль не соответствует выбранной расе');
 if(!Number.isFinite(current.hp)||!Number.isFinite(current.maxHp)||current.maxHp<1||current.hp<0)throw Error('Укажите корректное текущее и максимальное здоровье');
 const missing=Math.max(0,current.maxHp-current.hp);
 const hp=current.hp===0?0:Math.max(0,p.maxHp-missing);
 return {...clone(current),balanceProfile:p.id,maxHp:p.maxHp,hp,status:hp===0?'Выведен из боя':current.status,stats:clone(p.stats),naturalArmor:Object.fromEntries(Object.keys(current.anatomy).map(k=>[k,p.naturalProtection]))};
}
export function weaponFromTemplate(templateId,id=uid()){
 const template=WEAPON_TEMPLATES.find(t=>t.id===templateId);if(!template)throw Error('Выберите образец оружия');
 return {...clone(template),id,templateId};
}
export function armorFromTemplate(templateId,anatomy=REGIONS,id=uid()){
 const template=ARMOR_TEMPLATES.find(t=>t.id===templateId);if(!template)throw Error('Выберите образец брони');
 return {...clone(template),id,templateId,regions:template.coverage==='all'?Object.keys(anatomy):template.regions.filter(k=>Object.hasOwn(anatomy,k))};
}
// Default only NEW story records. Existing HP, ammo, wounds and customized values are preserved.
export function storyDefaults(collection,record){
 if(collection==='squad'||collection==='enemies'){
  const p=CREATURE_PROFILES.find(p=>p.id===record.balanceProfile)||profilesFor(record.species).find(p=>p.id==='human-soldier')||profilesFor(record.species)[0];
  if(p&&p.species===record.species){const anatomy=record.anatomy||REGIONS;return {maxHp:p.maxHp,hp:record.maxHp??p.maxHp,naturalArmor:Object.fromEntries(Object.keys(anatomy).map(k=>[k,p.naturalProtection])),balanceProfile:p.id,...record,stats:{...p.stats,...record.stats}};}
 }
 if(collection==='weapons'){
  const t=WEAPON_TEMPLATES.find(t=>t.id===record.templateId)||WEAPON_TEMPLATES.find(t=>t.name.toLocaleLowerCase()===String(record.name||'').toLocaleLowerCase());
  if(t)return {...weaponFromTemplate(t.id,record.id),...record};
 }
 if(collection==='armor'){
  const t=ARMOR_TEMPLATES.find(t=>t.id===record.templateId)||ARMOR_TEMPLATES.find(t=>t.name.toLocaleLowerCase()===String(record.name||'').toLocaleLowerCase());
  if(t)return {...armorFromTemplate(t.id,REGIONS,record.id),...record};
 }
 return record;
}
export function balanceGuide(){return JSON.stringify({rules:'Собственные параметры VOIDHUB, не официальные правила. Новым участникам выбери balanceProfile; новым оружию/броне — templateId из списка. Пресеты заполняются кодом. Только явно установленное снаряжение; не выдавай оружие или броню по расе. Не меняй существующие цифры без события. Не удваивай живой металл/хитин: это naturalArmor; armor — надетая броня. Щиты, реанимация, яд и особые способности пока по сюжету.',creatures:CREATURE_PROFILES.map(p=>[p.id,p.species,p.name,p.maxHp,p.naturalProtection]),weapons:WEAPON_TEMPLATES.map(w=>[w.id,w.name,w.damage,w.penetration,w.mode]),armor:ARMOR_TEMPLATES.map(a=>[a.id,a.name,a.protection,a.coverage])});}
export function damageRange(weapon,strength=0){const d=parseDice(weapon.damage),bonus=weapon.mode==='melee'?Math.floor(strength/10):0;return {min:Math.max(0,d.count+d.bonus+bonus),max:Math.max(0,d.count*d.sides+d.bonus+bonus),mean:Math.max(0,d.count*(d.sides+1)/2+d.bonus+bonus)};}
export function expectedDamage(weapon,protection,strength=0){
 const dice=parseDice(weapon.damage),bonus=dice.bonus+(weapon.mode==='melee'?Math.floor(strength/10):0),effective=Math.max(0,protection-weapon.penetration);
 // Exact expectation conditional on a hit, including zero-damage rolls; small catalog dice only.
 let distribution=new Map([[0,1]]);
 for(let i=0;i<dice.count;i++){const next=new Map();for(const [total,chance] of distribution)for(let d=1;d<=dice.sides;d++)next.set(total+d,(next.get(total+d)||0)+chance/dice.sides);distribution=next;}
 return [...distribution].reduce((sum,[raw,chance])=>sum+Math.max(0,raw+bonus-effective)*chance,0);
}
