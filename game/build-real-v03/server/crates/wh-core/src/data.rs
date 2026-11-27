//! Leitura de `data/gameplay-provisorio-v02.json` (aceita também a v01). Todos os números de gameplay vêm
//! desse arquivo (nada fixo no código), para o diretor ajustar sem recompilar.

use serde::Deserialize;
use std::collections::BTreeMap;

#[derive(Debug, Clone, Deserialize)]
pub struct Item {
    pub id: String,
    pub nome: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Species {
    pub nome: String,
    pub papel: String,
    pub hp: f64,
    pub dano: f64,
    pub massa_kg: f64,
    pub andar_mps: f64,
    pub correr_mps: f64,
    pub correr_max_s: f64,
    pub visao_movimento_m: f64,
    pub visao_parado_m: f64,
    pub audicao_m: f64,
    #[serde(default = "d_alcance")]
    pub alcance_ataque_m: f64,
    #[serde(default = "d_recarga")]
    pub recarga_ataque_s: f64,
    pub grupo: (u32, u32),
    pub grupos_por_hex: u32,
    pub raio_forrageio_m: f64,
    #[serde(default)]
    pub ponto_cego_traseiro_graus: f64,
    pub itens: Vec<Item>,
    pub biomas: Vec<String>,
}
fn d_alcance() -> f64 {
    1.5
}
fn d_recarga() -> f64 {
    1.6
}

#[derive(Debug, Clone, Deserialize)]
pub struct HunterDef {
    pub id: String,
    pub nome: String,
    pub forca: f64,
    pub arma: String,
    pub habilidades: BTreeMap<String, u32>,
    #[serde(default, rename = "armaduraHp")]
    pub armadura_hp: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Hunters {
    pub visao_m: f64,
    pub lista: Vec<HunterDef>,
    pub socorristas: Vec<HunterDef>,
    pub hp_base: f64,
    pub xp_por_nivel: f64,
    pub nivel_max: u32,
    pub velocidade_bonus_por_nivel: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Arma {
    pub ataque: f64,
    #[serde(rename = "bonusPorNivel")]
    pub bonus_por_nivel: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesvioNivel {
    pub duracao_s: f64,
    #[serde(default)]
    pub espera_antes_de_atacar_s: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Desvio {
    pub chance_por_nivel: f64,
    pub nivel1: DesvioNivel,
    pub nivel5: DesvioNivel,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Combate {
    pub armas: BTreeMap<String, Arma>,
    pub caido_ate_morrer_s: f64,
    pub desvio: Desvio,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Furtividade {
    pub velocidade_agachado_fator: f64,
    pub reducao_deteccao_por_nivel: f64,
    pub distancia_ataque_rodeio_m: f64,
    pub chance_deteccao_por_segundo: f64,
    pub rodeio_distancia_m: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrapType {
    pub id: String,
    pub imobiliza_s: (f64, f64),
    pub massa_max_kg: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Armadilhas {
    pub tipos: Vec<TrapType>,
    pub raio_disparo_m: f64,
    pub grito_alcance_m: f64,
    pub chance_evitar_base: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Rastros {
    pub passo_m: f64,
    pub max_por_criatura: usize,
    pub vida_s: f64,
    pub raio_descoberta_m: f64,
    pub chance_base: f64,
    pub chance_por_nivel: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Resgate {
    pub fracao_caidos: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Economia {
    pub dinheiro_inicial: f64,
    pub carroca: Custo,
}
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Custo {
    pub base: f64,
    pub por_km: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct WagonDef {
    pub id: String,
    pub condutor: String,
}
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Carrocas {
    pub capacidade: usize,
    pub lista: Vec<WagonDef>,
    pub velocidade_mps: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Acampamento {
    pub raio_clareira_m: f64,
    pub inclinacao_max_graus: f64,
    pub cura_descanso_hp_s: f64,
    pub cura_campo_hp_s: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Spawn {
    pub excluir: Vec<String>,
    pub raio_simulacao_detalhada_m: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Conhecimento {
    pub avistamentos_para_estudado: u32,
    pub abates_para_dominado: u32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpedicaoCfg {
    pub max_horas_sem_abate: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GameData {
    pub schema: String,
    pub economia: Economia,
    pub carrocas: Carrocas,
    pub acampamento: Acampamento,
    pub hunters: Hunters,
    pub combate: Combate,
    pub furtividade: Furtividade,
    pub armadilhas: Armadilhas,
    pub rastros: Rastros,
    pub resgate: Resgate,
    pub especies: BTreeMap<String, Species>,
    pub spawn: Spawn,
    pub conhecimento: Conhecimento,
    pub expedicao: ExpedicaoCfg,
    /// V02 (opcionais: arquivos v01 continuam válidos)
    #[serde(default)]
    pub necessidades: Necessidades,
    #[serde(default)]
    pub relevancia: Relevancia,
    #[serde(default)]
    pub clima: ClimaCfgData,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Necessidades {
    pub fome_cheia_s: f64,
    pub sede_cheia_s: f64,
    pub energia_duracao_s: f64,
    pub recuperacao_energia_s: f64,
    pub limiar_fome: f64,
    pub limiar_sede: f64,
    pub limiar_cansaco: f64,
    pub busca_agua_raio_m: f64,
    pub carcaca_duracao_s: f64,
    pub presas_descansam_a_noite: bool,
    pub territorio_fator: f64,
}
impl Default for Necessidades {
    fn default() -> Self {
        Self { fome_cheia_s: 2400.0, sede_cheia_s: 1500.0, energia_duracao_s: 3600.0, recuperacao_energia_s: 700.0, limiar_fome: 0.6, limiar_sede: 0.65, limiar_cansaco: 0.25, busca_agua_raio_m: 260.0, carcaca_duracao_s: 1500.0, presas_descansam_a_noite: true, territorio_fator: 2.0 }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Relevancia {
    pub perto_m: f64,
    pub medio_m: f64,
    pub longe_m: f64,
    pub passo_medio: u64,
    pub passo_longe: u64,
    pub orcamento_astar_por_tick: u32,
    /// V03 (parâmetro de engenharia, PROVISÓRIO): grupos de criaturas gerados por tick para hexes novos
    /// (determinístico; a geração da V02 acontecia inteira num único tick).
    #[serde(default = "spawn_grupos")]
    pub orcamento_spawn_grupos: u32,
}
fn spawn_grupos() -> u32 { 4 }
impl Default for Relevancia {
    fn default() -> Self { Self { perto_m: 450.0, medio_m: 1500.0, longe_m: 4500.0, passo_medio: 3, passo_longe: 15, orcamento_astar_por_tick: 14, orcamento_spawn_grupos: spawn_grupos() } }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClimaFator {
    pub visao: f64,
    pub audicao: f64,
    pub olfato: f64,
    pub locomocao: f64,
    #[serde(default)]
    pub delta_temperatura_c: f64,
    #[serde(default)]
    pub apaga_rastros: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ClimaCfgData {
    pub fatores: BTreeMap<String, ClimaFator>,
    pub noite_visao: f64,
    pub ciclo_lunar_ciclos: f64,
    pub frente_intervalo_s: f64,
    pub frente_vida_s: (f64, f64),
    pub megatempestade_chance: f64,
    pub atualizacao_s: f64,
}
impl Default for ClimaCfgData {
    fn default() -> Self { Self { fatores: BTreeMap::new(), noite_visao: 0.5, ciclo_lunar_ciclos: 8.0, frente_intervalo_s: 900.0, frente_vida_s: (1800.0, 5400.0), megatempestade_chance: 0.06, atualizacao_s: 10.0 } }
}
impl ClimaCfgData {
    pub fn view(&self) -> crate::climate::ClimateCfg<'_> {
        crate::climate::ClimateCfg { fatores: &self.fatores, noite_visao: self.noite_visao, frente_intervalo_s: self.frente_intervalo_s, frente_vida_s: self.frente_vida_s, mega_chance: self.megatempestade_chance, atualizacao_s: self.atualizacao_s }
    }
}

impl GameData {
    pub fn from_slice(b: &[u8]) -> Result<Self, String> {
        let d: GameData = serde_json::from_slice(b).map_err(|e| format!("gameplay-provisorio: {e}"))?;
        if d.schema != "wildhaven.gameplay.provisorio.v1" {
            return Err("schema de gameplay inesperado".into());
        }
        Ok(d)
    }
}
