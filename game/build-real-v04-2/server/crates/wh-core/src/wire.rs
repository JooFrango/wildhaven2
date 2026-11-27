//! V03 — protocolo incremental do apresentador (JSON).
//!
//! O servidor envia o snapshot completo na conexão (e quando o cliente pede ressincronização) e, depois,
//! só as DIFERENÇAS em relação ao último estado que AQUELE cliente recebeu. O formato do patch:
//! - objeto comum: mescla campo a campo (`{"campo": patch}`); campo removido: `{"§":"x"}`;
//! - lista de objetos com `id` (ou `seq`): `{"§":"a","upd":{id: patch},"del":[ids],"ord":[ids]?}`
//!   (`ord` só quando a ordem mudou e a lista é ordenada);
//! - lista longa (≥ 16) de mesmo tamanho: `{"§":"i","n":tamanho,"set":{índice: patch}}`;
//! - qualquer outro valor: substituição.
//! Invariantes: aplicar `diff(a, b)` sobre `a` produz exatamente `b` (teste abaixo).
use serde_json::{Map, Value};

const MARK: &str = "§";

/// Listas cuja ordem não importa ao apresentador (não trafegam `ord`).
const UNORDERED: &[&str] = &["game.tracks", "game.creatures"];

fn key_of(v: &Value) -> Option<String> {
    let o = v.as_object()?;
    let k = o.get("id").or_else(|| o.get("seq"))?;
    match k {
        Value::String(s) => Some(s.clone()),
        Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

/// Diferença de `old` para `new`; `None` se iguais.
pub fn diff(old: &Value, new: &Value, path: &str) -> Option<Value> {
    if old == new {
        return None;
    }
    match (old, new) {
        (Value::Object(a), Value::Object(b)) if !b.contains_key(MARK) => {
            let mut out = Map::new();
            for (k, nv) in b {
                let p = if path.is_empty() { k.clone() } else { format!("{path}.{k}") };
                match a.get(k) {
                    Some(ov) => {
                        if let Some(d) = diff(ov, nv, &p) {
                            out.insert(k.clone(), d);
                        }
                    }
                    None => {
                        out.insert(k.clone(), full(nv));
                    }
                }
            }
            for k in a.keys() {
                if !b.contains_key(k) {
                    out.insert(k.clone(), serde_json::json!({ MARK: "x" }));
                }
            }
            if out.is_empty() { None } else { Some(Value::Object(out)) }
        }
        (Value::Array(a), Value::Array(b)) => {
            let keyed = !b.is_empty() && b.iter().all(|v| key_of(v).is_some()) && a.iter().all(|v| key_of(v).is_some());
            if keyed {
                let old: std::collections::HashMap<String, &Value> = a.iter().map(|v| (key_of(v).unwrap(), v)).collect();
                let mut upd = Map::new();
                let mut seen = std::collections::HashSet::new();
                for v in b {
                    let k = key_of(v).unwrap();
                    seen.insert(k.clone());
                    match old.get(&k) {
                        Some(ov) => {
                            if let Some(d) = diff(ov, v, path) {
                                upd.insert(k, d);
                            }
                        }
                        None => {
                            upd.insert(k, full(v));
                        }
                    }
                }
                let del: Vec<Value> = a.iter().filter_map(key_of).filter(|k| !seen.contains(k)).map(Value::String).collect();
                let mut out = Map::new();
                out.insert(MARK.into(), "a".into());
                if !upd.is_empty() {
                    out.insert("upd".into(), Value::Object(upd));
                }
                if !del.is_empty() {
                    out.insert("del".into(), Value::Array(del));
                }
                if !UNORDERED.contains(&path) {
                    // ordem esperada pelo cliente: antigos (sem os removidos) + novos na ordem de chegada
                    let mut expect: Vec<String> = a.iter().filter_map(key_of).filter(|k| seen.contains(k)).collect();
                    let olds: std::collections::HashSet<&String> = old.keys().collect();
                    expect.extend(b.iter().filter_map(key_of).filter(|k| !olds.contains(k)));
                    let actual: Vec<String> = b.iter().filter_map(key_of).collect();
                    if expect != actual {
                        out.insert("ord".into(), Value::Array(actual.into_iter().map(Value::String).collect()));
                    }
                }
                if out.len() == 1 { None } else { Some(Value::Object(out)) }
            } else if a.len() == b.len() && b.len() >= 16 {
                let mut set = Map::new();
                for (i, (ov, nv)) in a.iter().zip(b).enumerate() {
                    if let Some(d) = diff(ov, nv, path) {
                        set.insert(i.to_string(), d);
                    }
                }
                Some(serde_json::json!({ MARK: "i", "n": b.len(), "set": set }))
            } else {
                Some(full(new))
            }
        }
        _ => Some(full(new)),
    }
}

/// Valor completo no fio. Objetos com a marca reservada não existem no estado (não precisam de escape).
fn full(v: &Value) -> Value {
    v.clone()
}

/// Aplicação do patch (mesma semântica do cliente TypeScript; usada nos testes de ida e volta).
pub fn apply(target: &Value, patch: &Value) -> Value {
    match patch {
        Value::Object(p) => match p.get(MARK).and_then(|m| m.as_str()) {
            Some("a") => {
                let old = target.as_array().cloned().unwrap_or_default();
                let del: std::collections::HashSet<String> = p.get("del").and_then(|d| d.as_array()).map(|d| d.iter().filter_map(|x| x.as_str().map(String::from)).collect()).unwrap_or_default();
                let upd = p.get("upd").and_then(|u| u.as_object()).cloned().unwrap_or_default();
                let mut out: Vec<(String, Value)> = vec![];
                for v in old {
                    let k = key_of(&v).unwrap_or_default();
                    if del.contains(&k) {
                        continue;
                    }
                    let nv = match upd.get(&k) { Some(d) => apply(&v, d), None => v };
                    out.push((k, nv));
                }
                let have: std::collections::HashSet<String> = out.iter().map(|(k, _)| k.clone()).collect();
                for (k, d) in &upd {
                    if !have.contains(k) {
                        out.push((k.clone(), apply(&Value::Null, d)));
                    }
                }
                if let Some(ord) = p.get("ord").and_then(|o| o.as_array()) {
                    let mut m: std::collections::HashMap<String, Value> = out.into_iter().collect();
                    return Value::Array(ord.iter().filter_map(|k| k.as_str().and_then(|k| m.remove(k))).collect());
                }
                Value::Array(out.into_iter().map(|(_, v)| v).collect())
            }
            Some("i") => {
                let mut old = target.as_array().cloned().unwrap_or_default();
                let n = p.get("n").and_then(|n| n.as_u64()).unwrap_or(0) as usize;
                old.resize(n, Value::Null);
                if let Some(set) = p.get("set").and_then(|s| s.as_object()) {
                    for (i, d) in set {
                        if let Ok(i) = i.parse::<usize>() {
                            if i < old.len() {
                                old[i] = apply(&old[i], d);
                            }
                        }
                    }
                }
                Value::Array(old)
            }
            _ => {
                let mut out = target.as_object().cloned().unwrap_or_default();
                for (k, d) in p {
                    if d.get(MARK).and_then(|m| m.as_str()) == Some("x") {
                        out.remove(k);
                    } else {
                        let base = out.get(k).cloned().unwrap_or(Value::Null);
                        out.insert(k.clone(), apply(&base, d));
                    }
                }
                Value::Object(out)
            }
        },
        other => other.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn roundtrip() {
        let a = json!({"tick":1,"hunters":[{"id":"h1","x":1.0,"inv":["a"]},{"id":"h2","x":2.0}],"game":{"tracks":[{"id":1,"x":0},{"id":2,"x":1}],"events":[{"seq":3,"t":"c"},{"seq":2,"t":"b"}],"nodes":(0..20).map(|i| json!([i, "limpo"])).collect::<Vec<_>>(),"gone":1}});
        let b = json!({"tick":2,"hunters":[{"id":"h2","x":2.5},{"id":"h1","x":1.0,"inv":["a","b"]},{"id":"h3","x":0.0}],"game":{"tracks":[{"id":2,"x":1},{"id":4,"x":9}],"events":[{"seq":4,"t":"d"},{"seq":3,"t":"c"}],"nodes":(0..20).map(|i| json!([i, if i == 7 {"chuva"} else {"limpo"}])).collect::<Vec<_>>()}});
        let d = diff(&a, &b, "").unwrap();
        let mut c = apply(&a, &d);
        // listas sem ordem: compara como conjunto
        let sort = |v: &mut Value| { if let Some(t) = v["game"]["tracks"].as_array_mut() { t.sort_by_key(|x| x["id"].as_i64()); } };
        sort(&mut c);
        assert_eq!(c, b);
        assert!(diff(&b, &b, "").is_none());
        assert!(d.to_string().len() < b.to_string().len());
    }
}
