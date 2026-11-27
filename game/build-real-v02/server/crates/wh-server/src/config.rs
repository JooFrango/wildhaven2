//! Configuração por variáveis de ambiente (ver `.env.example`). Nenhum segredo tem valor padrão.

use std::collections::HashMap;
use std::path::PathBuf;

pub struct Config {
    pub bind: String,
    pub repo_root: PathBuf,
    pub manifest: PathBuf,
    pub physics_dir: PathBuf,
    pub portal_report: PathBuf,
    pub clip_speeds: PathBuf,
    pub hunter_glb: PathBuf,
    pub spawn: PathBuf,
    pub gameplay: PathBuf,
    pub client_dist: PathBuf,
    pub migrations_dir: PathBuf,
    pub world_id: String,
    pub clock_epoch_ms: Option<u64>,
    pub time_scale: u32,
    pub allow_uncertified: bool,
    pub cache_bytes: usize,
    pub database_url: Option<String>,
    terrain_paths: HashMap<String, PathBuf>,
}

fn env(k: &str) -> Option<String> {
    std::env::var(k).ok().filter(|v| !v.is_empty())
}

impl Config {
    pub fn from_env() -> Result<Self, String> {
        let repo_root = PathBuf::from(env("WH_REPO_ROOT").unwrap_or_else(|| "../../..".into()));
        let r = |k: &str, d: &str| repo_root.join(env(k).unwrap_or_else(|| d.into()));
        let manifest = r("WH_MANIFEST", "build real/continental/data/continent-272.manifest.json");
        let sources_dir = r("WH_SOURCES_DIR", ".generated/sources");
        // mapa tile → GLB materializado pelo fetch (bytes/SHA já conferidos pelo fetch-sources)
        let m: serde_json::Value = serde_json::from_slice(&std::fs::read(&manifest).map_err(|e| format!("manifesto: {e}"))?)
            .map_err(|e| e.to_string())?;
        let mut terrain_paths = HashMap::new();
        for t in m["tiles"].as_array().into_iter().flatten() {
            let root = if t["source"]["repository"] == "carioca1111/wildhaven" { "old-root" } else { "new-root" };
            let p = sources_dir.join(root).join(t["source"]["path"].as_str().unwrap_or_default());
            terrain_paths.insert(t["id"].as_str().unwrap_or_default().to_string(), p);
        }
        Ok(Self {
            bind: env("WH_BIND").unwrap_or_else(|| "127.0.0.1:8787".into()),
            manifest,
            physics_dir: r("WH_PHYSICS_DIR", ".generated/physics-272"),
            portal_report: r("WH_PORTAL_REPORT", "build real/integracao/relatorio-continental-272.json"),
            clip_speeds: r("WH_CLIP_SPEEDS", "game/build-real-v02/data/hunter-workshop-clip-speeds.json"),
            hunter_glb: r("WH_HUNTER_GLB", "assets/hunters/hunter-workshop/base/hunter-masculino-1000v/hunter_masculino_1000v.glb"),
            spawn: r("WH_SPAWN", "game/build-real-v02/data/spawn-v01.json"),
            gameplay: r("WH_GAMEPLAY", "game/build-real-v02/data/gameplay-provisorio-v01.json"),
            client_dist: r("WH_CLIENT_DIST", "game/build-real-v02/client/dist"),
            migrations_dir: r("WH_MIGRATIONS_DIR", "game/build-real-v02/server/migrations"),
            world_id: env("WH_WORLD_ID").unwrap_or_else(|| "auralis-v02".into()),
            clock_epoch_ms: env("WH_CLOCK_EPOCH_MS").and_then(|v| v.parse().ok()),
            time_scale: env("WH_TIME_SCALE").and_then(|v| v.parse().ok()).unwrap_or(1).clamp(1, 50),
            allow_uncertified: env("WH_ALLOW_UNCERTIFIED").as_deref() == Some("1"),
            cache_bytes: env("WH_CACHE_MB").and_then(|v| v.parse::<usize>().ok()).unwrap_or(256) * 1024 * 1024,
            database_url: env("DATABASE_URL"),
            repo_root,
            terrain_paths,
        })
    }
    pub fn terrain_glb_path(&self, id: &str) -> Option<&PathBuf> {
        self.terrain_paths.get(id)
    }
}
