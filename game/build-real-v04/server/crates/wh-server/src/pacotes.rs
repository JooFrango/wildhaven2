//! V04 — Distribuição modular: pacotes por hex (física WHP1 + visual V04) baixados SOB DEMANDA da release
//! `build-real-v04-hexes` e guardados no cache local (as mesmas pastas `.generated/...` do servidor).
//!
//! - índice `hexes-v04.json` (bytes e SHA-256 de cada pacote) lido na partida; sem rede, nada é baixado e o jogo
//!   continua com os hexes já presentes (modo offline);
//! - thread própria (nunca bloqueia a simulação); fila com prioridade (rota pedida antes de vizinhos);
//! - cada ZIP é conferido (bytes + SHA-256) antes de extrair; caminhos dentro do ZIP são validados (sem `..`);
//! - ao terminar, o hex entra no conjunto disponível; a simulação o libera no próximo intervalo.
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet, VecDeque};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Condvar, Mutex};

#[derive(Default)]
pub struct Estado {
    pub indice: HashMap<String, (u64, String)>,
    pub indice_ok: bool,
    pub presentes: HashSet<String>,
    pub novos: Vec<String>,
    pub fila: VecDeque<String>,
    pub baixando: Option<String>,
    pub falhas: HashMap<String, String>,
    pub bytes_baixados: u64,
    pub concluidos: u64,
}

pub struct Pacotes {
    pub estado: Arc<(Mutex<Estado>, Condvar)>,
}

impl Pacotes {
    pub fn iniciar(base_url: String, physics_dir: PathBuf, visual_dir: PathBuf, presentes: HashSet<String>) -> Self {
        let estado = Arc::new((Mutex::new(Estado { presentes, ..Default::default() }), Condvar::new()));
        let e2 = estado.clone();
        std::thread::Builder::new()
            .name("wh-pacotes".into())
            .spawn(move || worker(base_url, physics_dir, visual_dir, e2))
            .expect("thread de pacotes");
        Self { estado }
    }
    /// Pede um hex (prioridade alta = vai para a frente da fila).
    pub fn pedir(&self, tile: &str, alta: bool) {
        let (m, cv) = &*self.estado;
        let mut s = m.lock().unwrap();
        if s.presentes.contains(tile) || s.baixando.as_deref() == Some(tile) || s.falhas.contains_key(tile) || (s.indice_ok && !s.indice.contains_key(tile)) {
            return;
        }
        if let Some(i) = s.fila.iter().position(|t| t == tile) {
            if !alta {
                return;
            }
            s.fila.remove(i);
        }
        if alta { s.fila.push_front(tile.to_string()) } else { s.fila.push_back(tile.to_string()) }
        cv.notify_one();
    }
    /// Hexes que ficaram prontos desde a última chamada.
    pub fn novos(&self) -> Vec<String> {
        std::mem::take(&mut self.estado.0.lock().unwrap().novos)
    }
    pub fn resumo(&self) -> serde_json::Value {
        let s = self.estado.0.lock().unwrap();
        serde_json::json!({"indiceOnline": s.indice_ok, "presentes": s.presentes.len(), "naFila": s.fila.len(), "baixando": s.baixando, "concluidos": s.concluidos, "mbBaixados": s.bytes_baixados as f64 / 1048576.0, "falhas": s.falhas.len()})
    }
    pub fn lista_presentes(&self) -> Vec<String> {
        let mut v: Vec<String> = self.estado.0.lock().unwrap().presentes.iter().cloned().collect();
        v.sort();
        v
    }
    pub fn tamanho(&self, tiles: &[String]) -> u64 {
        let s = self.estado.0.lock().unwrap();
        tiles.iter().filter_map(|t| s.indice.get(t).map(|x| x.0)).sum()
    }
}

fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new().timeout_connect(std::time::Duration::from_secs(10)).timeout_read(std::time::Duration::from_secs(60)).build()
}

fn worker(base: String, physics_dir: PathBuf, visual_dir: PathBuf, estado: Arc<(Mutex<Estado>, Condvar)>) {
    let ag = agent();
    // índice (sem rede: modo offline, só os hexes presentes)
    match ag.get(&format!("{base}hexes-v04.json")).call().map_err(|e| e.to_string()).and_then(|r| r.into_string().map_err(|e| e.to_string())).and_then(|t| serde_json::from_str::<serde_json::Value>(&t).map_err(|e| e.to_string())) {
        Ok(j) => {
            let mut s = estado.0.lock().unwrap();
            for (k, v) in j["hexes"].as_object().into_iter().flatten() {
                s.indice.insert(k.clone(), (v["bytes"].as_u64().unwrap_or(0), v["sha256"].as_str().unwrap_or("").to_string()));
            }
            s.indice_ok = true;
            eprintln!("[wh-server] pacotes de hex: índice online com {} hexes ({base})", s.indice.len());
        }
        Err(e) => eprintln!("[wh-server] pacotes de hex: índice indisponível ({e}); modo offline com os hexes presentes"),
    }
    loop {
        let tile = {
            let (m, cv) = &*estado;
            let mut s = m.lock().unwrap();
            while s.fila.is_empty() {
                s = cv.wait(s).unwrap();
            }
            let t = s.fila.pop_front().unwrap();
            if !s.indice_ok {
                s.falhas.insert(t.clone(), "sem índice online".into());
                continue;
            }
            s.baixando = Some(t.clone());
            t
        };
        let r = baixar(&ag, &base, &tile, &physics_dir, &visual_dir, &estado);
        let mut s = estado.0.lock().unwrap();
        s.baixando = None;
        match r {
            Ok(bytes) => {
                s.presentes.insert(tile.clone());
                s.novos.push(tile.clone());
                s.bytes_baixados += bytes;
                s.concluidos += 1;
                eprintln!("[wh-server] hex {tile} baixado e conferido ({:.1} MB)", bytes as f64 / 1048576.0);
            }
            Err(e) => {
                eprintln!("[wh-server] falha ao baixar hex {tile}: {e}");
                s.falhas.insert(tile, e);
            }
        }
    }
}

fn baixar(ag: &ureq::Agent, base: &str, tile: &str, physics_dir: &Path, visual_dir: &Path, estado: &Arc<(Mutex<Estado>, Condvar)>) -> Result<u64, String> {
    let (bytes, sha) = estado.0.lock().unwrap().indice.get(tile).cloned().ok_or("hex fora do índice")?;
    let resp = ag.get(&format!("{base}{}.zip", nome_arquivo(tile))).call().map_err(|e| e.to_string())?;
    let mut buf = Vec::with_capacity(bytes as usize);
    resp.into_reader().take(bytes + 1).read_to_end(&mut buf).map_err(|e| e.to_string())?;
    if buf.len() as u64 != bytes {
        return Err(format!("tamanho {} ≠ {}", buf.len(), bytes));
    }
    let got = hex::encode(Sha256::digest(&buf));
    if got != sha {
        return Err("SHA-256 não confere".into());
    }
    let mut z = zip::ZipArchive::new(std::io::Cursor::new(buf)).map_err(|e| e.to_string())?;
    for i in 0..z.len() {
        let mut f = z.by_index(i).map_err(|e| e.to_string())?;
        let name = f.name().to_string();
        let rel = Path::new(&name);
        if rel.components().any(|c| !matches!(c, Component::Normal(_))) {
            return Err(format!("caminho inválido no pacote: {name}"));
        }
        let mut comps = rel.components();
        let root = comps.next().and_then(|c| c.as_os_str().to_str()).unwrap_or("");
        let rest: PathBuf = comps.collect();
        let dest = match root { "physics" => physics_dir.join(rest), "visual" => visual_dir.join(rest), _ => continue };
        if f.is_dir() {
            std::fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
            continue;
        }
        if let Some(p) = dest.parent() {
            std::fs::create_dir_all(p).map_err(|e| e.to_string())?;
        }
        let tmp = dest.with_extension("parcial");
        let mut out = std::fs::File::create(&tmp).map_err(|e| e.to_string())?;
        std::io::copy(&mut f, &mut out).map_err(|e| e.to_string())?;
        out.flush().map_err(|e| e.to_string())?;
        std::fs::rename(&tmp, &dest).map_err(|e| e.to_string())?;
    }
    Ok(bytes)
}

/// Nome de arquivo seguro para o pacote (os IDs têm `+`, que URLs e o Windows aceitam mal).
pub fn nome_arquivo(tile: &str) -> String {
    tile.replace('+', "p").replace('-', "m")
}

mod hex {
    pub fn encode(b: impl AsRef<[u8]>) -> String {
        b.as_ref().iter().map(|x| format!("{x:02x}")).collect()
    }
}
