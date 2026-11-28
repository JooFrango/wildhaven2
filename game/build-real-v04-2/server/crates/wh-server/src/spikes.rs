use serde::Serialize;
use std::collections::VecDeque;


#[derive(Clone, Copy, Default, Serialize)]
pub struct Tick {
    pub epoch_ms:u64, pub tick:u64, pub elapsed_ms:f64, pub thread_cpu_ms:Option<f64>,
    pub steps:u64, pub persist_ms:f64, pub view_ms:f64, pub late_ms:f64, pub window_ms:f64, pub game_ms:f64, pub spawn_ms:f64,
    pub grid_ms:f64, pub creature_ms:f64, pub sync_reads:u64, pub hits:u64,
    pub misses:u64, pub io_pending:usize, pub resident_bytes:usize, pub frozen:usize,
    pub creatures:usize, pub hunters:usize, pub spawn_queue:usize, pub event_seq:u64,
}

#[derive(Clone, Default, Serialize)]
pub struct Incident { pub threshold_ms:u32, pub trigger:u64, pub context:Vec<Tick> }

#[derive(Default)]
pub struct Recorder {
    history:VecDeque<Tick>,
    pub incidents: [Incident;5],
}

impl Recorder {
    pub fn observe(&mut self,t:Tick) {
        let thresholds=[20,50,100,200,500];
        let slots=&mut self.incidents;
        for (slot,threshold) in slots.iter_mut().zip(thresholds) {
            if t.elapsed_ms >= threshold as f64 && (slot.context.is_empty() ||
                t.elapsed_ms > slot.context.iter().find(|v|v.tick==slot.trigger).map_or(0.0,|v|v.elapsed_ms)) {
                slot.threshold_ms=threshold;slot.trigger=t.tick;slot.context.clear();
                slot.context.extend(self.history.iter().copied());slot.context.push(t);
            } else if !slot.context.is_empty() && t.tick<=slot.trigger+6 {slot.context.push(t);}
        }
        if self.history.len()==8 {self.history.pop_front();}
        self.history.push_back(t);
    }
}

#[cfg(windows)]
pub fn cpu_ms()->Option<f64>{
    #[link(name="kernel32")] extern "system" {
        fn GetCurrentThread()->isize;
        fn GetThreadTimes(h:isize,c:*mut u64,e:*mut u64,k:*mut u64,u:*mut u64)->i32;
    }
    let (mut c,mut e,mut k,mut u)=(0,0,0,0);
    unsafe { (GetThreadTimes(GetCurrentThread(),&mut c,&mut e,&mut k,&mut u)!=0).then_some((k+u) as f64/10000.0) }
}
#[cfg(not(windows))]
pub fn cpu_ms()->Option<f64>{None}

#[cfg(test)]
mod tests{
    use super::*;
    #[test]
    fn retains_worst_with_bounded_context(){
        let mut r=Recorder::default();
        for tick in 1..1000 {
            let elapsed_ms=if tick==25 {684.0} else if tick%31==0 {105.0} else {1.0};
            r.observe(Tick{tick,elapsed_ms,..Tick::default()});
        }
        for s in r.incidents{assert_eq!(s.trigger,25);assert_eq!(s.context.len(),15);}
    }
}
