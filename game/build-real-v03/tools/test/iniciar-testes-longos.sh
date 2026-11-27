#!/bin/bash
# Reinicia os servidores em MODO LEVE (como o ZIP: só os 7 hexes) e os testes longos da V03, em segundo plano.
# Uso (da raiz do repositório): game/build-real-v03/tools/test/iniciar-testes-longos.sh [minutos_eco_oculto] [minutos_3d]
set -u
R=$(cd "$(dirname "$0")/../../../.." && pwd); cd "$R"
ME=${1:-120}; M3=${2:-30}
mkdir -p .generated/physics-light
for t in HV_01 ER_18 ER_21 ER_22 ER_24 ER_25 FX_20; do ln -sfn ../physics-272/$t-physics-v01 .generated/physics-light/$t-physics-v01; done
pkill -f "build-real-v03/server/target/release/wh-server"; sleep 1
for port in 8791 8792 8793; do
  WH_REPO_ROOT=$R WH_BIND=127.0.0.1:$port WH_PHYSICS_DIR=.generated/physics-light WH_CACHE_MB=128 nohup game/build-real-v03/server/target/release/wh-server > /tmp/srv$port.log 2>&1 &
done
sleep 5
pid() { for p in $(pgrep -f build-real-v03/server/target/release/wh-server); do grep -q "WH_BIND=127.0.0.1:$1" /proc/$p/environ 2>/dev/null && echo $p; done; }
cd game/build-real-v03
nohup node tools/test/longa-duracao.mjs --url http://127.0.0.1:8792/ --modo economico --minutos $ME --server-pid $(pid 8792) --out bench/longa-economico-2h.json > /tmp/longa-eco.log 2>&1 &
nohup node tools/test/longa-duracao.mjs --url http://127.0.0.1:8793/ --modo oculto --minutos $ME --server-pid $(pid 8793) --out bench/longa-oculto-2h.json > /tmp/longa-oculto.log 2>&1 &
nohup node tools/test/longa-duracao.mjs --url http://127.0.0.1:8791/ --modo 3d --perfil baixo --minutos $M3 --server-pid $(pid 8791) --out bench/longa-3d-baixo-30min.json > /tmp/longa-3d.log 2>&1 &
echo "iniciado $(date -u +%H:%M) UTC"
