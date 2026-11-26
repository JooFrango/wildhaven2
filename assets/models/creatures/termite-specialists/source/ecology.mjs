/**
 * Wildhaven termite colony model — pure asset-side simulation reference.
 * NOT wired to the playable engine. A colony is terminally extinct at zero.
 */
export const DEFAULTS={
  capacity:20000,
  initialPopulationMin:12000,
  initialPopulationMax:20000,
  dailyRegenerationRate:.09,
  decayDaysDry:110,
  decayDaysWet:36
};
export const FEEDING={
  ferrunco:{intakePerVisit:340,surfaceDamage:.15},
  dunlingua:{intakePerVisit:210,surfaceDamage:.08},
  pica_termita:{intakePerVisit:60,surfaceDamage:.01}
};
export function colony(population=16000,capacity=20000){
  const initial=Math.max(0,Math.min(capacity,Math.round(population)));
  return {population:initial,capacity,extinct:initial===0,
    integrity:1,decay:initial===0?0:null,
    state:initial>0?"active":"abandoned"};
}
export function feed(c,consumer){
  const next={...c};
  if(next.extinct||next.population<=0)return {colony:next,consumed:0};
  const cfg=FEEDING[consumer];
  if(!cfg)throw Error("Unknown termite specialist "+consumer);
  const consumed=Math.min(cfg.intakePerVisit,next.population);
  next.population-=consumed;
  next.integrity=Math.max(.05,next.integrity-cfg.surfaceDamage);
  if(next.population===0){
    next.extinct=true;next.state="abandoned";next.decay=0;
  }else{
    next.state="feeding";
  }
  return {colony:next,consumed};
}
export function advance(c,days=1,climate="dry"){
  if(!Number.isFinite(days)||days<0)throw Error("invalid days");
  const next={...c};
  if(next.extinct||next.population<=0){
    // Extinction irreversible. No regeneration, even at a positive growth rate.
    next.population=0;
    next.extinct=true;
    next.decay=(next.decay??0)+days;
    next.integrity=Math.max(0,next.integrity-days/(climate==="wet"?DEFAULTS.decayDaysWet:DEFAULTS.decayDaysDry));
    next.state=next.integrity===0?"disappearing":
      next.integrity<.35?"crumbling":"abandoned";
    return next;
  }
  const K=next.capacity,P=next.population;
  next.population=Math.min(K,Math.round(K/(1+(K/P-1)*Math.exp(-DEFAULTS.dailyRegenerationRate*days))));
  next.integrity=Math.min(1,next.integrity+.025*days);
  next.state=next.integrity<.65?"damaged":"active";
  return next;
}
export function animationFromColony(c){
  if(c.extinct){
    if(c.integrity<=0)return "disappearing";
    if(c.integrity<.35)return "crumbling";
    return "abandoned";
  }
  if(c.integrity<.65)return "damaged";
  return "active";
}
