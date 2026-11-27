-- Wildhaven Build Real v01 — estado de gameplay da fatia demonstrável.
-- Hunters (habilidades, HP, inventário, MORTE PERMANENTE), bestiário, dinheiro,
-- carroças, acampamentos e expedições, salvos como documento versionado por mundo.
-- Criaturas e pegadas não são persistidas nesta versão (respawn determinístico por hex).
CREATE TABLE world_state (
    world_id    TEXT PRIMARY KEY REFERENCES worlds(id),
    schema      TEXT NOT NULL,
    state       JSONB NOT NULL,
    saved_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE hunters ADD COLUMN alive BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE hunters ADD COLUMN role TEXT NOT NULL DEFAULT 'hunter';
