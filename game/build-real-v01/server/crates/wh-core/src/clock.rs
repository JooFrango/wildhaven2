//! Relógio global do mundo: um único calendário compartilhado por todas as contas.
//! Decisão do diretor: dia de 2 h + noite de 40 min reais = ciclo de 2 h 40 min.
//! O relógio é derivado do tempo de parede e de uma época fixa (persistida), nunca
//! do tempo de simulação de uma conta; contas offline não congelam o céu.

use serde::Serialize;

pub const DAY_SECONDS: u64 = 2 * 60 * 60; // 7.200 s
pub const NIGHT_SECONDS: u64 = 40 * 60; // 2.400 s
pub const CYCLE_SECONDS: u64 = DAY_SECONDS + NIGHT_SECONDS; // 9.600 s

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Phase {
    Day,
    Night,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct ClockState {
    /// Época do mundo (ms desde Unix epoch); fixa por mundo.
    pub epoch_ms: u64,
    pub now_ms: u64,
    /// Índice do ciclo dia+noite desde a época (0-based).
    pub cycle: u64,
    pub phase: Phase,
    /// Segundos decorridos dentro da fase atual.
    pub phase_elapsed_s: f64,
    /// Segundos até a próxima troca de fase.
    pub phase_remaining_s: f64,
    /// Fração [0,1) do ciclo completo (0 = amanhecer).
    pub cycle_fraction: f64,
}

#[derive(Debug, Clone, Copy)]
pub struct WorldClock {
    pub epoch_ms: u64,
}

impl WorldClock {
    pub fn new(epoch_ms: u64) -> Self {
        Self { epoch_ms }
    }

    pub fn state(&self, now_ms: u64) -> ClockState {
        // Antes da época, o mundo está no início do primeiro dia.
        let elapsed_ms = now_ms.saturating_sub(self.epoch_ms);
        let cycle_ms = CYCLE_SECONDS * 1000;
        let cycle = elapsed_ms / cycle_ms;
        let in_cycle_ms = elapsed_ms % cycle_ms;
        let day_ms = DAY_SECONDS * 1000;
        let (phase, phase_elapsed_ms, phase_len_ms) = if in_cycle_ms < day_ms {
            (Phase::Day, in_cycle_ms, day_ms)
        } else {
            (Phase::Night, in_cycle_ms - day_ms, NIGHT_SECONDS * 1000)
        };
        ClockState {
            epoch_ms: self.epoch_ms,
            now_ms,
            cycle,
            phase,
            phase_elapsed_s: phase_elapsed_ms as f64 / 1000.0,
            phase_remaining_s: (phase_len_ms - phase_elapsed_ms) as f64 / 1000.0,
            cycle_fraction: in_cycle_ms as f64 / cycle_ms as f64,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cycle_is_two_hours_forty_minutes() {
        assert_eq!(CYCLE_SECONDS, 9_600);
        assert_eq!(DAY_SECONDS, 7_200);
        assert_eq!(NIGHT_SECONDS, 2_400);
    }

    #[test]
    fn phases_and_boundaries() {
        let c = WorldClock::new(1_000_000);
        let s = c.state(1_000_000);
        assert_eq!((s.cycle, s.phase), (0, Phase::Day));
        assert_eq!(s.phase_remaining_s, 7_200.0);
        // último milissegundo do dia
        let s = c.state(1_000_000 + 7_200_000 - 1);
        assert_eq!(s.phase, Phase::Day);
        // início da noite
        let s = c.state(1_000_000 + 7_200_000);
        assert_eq!(s.phase, Phase::Night);
        assert_eq!(s.phase_remaining_s, 2_400.0);
        // próximo ciclo
        let s = c.state(1_000_000 + 9_600_000);
        assert_eq!((s.cycle, s.phase), (1, Phase::Day));
        assert_eq!(s.cycle_fraction, 0.0);
    }

    #[test]
    fn before_epoch_clamps_to_dawn() {
        let c = WorldClock::new(5_000);
        let s = c.state(0);
        assert_eq!((s.cycle, s.phase, s.phase_elapsed_s), (0, Phase::Day, 0.0));
    }

    #[test]
    fn same_instant_same_sky_for_all_accounts() {
        // O relógio não depende de estado de conta: dois mundos com a mesma época
        // e o mesmo instante concordam bit a bit.
        let a = WorldClock::new(42).state(123_456_789);
        let b = WorldClock::new(42).state(123_456_789);
        assert_eq!(a, b);
    }
}
