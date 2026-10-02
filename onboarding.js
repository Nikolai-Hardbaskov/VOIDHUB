// Profile creation is confirmed by the user; story extraction cannot unlock it.
export function validateProfile(player,{noTraits=false}={}){
 const labels={name:'имя',species:'расу / тип существа',affiliation:'принадлежность',role:'роль',origin:'происхождение · место',background:'происхождение · среду / прошлое'};
 for(const [key,label] of Object.entries(labels)){
  const value=typeof player[key]==='string'?player[key].trim():'';
  if(!value||value==='Не указано'||key==='name'&&value==='{{user}}')throw Error(`Укажите ${label} персонажа.`);
  player[key]=value;
 }
 if(!Array.isArray(player.traits)||!player.traits.length&&!noTraits)throw Error('Добавьте особенности или отметьте «Без особых особенностей».');
 return player;
}
