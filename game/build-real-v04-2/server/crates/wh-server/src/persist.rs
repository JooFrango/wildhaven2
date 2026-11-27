//! Persistência PostgreSQL (opcional; ativa com DATABASE_URL).
//! Migrations SQL versionadas em `server/migrations/NNNN_nome.sql`, aplicadas em ordem e
//! registradas em `schema_migrations`.

use std::path::Path;
use tokio_postgres::{Client, NoTls};
use wh_core::game::GameState;
use wh_core::hunter::Hunter;

pub const STATE_SCHEMA: &str = "wildhaven.world-state.v1";

pub struct Db {
    client: Client,
}



impl Db {
    pub async fn connect(url: &str, migrations: &Path) -> Result<Self, Box<dyn std::error::Error>> {
        let (client, conn) = tokio_postgres::connect(url, NoTls).await?;
        tokio::spawn(async move {
            if let Err(e) = conn.await {
                eprintln!("[wh-server] conexão PostgreSQL encerrada: {e}");
            }
        });
        let db = Self { client };
        db.migrate(migrations).await?;
        Ok(db)
    }

    async fn migrate(&self, dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
        self.client
            .batch_execute("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())")
            .await?;
        let mut files: Vec<_> = std::fs::read_dir(dir)?
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| p.extension().map(|x| x == "sql").unwrap_or(false))
            .collect();
        files.sort();
        for f in files {
            let version = f.file_stem().unwrap().to_string_lossy().to_string();
            let done = self.client.query_opt("SELECT 1 FROM schema_migrations WHERE version=$1", &[&version]).await?;
            if done.is_some() {
                continue;
            }
            let sql = std::fs::read_to_string(&f)?;
            self.client.batch_execute(&format!("BEGIN;\n{sql}\nINSERT INTO schema_migrations(version) VALUES ('{version}');\nCOMMIT;")).await?;
            eprintln!("[wh-server] migration aplicada: {version}");
        }
        Ok(())
    }

    pub async fn load_or_create_world(&self, id: &str, epoch_ms: u64, seed: u32) -> Result<(u64, ()), Box<dyn std::error::Error>> {
        self.client
            .execute(
                "INSERT INTO worlds(id, clock_epoch_ms, seed) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING",
                &[&id, &(epoch_ms as i64), &(seed as i64)],
            )
            .await?;
        let row = self.client.query_one("SELECT clock_epoch_ms FROM worlds WHERE id=$1", &[&id]).await?;
        let epoch: i64 = row.get(0);
Ok((epoch as u64, ()))
    }

    pub async fn load_state(&self, world: &str) -> Result<Option<GameState>, Box<dyn std::error::Error>> {
        let row = self.client.query_opt("SELECT schema, state::text FROM world_state WHERE world_id=$1", &[&world]).await?;
        let Some(row) = row else { return Ok(None) };
        let schema: String = row.get(0);
        if schema != STATE_SCHEMA {
            return Err(format!("estado salvo com schema {schema}; esperado {STATE_SCHEMA}").into());
        }
        let text: String = row.get(1);
        Ok(Some(serde_json::from_str(&text)?))
    }

    pub async fn save_state(&self, world: &str, state_json: &str) -> Result<(), Box<dyn std::error::Error>> {
        self.client
            .execute(
                "INSERT INTO world_state(world_id, schema, state, saved_at) VALUES ($1, $2, $3::text::jsonb, now())
                 ON CONFLICT (world_id) DO UPDATE SET schema=EXCLUDED.schema, state=EXCLUDED.state, saved_at=now()",
                &[&world, &STATE_SCHEMA, &state_json],
            )
            .await?;
        Ok(())
    }

    pub async fn save_hunters(&self, world: &str, hunters: &[Hunter]) -> Result<(), Box<dyn std::error::Error>> {
        for h in hunters {
            self.client
                .execute(
                    "INSERT INTO hunters(id, world_id, name, tile_id, x, y, z, heading, state, distance_walked_m, alive, role, updated_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
                     ON CONFLICT (id) DO UPDATE SET tile_id=EXCLUDED.tile_id, x=EXCLUDED.x, y=EXCLUDED.y, z=EXCLUDED.z,
                       heading=EXCLUDED.heading, state=EXCLUDED.state, distance_walked_m=EXCLUDED.distance_walked_m,
                       alive=EXCLUDED.alive, role=EXCLUDED.role, updated_at=now()",
                    &[&h.id, &world, &h.name, &h.mv.tile_id, &h.mv.x, &h.mv.y, &h.mv.z, &h.mv.heading,
                      &serde_json::to_value(&h.activity)?.as_str().unwrap_or("").to_string(), &h.mv.distance_walked_m, &h.alive, &h.role],
                )
                .await?;
            for c in &h.mv.crossings {
                self.client
                    .execute(
                        "INSERT INTO hunter_crossings(hunter_id, tick, sim_time_s, from_tile, to_tile, x, z, step_m)
                         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (hunter_id, tick) DO NOTHING",
                        &[&h.id, &(c.tick as i64), &c.sim_time_s, &c.from, &c.to, &c.x, &c.z, &c.step_m],
                    )
                    .await?;
            }
        }
        Ok(())
    }
}
