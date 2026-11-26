-- Wildhaven Build Real v01 — esquema inicial.
-- Um mundo compartilhado (relógio global único); Hunters com posição GLOBAL (f64).
CREATE TABLE worlds (
    id              TEXT PRIMARY KEY,
    clock_epoch_ms  BIGINT NOT NULL,          -- época do relógio dia 2 h + noite 40 min
    seed            BIGINT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hunters (
    id                 TEXT PRIMARY KEY,
    world_id           TEXT NOT NULL REFERENCES worlds(id),
    name               TEXT NOT NULL,
    tile_id            TEXT NOT NULL,          -- hex de residência (muda só via portal validado)
    x                  DOUBLE PRECISION NOT NULL,
    y                  DOUBLE PRECISION NOT NULL,
    z                  DOUBLE PRECISION NOT NULL,
    heading            DOUBLE PRECISION NOT NULL DEFAULT 0,
    state              TEXT NOT NULL,
    distance_walked_m  DOUBLE PRECISION NOT NULL DEFAULT 0,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hunter_crossings (
    hunter_id   TEXT NOT NULL REFERENCES hunters(id),
    tick        BIGINT NOT NULL,
    sim_time_s  DOUBLE PRECISION NOT NULL,
    from_tile   TEXT NOT NULL,
    to_tile     TEXT NOT NULL,
    x           DOUBLE PRECISION NOT NULL,
    z           DOUBLE PRECISION NOT NULL,
    step_m      DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (hunter_id, tick)
);
