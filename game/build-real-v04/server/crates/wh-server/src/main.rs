//! wh-server — servidor autoritativo do Wildhaven Build Real V04.
//!
//! Executa a simulação em passo fixo (0,2 s) numa THREAD DEDICADA que é a única dona do mundo
//! (sem mutex disputado por HTTP/WebSocket). Ordens chegam por fila limitada; cada intervalo publica um
//! snapshot IMUTÁVEL compartilhado (`watch`), e cada conexão WebSocket recebe o snapshot completo ao conectar
//! e depois só diferenças (módulo `wh_core::wire`), na frequência do modo de apresentação do cliente
//! (3D, Econômico ou Segundo Plano). Atrasos viram dívida de passos com teto e orçamento por intervalo
//! (sem rajadas ilimitadas); passos descartados por excesso de atraso são contados e expostos, nunca ocultos.
//! O cliente nunca move o Hunter: não existe rota de controle direto.

mod config;
mod pacotes;
mod persist;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, State};
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::Json;
use axum::Router;
use std::collections::HashSet;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tower_http::services::{ServeDir, ServeFile};
use wh_core::clock::WorldClock;
use wh_core::hex::{Continent, Manifest};
use wh_core::data::GameData;
use wh_core::game::{GameState, Order};
use wh_core::wire;
use tokio::sync::{oneshot, watch};
use wh_core::portals::{PortalIndex, PortalReport};
use wh_core::sim::World;
use wh_core::terrain::TerrainStore;

pub fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

/// Snapshot publicado (imutável, compartilhado entre todas as conexões).
struct Published {
    seq: u64,
    value: serde_json::Value,
    json: OnceLock<String>,
    /// Maior `seq` de evento importante (morte, ferimento, abate, Bestiário, resgate) já publicado.
    important_seq: u64,
}
impl Published {
    fn json(&self) -> &str {
        self.json.get_or_init(|| serde_json::to_string(&self.value).unwrap_or_default())
    }
}

enum Cmd {
    Rota { hunter: String, tile: String, reply: oneshot::Sender<Result<serde_json::Value, String>> },
    Order(Order, oneshot::Sender<Result<String, String>>),
    Clima { tipo: String, x: f64, z: f64, dur: f64, reply: oneshot::Sender<String> },
}

/// Tráfego WebSocket (todas as conexões) para o painel F3.
#[derive(Default)]
struct Traffic {
    bytes: AtomicU64,
    msgs: AtomicU64,
    clients: AtomicU32,
    fulls: AtomicU64,
    resyncs: AtomicU64,
}

#[derive(Clone)]
struct AppState {
    pacotes: Arc<pacotes::Pacotes>,
    cmd: std::sync::mpsc::SyncSender<Cmd>,
    /// Velocidade da simulação (passos por intervalo de 200 ms): 1, 5, 10 ou 50. O relógio dia/noite é universal.
    scale: Arc<AtomicU32>,
    latest: watch::Receiver<Arc<Published>>,
    traffic: Arc<Traffic>,
    continent_json: Arc<String>,
    cfg: Arc<config::Config>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cfg = Arc::new(config::Config::from_env()?);
    eprintln!("[wh-server] repo={} physics={}", cfg.repo_root.display(), cfg.physics_dir.display());

    let manifest: Manifest = serde_json::from_slice(&std::fs::read(&cfg.manifest)?)?;
    let report_bytes = std::fs::read(&cfg.portal_report)
        .map_err(|e| format!("relatório de portais ausente ({}): {e}. Rode o pipeline continental (README).", cfg.portal_report.display()))?;
    let report: PortalReport = serde_json::from_slice(&report_bytes)?;
    let report_value: serde_json::Value = serde_json::from_slice(&report_bytes)?;
    let portals = PortalIndex::from_report(report)?;
    let continent = Arc::new(Continent::from_manifest(manifest)?);

    // Tiles liberados ao runtime: somente certificados, salvo modo revisão explícito.
    let mut allowed: HashSet<String> = portals.certified.clone();
    if cfg.allow_uncertified {
        eprintln!("[wh-server] ATENÇÃO: WH_ALLOW_UNCERTIFIED=1 — pacotes não certificados liberados (modo revisão)");
        for t in report_value["tiles"].as_array().into_iter().flatten() {
            if t["compiled"].as_bool() == Some(true) {
                allowed.insert(t["id"].as_str().unwrap_or_default().to_string());
            }
        }
    }
    // Modo leve (--around): só entra no runtime o hex cujo pacote existe no disco.
    let before = allowed.len();
    let certificados_todos = allowed.clone();
    allowed.retain(|t| cfg.physics_dir.join(format!("{t}-physics-v01")).join("index.json").is_file());
    eprintln!("[wh-server] {} tiles liberados ao runtime ({} certificados sem pacote local ignorados)", allowed.len(), before - allowed.len());

    let speeds: serde_json::Value = serde_json::from_slice(&std::fs::read(&cfg.clip_speeds)?)?;
    let walk = speeds["clips"]
        .as_array()
        .and_then(|a| a.iter().find(|c| c["name"] == "Walking"))
        .and_then(|c| c["speedMetersPerSecond"].as_f64())
        .ok_or("clip Walking sem velocidade extraída")?;
    eprintln!("[wh-server] velocidade de caminhada (extraída do clipe): {walk} m/s");

    let spawn: serde_json::Value = serde_json::from_slice(&std::fs::read(&cfg.spawn)?)?;
    let seed = spawn["seed"].as_u64().unwrap_or(1) as u32;
    let s0 = &spawn["hunters"][0];
    let village_tile = s0["tile"].as_str().ok_or("spawn sem tile")?.to_string();
    if !allowed.contains(&village_tile) {
        return Err(format!("vila em tile não liberado: {village_tile}").into());
    }
    let village = (s0["x"].as_f64().ok_or("x")?, s0["z"].as_f64().ok_or("z")?);
    let data = GameData::from_slice(&std::fs::read(&cfg.gameplay)?)?;
    eprintln!("[wh-server] gameplay: {} (PROVISÓRIO)", cfg.gameplay.display());

    // V04: distribuição modular — hexes certificados sem pacote local entram nas ROTAS e são baixados sob demanda
    let presentes: HashSet<String> = allowed.clone();
    let ausentes: HashSet<String> = certificados_todos.difference(&allowed).cloned().collect();
    let url_pacotes = std::env::var("WH_PACOTES_URL").unwrap_or_else(|_| "https://github.com/JooFrango/wildhaven2/releases/download/build-real-v04-hexes/".into());
    let pacotes = Arc::new(pacotes::Pacotes::iniciar(url_pacotes, cfg.physics_dir.clone(), cfg.visual_dir.clone(), presentes));
    eprintln!("[wh-server] {} hexes presentes no cache local; {} certificados disponíveis para baixar sob demanda", allowed.len(), ausentes.len());
    if std::env::var("WH_BAIXAR_TUDO").ok().as_deref() == Some("1") {
        // pacote completo offline: baixa (e confere) todos os hexes certificados ausentes, em segundo plano
        let mut v: Vec<&String> = ausentes.iter().collect();
        v.sort();
        for t in v { pacotes.pedir(t, false); }
        eprintln!("[wh-server] WH_BAIXAR_TUDO=1: {} hexes na fila de download", ausentes.len());
    }
    let mut terrain = TerrainStore::new(continent.clone(), cfg.physics_dir.clone(), allowed, cfg.cache_bytes);
    terrain.set_routable_extra(ausentes);
    terrain.enable_prefetch(); // V03: E/S e descompressão dos chunks físicos fora do tick
    let mut game = GameState::new(&data, village, &village_tile, walk, seed, &mut terrain);

    game.spawn_time_budget_ms = Some(std::env::var("WH_SPAWN_MS").ok().and_then(|v| v.parse().ok()).unwrap_or(3.0));
    let mut epoch = cfg.clock_epoch_ms.unwrap_or_else(now_ms);
    let db = match &cfg.database_url {
        Some(url) => {
            let db = persist::Db::connect(url, &cfg.migrations_dir).await?;
            let (stored_epoch, _) = db.load_or_create_world(&cfg.world_id, epoch, seed).await?;
            epoch = stored_epoch;
            if let Some(saved) = db.load_state(&cfg.world_id).await? {
                let dead = saved.hunters.iter().filter(|h| !h.alive).count();
                game = saved;
                eprintln!("[wh-server] estado restaurado: {} Hunters ({dead} mortos permanentemente), {} páginas no Bestiário", game.hunters.len(), game.bestiary.pages.len());
            }
            eprintln!("[wh-server] PostgreSQL conectado; época do mundo {epoch}");
            Some(Arc::new(db))
        }
        None => {
            eprintln!("[wh-server] sem DATABASE_URL: estado em memória (não persistido)");
            None
        }
    };

    let world = World::new(WorldClock::new(epoch), terrain, portals, data, game);
    let continent_json = Arc::new(continent_summary(&continent, &report_value));
    let scale = Arc::new(AtomicU32::new(cfg.time_scale));
    let traffic = Arc::new(Traffic::default());
    let (cmd_tx, cmd_rx) = std::sync::mpsc::sync_channel::<Cmd>(64);
    let first = Arc::new(Published { seq: 0, value: serde_json::json!({}), json: OnceLock::new(), important_seq: 0 });
    let (pub_tx, pub_rx) = watch::channel(first);
    let (save_tx, mut save_rx) = tokio::sync::mpsc::unbounded_channel::<(String, Vec<wh_core::hunter::Hunter>)>();
    let budget_pct: f64 = std::env::var("WH_SIM_BUDGET_PCT").ok().and_then(|v| v.parse().ok()).unwrap_or(50.0f64).clamp(5.0, 95.0);
    {
        let (scale, traffic) = (scale.clone(), traffic.clone());
        let persist = db.is_some();
        let pac = pacotes.clone();
        std::thread::Builder::new().name("wh-sim".into()).spawn(move || sim_thread(world, cmd_rx, pub_tx, scale, traffic, save_tx, persist, budget_pct, pac))?;
    }
    if let Some(db) = db.clone() {
        let world_id = cfg.world_id.clone();
        tokio::spawn(async move {
            while let Some((json, hunters)) = save_rx.recv().await {
                if let Err(e) = db.save_state(&world_id, &json).await {
                    eprintln!("[wh-server] falha ao salvar estado: {e}");
                }
                if let Err(e) = db.save_hunters(&world_id, &hunters).await {
                    eprintln!("[wh-server] falha ao salvar Hunters: {e}");
                }
            }
        });
    }
    let state = AppState { pacotes: pacotes.clone(), cmd: cmd_tx, scale, latest: pub_rx, traffic, continent_json, cfg: cfg.clone() };

    let client = ServeDir::new(&cfg.client_dist).fallback(ServeFile::new(cfg.client_dist.join("index.html")));
    let app = Router::new()
        .route("/api/v1/health", get(|| async { "ok" }))
        .route("/api/v1/snapshot", get(snapshot))
        .route("/api/v1/continent", get(continent_handler))
        .route("/api/v1/stream", get(stream))
        .route("/api/v1/orders", post(order_handler))
        .route("/api/v1/tempo", post(tempo_handler).get(tempo_get))
        .route("/api/v1/rota", get(rota_handler))
        .route("/api/v1/hexes", get(|State(s): State<AppState>| async move { Json(serde_json::json!({"tiles": s.pacotes.lista_presentes()})) }))
        .route("/api/v1/dev/clima", post(dev_clima_handler))
        .route_service("/api/v1/gameplay", ServeFile::new(&cfg.gameplay))
        .nest_service("/assets", ServeDir::new(cfg.repo_root.join("assets")))
        .nest_service("/fichas", ServeDir::new(cfg.repo_root.join("creatures/species")))
        .route("/glb/terrain/{tile}", get(terrain_glb))
        .route_service("/glb/hunter.glb", ServeFile::new(&cfg.hunter_glb))
        .nest_service("/physics", ServeDir::new(&cfg.physics_dir))
        // V02: chunks visuais/LOD/vegetação (gerados pelo pipeline), horizonte e assets da V02,
        // vila (fases) e modelos animados dos laboratórios — somente leitura
        .nest_service("/visual", ServeDir::new(&cfg.visual_dir).precompressed_gzip())
        .nest_service("/v02", ServeDir::new(cfg.repo_root.join("game/build-real-v02/assets"))) // assets da V02, sem cópia
        .nest_service("/world", ServeDir::new(cfg.repo_root.join("world")))
        // V03: telas de carregamento ORIGINAIS (Codex), servidas sem cópia nem alteração
        .nest_service("/carregamento", ServeDir::new(cfg.repo_root.join("build real/loading-screen/v02")))
        .nest_service("/labs", ServeDir::new(cfg.repo_root.join("labs")))
        .fallback_service(client)
        .with_state(state);
    let listener = tokio::net::TcpListener::bind(&cfg.bind).await?;
    eprintln!("[wh-server] ouvindo em http://{}", cfg.bind);
    axum::serve(listener, app).with_graceful_shutdown(async { let _ = tokio::signal::ctrl_c().await; }).await?;
    Ok(())
}

fn continent_summary(c: &Continent, report: &serde_json::Value) -> String {
    let status = |id: &str| {
        report["tiles"].as_array().and_then(|a| a.iter().find(|t| t["id"] == id)).map(|t| t["status"].clone()).unwrap_or_default()
    };
    let tiles: Vec<serde_json::Value> = c
        .tiles
        .iter()
        .map(|t| serde_json::json!({"id": t.id, "x": t.x, "z": t.z, "biome": t.biome, "status": status(&t.id)}))
        .collect();
    serde_json::json!({"schema": "wildhaven.continent.summary.v1", "hexRadius": wh_core::hex::HEX_RADIUS,
        "tiles": tiles, "summary": report["summary"]})
    .to_string()
}

/// Ordens do jogador (explorar, caçar, recolher...). Não existe ordem de mover o Hunter.
/// V03: a ordem vai para a fila limitada da thread de simulação e é aplicada entre passos (como na V02).
async fn order_handler(State(s): State<AppState>, Json(o): Json<Order>) -> Response {
    let (tx, rx) = oneshot::channel();
    if s.cmd.try_send(Cmd::Order(o, tx)).is_err() {
        return (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"ok": false, "message": "simulação ocupada; tente de novo"}))).into_response();
    }
    match rx.await {
        Ok(Ok(msg)) => (StatusCode::OK, Json(serde_json::json!({"ok": true, "message": msg}))).into_response(),
        Ok(Err(msg)) => (StatusCode::UNPROCESSABLE_ENTITY, Json(serde_json::json!({"ok": false, "message": msg}))).into_response(),
        Err(_) => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"ok": false, "message": "simulação indisponível"}))).into_response(),
    }
}

#[derive(serde::Deserialize)]
struct RotaQ {
    hunter: String,
    tile: String,
}
/// V04: estimativa de viagem (saltos, distância, duração) antes de dar a ordem.
async fn rota_handler(State(s): State<AppState>, axum::extract::Query(q): axum::extract::Query<RotaQ>) -> Response {
    let (tx, rx) = oneshot::channel();
    if s.cmd.try_send(Cmd::Rota { hunter: q.hunter, tile: q.tile, reply: tx }).is_err() {
        return StatusCode::SERVICE_UNAVAILABLE.into_response();
    }
    match rx.await {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(m)) => (StatusCode::UNPROCESSABLE_ENTITY, Json(serde_json::json!({"ok": false, "message": m}))).into_response(),
        Err(_) => StatusCode::SERVICE_UNAVAILABLE.into_response(),
    }
}

#[derive(serde::Deserialize)]
struct Tempo {
    escala: u32,
}
/// Velocidade da simulação local (×1, ×5, ×10, ×50). Não altera regras: só quantos passos por intervalo.
async fn tempo_handler(State(s): State<AppState>, Json(t): Json<Tempo>) -> Response {
    if ![1, 5, 10, 50].contains(&t.escala) {
        return (StatusCode::UNPROCESSABLE_ENTITY, Json(serde_json::json!({"ok": false, "message": "escala aceita: 1, 5, 10 ou 50"}))).into_response();
    }
    s.scale.store(t.escala, Ordering::Relaxed);
    Json(serde_json::json!({"ok": true, "message": format!("Velocidade ×{}", t.escala), "escala": t.escala})).into_response()
}
async fn tempo_get(State(s): State<AppState>) -> Response {
    Json(serde_json::json!({"escala": s.scale.load(Ordering::Relaxed)})).into_response()
}
#[derive(serde::Deserialize)]
struct DevClima {
    tipo: String,
    x: f64,
    z: f64,
    #[serde(default)]
    duracao_s: Option<f64>,
}
/// Menu do desenvolvedor: força clima numa região (a mudança vale para a simulação inteira).
async fn dev_clima_handler(State(s): State<AppState>, Json(d): Json<DevClima>) -> Response {
    let valid = ["limpo", "chuva", "tempestade", "neve", "nevasca", "areia"];
    if !valid.contains(&d.tipo.as_str()) {
        return (StatusCode::UNPROCESSABLE_ENTITY, Json(serde_json::json!({"ok": false, "message": "tipo inválido"}))).into_response();
    }
    let (tx, rx) = oneshot::channel();
    if s.cmd.try_send(Cmd::Clima { tipo: d.tipo, x: d.x, z: d.z, dur: d.duracao_s.unwrap_or(900.0), reply: tx }).is_err() {
        return StatusCode::SERVICE_UNAVAILABLE.into_response();
    }
    let msg = rx.await.unwrap_or_default();
    Json(serde_json::json!({"ok": true, "message": msg})).into_response()
}

async fn snapshot(State(s): State<AppState>) -> Response {
    let p = s.latest.borrow().clone();
    ([(header::CONTENT_TYPE, "application/json")], p.json().to_string()).into_response()
}
async fn continent_handler(State(s): State<AppState>) -> Response {
    ([(header::CONTENT_TYPE, "application/json")], (*s.continent_json).clone()).into_response()
}
async fn terrain_glb(State(s): State<AppState>, Path(tile): Path<String>) -> Response {
    let id = tile.trim_end_matches(".glb");
    let Some(path) = s.cfg.terrain_glb_path(id) else { return StatusCode::NOT_FOUND.into_response() };
    match tokio::fs::read(path).await {
        Ok(b) => ([(header::CONTENT_TYPE, "model/gltf-binary"), (header::CACHE_CONTROL, "max-age=3600")], b).into_response(),
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}

// ------------------------------------------------------------------ thread de simulação

const INTERVAL: Duration = Duration::from_millis(200);
const IMPORTANT: &[&str] = &["morte", "ferimento", "abate", "bestiario", "resgate", "expedicao"];

/// Laço de passo fixo: dona exclusiva do `World`. Comandos são aplicados entre passos; a cada intervalo
/// executa `escala` passos (mais a dívida de atrasos, até 2× a escala por intervalo e dentro do orçamento
/// de tempo) e publica um snapshot imutável. Mede o custo COMPLETO (janelas físicas, gameplay, visão,
/// conversão para o fio) e a CPU/RAM do processo.
#[allow(clippy::too_many_arguments)]
fn sim_thread(mut w: World, rx: std::sync::mpsc::Receiver<Cmd>, tx: watch::Sender<Arc<Published>>, scale: Arc<AtomicU32>, traffic: Arc<Traffic>, save_tx: tokio::sync::mpsc::UnboundedSender<(String, Vec<wh_core::hunter::Hunter>)>, persist: bool, budget_pct: f64, pacotes: Arc<pacotes::Pacotes>) {
    // V04: viagens à espera de pacotes de hex (ordem, hexes que faltam)
    let mut pendentes: Vec<(Order, Vec<String>)> = vec![];
    let mut prefetch_at = std::time::Instant::now();
    use std::time::Instant;
    let mut next = Instant::now() + INTERVAL;
    let mut debt: u64 = 0;
    let mut dropped: u64 = 0;
    let mut seq: u64 = 0;
    let mut important_seq: u64 = 0;
    let mut last_save = Instant::now();
    let mut proc = sysinfo::ProcSample::now();
    let mut proc_view = serde_json::json!({});
    let mut steps_window: (Instant, u64) = (Instant::now(), 0);
    let mut steps_per_s = 0.0;
    let mut busy_ns: u128 = 0;
    let mut busy_pct = 0.0;
    let mut traffic_last = (0u64, 0u64);
    let mut traffic_rate = (0.0f64, 0.0f64);
    let mut batch_hist: std::collections::VecDeque<f64> = std::collections::VecDeque::with_capacity(300);
    loop {
        // comandos até o próximo prazo (resposta imediata ao jogador)
        loop {
            let now = Instant::now();
            if now >= next {
                break;
            }
            match rx.recv_timeout(next - now) {
                Ok(Cmd::Order(o, reply)) => {
                    // V04: viagem por hexes ainda não baixados — pede os pacotes (prioridade alta) e dá a ordem quando chegarem
                    if let Order::Viajar { hunters, tile } = &o {
                        let faltam: Vec<String> = hunters.first().and_then(|id| w.game.hunters.iter().find(|h| &h.id == id).cloned()).and_then(|h| wh_core::game::estimate_trip(&mut w.terrain, &w.portals, &h, tile).ok()).map(|v| v["hexesAusentes"].as_array().cloned().unwrap_or_default().iter().filter_map(|x| x.as_str().map(String::from)).collect()).unwrap_or_default();
                        if !faltam.is_empty() {
                            for t in &faltam { pacotes.pedir(t, true); }
                            let mb = pacotes.tamanho(&faltam) as f64 / 1048576.0;
                            let msg = format!("Baixando {} hex(es) da rota (~{mb:.0} MB); a viagem começa assim que chegarem", faltam.len());
                            w.game.event(w.tick, w.sim_time_s, "viagem", msg.clone());
                            pendentes.push((o, faltam));
                            let _ = reply.send(Ok(msg));
                            continue;
                        }
                    }
                    let r = w.order(o);
                    let _ = reply.send(r);
                }
                Ok(Cmd::Rota { hunter, tile, reply }) => {
                    let r = match w.game.hunters.iter().find(|h| h.id == hunter).cloned() {
                        Some(h) => wh_core::game::estimate_trip(&mut w.terrain, &w.portals, &h, &tile),
                        None => Err(format!("Hunter desconhecido: {hunter}")),
                    };
                    let _ = reply.send(r);
                }
                Ok(Cmd::Clima { tipo, x, z, dur, reply }) => {
                    let now_s = w.sim_time_s;
                    w.game.climate.force(x, z, &tipo, now_s, dur);
                    let _ = reply.send(format!("Clima forçado (dev): {tipo}"));
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => break,
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => return,
            }
        }
        // V04: pacotes que chegaram passam a ser simulados; viagens pendentes partem quando a rota estiver completa
        for t in pacotes.novos() {
            w.terrain.make_present(&t);
        }
        let mut i = 0;
        while i < pendentes.len() {
            if pendentes[i].1.iter().all(|t| w.terrain.is_allowed(t)) {
                let (o, _) = pendentes.remove(i);
                // a própria ordem registra o acontecimento; aqui só a falha (rota mudou enquanto baixava)
                if let Err(e) = w.order(o) {
                    w.game.event(w.tick, w.sim_time_s, "viagem", format!("Viagem cancelada: {e}"));
                }
            } else {
                i += 1;
            }
        }
        // pré-carga: vizinhos (com portal) dos hexes onde há Hunters vivos
        if prefetch_at.elapsed() >= Duration::from_secs(5) {
            prefetch_at = Instant::now();
            let tiles: std::collections::BTreeSet<String> = w.game.hunters.iter().filter(|h| h.alive).map(|h| h.mv.tile_id.clone()).collect();
            for t in tiles {
                for (n, _) in w.portals.neighbors_with_portals(&t) {
                    if w.terrain.is_routable(&n) && !w.terrain.is_allowed(&n) {
                        pacotes.pedir(&n, false);
                    }
                }
            }
        }
        let tb = Instant::now();
        // intervalos perdidos viram dívida; o prazo seguinte fica alinhado (sem rajada de ticks atrasados)
        let late = tb.saturating_duration_since(next);
        let missed = (late.as_millis() / INTERVAL.as_millis()) as u32;
        next += INTERVAL * (1 + missed);
        let sc = scale.load(Ordering::Relaxed).max(1) as u64;
        debt += sc * (1 + missed as u64);
        let cap = (sc * 150).max(300); // teto: 30 s de simulação na escala atual
        if debt > cap {
            dropped += debt - cap;
            eprintln!("[wh-server] atraso acima do teto: {} passos descartados (total {dropped}); simulação mais lenta que ×{sc} nesta máquina", debt - cap);
            debt = cap;
        }
        let budget = INTERVAL.mul_f64(budget_pct / 100.0);
        let max_steps = sc * 2;
        let mut n = 0u64;
        w.clock_now_ms = Some(now_ms());
        let mut window_ms = 0.0;
        let mut game_ms = 0.0;
        while debt > 0 && n < max_steps && (n < 1 || tb.elapsed() < budget) {
            w.step();
            window_ms += w.game.metrics.window_ms;
            game_ms += w.game.metrics.tick_ms;
            debt -= 1;
            n += 1;
        }
        let steps_ms = tb.elapsed().as_secs_f64() * 1000.0;
        // ---- publicação: visão + conversão para o fio (fora de qualquer lock; o mundo é só desta thread)
        let tp = Instant::now();
        let mut value = serde_json::to_value(w.snapshot(now_ms())).unwrap_or_default();
        let view_ms = tp.elapsed().as_secs_f64() * 1000.0;
        for e in w.game.events.iter() {
            if e.seq > important_seq && IMPORTANT.contains(&e.kind.as_str()) {
                important_seq = e.seq;
            }
        }
        // métricas do processo e do servidor (1 vez por segundo)
        steps_window.1 += n;
        let el = steps_window.0.elapsed().as_secs_f64();
        if el >= 1.0 {
            steps_per_s = steps_window.1 as f64 / el;
            busy_pct = busy_ns as f64 / 1e6 / (el * 1000.0) * 100.0;
            let (b, m) = (traffic.bytes.load(Ordering::Relaxed), traffic.msgs.load(Ordering::Relaxed));
            traffic_rate = ((b - traffic_last.0) as f64 / el, (m - traffic_last.1) as f64 / el);
            traffic_last = (b, m);
            steps_window = (Instant::now(), 0);
            busy_ns = 0;
            let p2 = sysinfo::ProcSample::now();
            proc_view = serde_json::json!({"cpu_pct": p2.cpu_pct_since(&proc), "rss_mb": p2.rss_mb, "threads_note": "% de UM núcleo, processo inteiro"});
            proc = p2;
        }
        let total_ms = tb.elapsed().as_secs_f64() * 1000.0;
        if batch_hist.len() >= 300 { batch_hist.pop_front(); }
        batch_hist.push_back(total_ms);
        let mut sorted: Vec<f64> = batch_hist.iter().copied().collect();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let pq = |q: f64| sorted[((sorted.len() - 1) as f64 * q).round() as usize];
        seq += 1;
        if let Some(o) = value.as_object_mut() {
            o.insert("server".into(), serde_json::json!({
                "seq": seq, "escala": sc, "passos_no_intervalo": n, "passos_por_s": steps_per_s, "escala_efetiva": steps_per_s * INTERVAL.as_secs_f64(),
                "divida_passos": debt, "passos_descartados": dropped, "orcamento_pct": budget_pct,
                "intervalo_ms": {"total": total_ms, "passos": steps_ms, "janelas_fisicas": window_ms, "gameplay": game_ms, "visao_fio": view_ms, "p50": pq(0.5), "p95": pq(0.95), "p99": pq(0.99), "max": sorted.last().copied().unwrap_or(0.0)},
                "ocupacao_thread_sim_pct": busy_pct,
                "processo": proc_view,
                "ws": {"clientes": traffic.clients.load(Ordering::Relaxed), "bytes_por_s": traffic_rate.0, "msgs_por_s": traffic_rate.1, "completos": traffic.fulls.load(Ordering::Relaxed), "ressincronizacoes": traffic.resyncs.load(Ordering::Relaxed)},
                "terreno": w.terrain.stats,
                "pacotes": pacotes.resumo(), "viagensAguardandoPacotes": pendentes.len(),
            }));
        }
        busy_ns += tb.elapsed().as_nanos();
        let _ = tx.send(Arc::new(Published { seq, value, json: OnceLock::new(), important_seq }));
        // persistência: a cada 10 s, ou já após morte/ordem/página nova (serialização aqui, gravação assíncrona)
        if persist && (w.game.pending_save || last_save.elapsed() >= Duration::from_secs(10)) && last_save.elapsed() >= Duration::from_secs(1) {
            w.game.pending_save = false;
            last_save = Instant::now();
            let _ = save_tx.send((serde_json::to_string(&w.game).unwrap_or_default(), w.game.hunters.clone()));
        }
    }
}

// ------------------------------------------------------------------ WebSocket incremental

async fn stream(ws: WebSocketUpgrade, State(s): State<AppState>) -> Response {
    ws.on_upgrade(move |socket| push(socket, s))
}

#[derive(Clone, Copy, PartialEq, Debug)]
enum Modo {
    Tres,
    Eco,
    Fundo,
}
impl Modo {
    /// Intervalo mínimo entre envios: 3D = cada publicação (5 Hz), Econômico = 2,5 Hz, Segundo Plano = 5 s
    /// (ou imediatamente quando houver acontecimento importante). Não altera a frequência da simulação.
    fn min_gap(self) -> Duration {
        match self {
            Modo::Tres => Duration::from_millis(0),
            Modo::Eco => Duration::from_millis(400),
            Modo::Fundo => Duration::from_secs(5),
        }
    }
}

async fn push(mut socket: WebSocket, s: AppState) {
    let mut rx = s.latest.clone();
    s.traffic.clients.fetch_add(1, Ordering::Relaxed);
    let mut modo = Modo::Tres;
    let mut base: Option<(u64, serde_json::Value)> = None; // último estado que ESTE cliente recebeu
    let mut sent_important = 0u64;
    let mut last_send = std::time::Instant::now() - Duration::from_secs(60);
    let mut want_full = true;
    // V03: filtro de relevância para a apresentação — criaturas e rastros perto do Hunter que ESTE cliente segue
    // (mais as criaturas em combate com qualquer Hunter). A simulação continua com todas.
    let mut foco: Option<String> = None;
    loop {
        // envia se houver publicação nova e o modo permitir (o watch guarda só a mais recente: coalesce atrasos)
        let p = rx.borrow().clone();
        let fresh = base.as_ref().map(|(sq, _)| *sq != p.seq).unwrap_or(true) && p.seq > 0;
        let due = last_send.elapsed() >= modo.min_gap() || (modo == Modo::Fundo && p.important_seq > sent_important) || want_full;
        if fresh && due {
            let view = relevant(&p.value, foco.as_deref());
            let msg = if want_full || base.is_none() {
                let mut v = view.clone();
                if let Some(o) = v.as_object_mut() {
                    o.insert("$t".into(), "full".into());
                    o.insert("$seq".into(), p.seq.into());
                }
                s.traffic.fulls.fetch_add(1, Ordering::Relaxed);
                serde_json::to_string(&v).unwrap_or_default()
            } else {
                let (bseq, bval) = base.as_ref().unwrap();
                let patch = wire::diff(bval, &view, "").unwrap_or_else(|| serde_json::json!({}));
                serde_json::to_string(&serde_json::json!({"$t": "d", "$seq": p.seq, "$base": bseq, "p": patch})).unwrap_or_default()
            };
            s.traffic.bytes.fetch_add(msg.len() as u64, Ordering::Relaxed);
            s.traffic.msgs.fetch_add(1, Ordering::Relaxed);
            if socket.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
            base = Some((p.seq, view));
            sent_important = p.important_seq;
            last_send = std::time::Instant::now();
            want_full = false;
        }
        let wait = if fresh && !due { modo.min_gap().saturating_sub(last_send.elapsed()).max(Duration::from_millis(20)) } else { Duration::from_secs(30) };
        tokio::select! {
            r = rx.changed() => { if r.is_err() { break; } }
            m = socket.recv() => {
                match m {
                    Some(Ok(Message::Text(t))) => {
                        let v: serde_json::Value = serde_json::from_str(t.as_str()).unwrap_or_default();
                        match v["modo"].as_str() {
                            Some("3d") => modo = Modo::Tres,
                            Some("eco") => modo = Modo::Eco,
                            Some("fundo") => modo = Modo::Fundo,
                            _ => {}
                        }
                        if let Some(f) = v["foco"].as_str() {
                            if foco.as_deref() != Some(f) {
                                foco = Some(f.to_string());
                                want_full = true; // o conjunto filtrado mudou: estado completo
                            }
                        }
                        if v["resync"].as_bool() == Some(true) {
                            want_full = true;
                            s.traffic.resyncs.fetch_add(1, Ordering::Relaxed);
                        }
                    }
                    Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
                    _ => {}
                }
            }
            _ = tokio::time::sleep(wait) => {}
        }
    }
    s.traffic.clients.fetch_sub(1, Ordering::Relaxed);
}

/// Raio de apresentação em torno do Hunter seguido (m): criaturas e rastros além disso não trafegam.
const RAIO_FOCO_M: f64 = 1500.0;
const RAIO_RASTROS_M: f64 = 600.0;
fn relevant(v: &serde_json::Value, foco: Option<&str>) -> serde_json::Value {
    let Some(id) = foco else { return v.clone() };
    let Some(h) = v["hunters"].as_array().and_then(|a| a.iter().find(|h| h["id"] == id)) else { return v.clone() };
    let (hx, hz) = (h["x"].as_f64().unwrap_or(0.0), h["z"].as_f64().unwrap_or(0.0));
    let alvos: std::collections::HashSet<u64> = v["hunters"].as_array().map(|a| a.iter().filter_map(|h| h["target_creature"].as_u64()).collect()).unwrap_or_default();
    let near = |o: &serde_json::Value, r: f64| { let (x, z) = (o["x"].as_f64().unwrap_or(f64::MAX), o["z"].as_f64().unwrap_or(f64::MAX)); ((x - hx).powi(2) + (z - hz).powi(2)).sqrt() <= r };
    let mut out = v.clone();
    if let Some(cs) = out["game"]["creatures"].as_array_mut() { cs.retain(|c| near(c, RAIO_FOCO_M) || c["id"].as_u64().map(|i| alvos.contains(&i)).unwrap_or(false)); }
    if let Some(ts) = out["game"]["tracks"].as_array_mut() { ts.retain(|t| near(t, RAIO_RASTROS_M)); }
    out
}

/// CPU e RSS do processo (Linux: /proc; Windows: GetProcessTimes/K32GetProcessMemoryInfo, sem dependências).
mod sysinfo {
    pub struct ProcSample {
        pub cpu_s: f64,
        pub at: std::time::Instant,
        pub rss_mb: f64,
    }
    impl ProcSample {
        pub fn now() -> Self {
            let (cpu_s, rss_mb) = read();
            Self { cpu_s, at: std::time::Instant::now(), rss_mb }
        }
        pub fn cpu_pct_since(&self, prev: &ProcSample) -> f64 {
            let wall = self.at.duration_since(prev.at).as_secs_f64().max(1e-6);
            (self.cpu_s - prev.cpu_s) / wall * 100.0
        }
    }
    #[cfg(target_os = "linux")]
    fn read() -> (f64, f64) {
        let stat = std::fs::read_to_string("/proc/self/stat").unwrap_or_default();
        let f: Vec<&str> = stat.rsplit(')').next().unwrap_or("").split_whitespace().collect();
        let ticks = f.get(11).and_then(|v| v.parse::<f64>().ok()).unwrap_or(0.0) + f.get(12).and_then(|v| v.parse::<f64>().ok()).unwrap_or(0.0);
        let status = std::fs::read_to_string("/proc/self/status").unwrap_or_default();
        let rss = status.lines().find(|l| l.starts_with("VmRSS:")).and_then(|l| l.split_whitespace().nth(1)).and_then(|v| v.parse::<f64>().ok()).unwrap_or(0.0) / 1024.0;
        (ticks / 100.0, rss)
    }
    #[cfg(windows)]
    fn read() -> (f64, f64) {
        #[repr(C)]
        #[derive(Default)]
        struct Pmc {
            cb: u32,
            page_fault_count: u32,
            peak_working_set: usize,
            working_set: usize,
            qpp: usize,
            qp: usize,
            qnpp: usize,
            qnp: usize,
            pagefile: usize,
            peak_pagefile: usize,
        }
        #[link(name = "kernel32")]
        extern "system" {
            fn GetCurrentProcess() -> isize;
            fn GetProcessTimes(h: isize, c: *mut u64, e: *mut u64, k: *mut u64, u: *mut u64) -> i32;
            fn K32GetProcessMemoryInfo(h: isize, p: *mut Pmc, cb: u32) -> i32;
        }
        unsafe {
            let h = GetCurrentProcess();
            let (mut c, mut e, mut k, mut u) = (0u64, 0u64, 0u64, 0u64);
            GetProcessTimes(h, &mut c, &mut e, &mut k, &mut u);
            let mut pmc = Pmc { cb: std::mem::size_of::<Pmc>() as u32, ..Default::default() };
            K32GetProcessMemoryInfo(h, &mut pmc, pmc.cb);
            (((k + u) as f64) / 1e7, pmc.working_set as f64 / 1048576.0)
        }
    }
    #[cfg(not(any(target_os = "linux", windows)))]
    fn read() -> (f64, f64) {
        (0.0, 0.0)
    }
}
