//! wh-server — servidor autoritativo do Wildhaven Build Real v01.
//!
//! Executa a simulação em passo fixo (0,2 s), mantém o relógio global (dia 2 h + noite
//! 40 min), serve snapshots versionados (`wildhaven.snapshot.v1`) por HTTP e WebSocket,
//! os pacotes físicos WHP1 compilados e os GLBs verificados para o cliente.
//! O cliente nunca move o Hunter: não existe rota de controle direto.

mod config;
mod persist;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, State};
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use std::collections::HashSet;
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tower_http::services::{ServeDir, ServeFile};
use wh_core::clock::WorldClock;
use wh_core::hex::{Continent, Manifest};
use wh_core::hunter::Hunter;
use wh_core::portals::{PortalIndex, PortalReport};
use wh_core::sim::World;
use wh_core::terrain::TerrainStore;

pub fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

#[derive(Clone)]
struct AppState {
    latest: Arc<RwLock<String>>,
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
    let mut hunters: Vec<Hunter> = vec![];
    for (i, h) in spawn["hunters"].as_array().ok_or("spawn sem hunters")?.iter().enumerate() {
        let tile = h["tile"].as_str().ok_or("spawn sem tile")?;
        if !allowed.contains(tile) {
            return Err(format!("spawn em tile não liberado: {tile}").into());
        }
        hunters.push(Hunter::new(
            h["id"].as_str().unwrap_or("hunter"),
            h["name"].as_str().unwrap_or("Hunter"),
            h["x"].as_f64().ok_or("x")?,
            h["z"].as_f64().ok_or("z")?,
            tile,
            walk,
            seed.wrapping_add(i as u32 * 7919),
        ));
    }

    let mut epoch = cfg.clock_epoch_ms.unwrap_or_else(now_ms);
    let db = match &cfg.database_url {
        Some(url) => {
            let db = persist::Db::connect(url, &cfg.migrations_dir).await?;
            let (stored_epoch, stored) = db.load_or_create_world(&cfg.world_id, epoch, seed).await?;
            epoch = stored_epoch;
            for h in hunters.iter_mut() {
                if let Some(s) = stored.iter().find(|s| s.id == h.id) {
                    if allowed.contains(&s.tile_id) && continent.tile_at(s.x, s.z).map(|t| t.id == s.tile_id).unwrap_or(false) {
                        h.x = s.x;
                        h.z = s.z;
                        h.tile_id = s.tile_id.clone();
                        h.distance_walked_m = s.distance_walked_m;
                    }
                }
            }
            eprintln!("[wh-server] PostgreSQL conectado; época do mundo {epoch}");
            Some(Arc::new(db))
        }
        None => {
            eprintln!("[wh-server] sem DATABASE_URL: estado em memória (não persistido)");
            None
        }
    };

    let terrain = TerrainStore::new(continent.clone(), cfg.physics_dir.clone(), allowed, cfg.cache_bytes);
    let world = World::new(WorldClock::new(epoch), terrain, portals, hunters);
    let continent_json = Arc::new(continent_summary(&continent, &report_value));
    let world = Arc::new(Mutex::new(world));
    let latest = Arc::new(RwLock::new(String::from("{}")));
    let state = AppState { latest: latest.clone(), continent_json, cfg: cfg.clone() };

    // laço de simulação (passo fixo; time_scale passos por intervalo)
    {
        let (world, latest, scale) = (world.clone(), latest.clone(), cfg.time_scale);
        tokio::spawn(async move {
            let mut iv = tokio::time::interval(Duration::from_millis(200));
            loop {
                iv.tick().await;
                let json = {
                    let mut w = world.lock().unwrap();
                    for _ in 0..scale {
                        w.step();
                    }
                    serde_json::to_string(&w.snapshot(now_ms())).unwrap_or_default()
                };
                *latest.write().unwrap() = json;
            }
        });
    }
    if let Some(db) = db.clone() {
        let world = world.clone();
        let world_id = cfg.world_id.clone();
        tokio::spawn(async move {
            let mut iv = tokio::time::interval(Duration::from_secs(10));
            loop {
                iv.tick().await;
                let hunters = world.lock().unwrap().hunters.clone();
                if let Err(e) = db.save_hunters(&world_id, &hunters).await {
                    eprintln!("[wh-server] falha ao salvar: {e}");
                }
            }
        });
    }

    let client = ServeDir::new(&cfg.client_dist).fallback(ServeFile::new(cfg.client_dist.join("index.html")));
    let app = Router::new()
        .route("/api/v1/health", get(|| async { "ok" }))
        .route("/api/v1/snapshot", get(snapshot))
        .route("/api/v1/continent", get(continent_handler))
        .route("/api/v1/stream", get(stream))
        .route("/glb/terrain/{tile}", get(terrain_glb))
        .route_service("/glb/hunter.glb", ServeFile::new(&cfg.hunter_glb))
        .nest_service("/physics", ServeDir::new(&cfg.physics_dir))
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

async fn snapshot(State(s): State<AppState>) -> Response {
    ([(header::CONTENT_TYPE, "application/json")], s.latest.read().unwrap().clone()).into_response()
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
async fn stream(ws: WebSocketUpgrade, State(s): State<AppState>) -> Response {
    ws.on_upgrade(move |socket| push(socket, s))
}
async fn push(mut socket: WebSocket, s: AppState) {
    let mut iv = tokio::time::interval(Duration::from_millis(200));
    loop {
        iv.tick().await;
        let json = s.latest.read().unwrap().clone();
        if socket.send(Message::Text(json.into())).await.is_err() {
            break;
        }
    }
}
