if(new URLSearchParams(location.search).get('regiao')==='serra-oriental'){
  import('./eastern-range').then(m=>m.enterRange()).catch((e:unknown)=>{
    const hud=document.querySelector('#hud');
    if(hud)hud.textContent='Falha ao abrir Serra Oriental: '+String(e);
  });
}else{
  void import('./main');
}
