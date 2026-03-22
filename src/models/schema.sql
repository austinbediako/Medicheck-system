-- =============================================================================
-- MediCheck Database Schema
-- Run: psql $DATABASE_URL -f src/models/schema.sql
--   or: npm run db:init
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Diagnoses — stores every inference result
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS diagnoses (
    id               SERIAL PRIMARY KEY,
    session_id       UUID             NOT NULL,
    symptoms         JSONB            NOT NULL,          -- string[] of submitted symptoms
    diagnosis        VARCHAR(100)     NOT NULL,
    confidence       VARCHAR(20)      NOT NULL CHECK (confidence IN ('high', 'medium', 'possible', 'none')),
    rules_fired      JSONB            NOT NULL DEFAULT '[]', -- string[] of rule IDs that fired
    matched_symptoms JSONB            NOT NULL DEFAULT '[]', -- string[] of symptoms that matched
    reasoning        TEXT             NOT NULL DEFAULT '',
    advice           TEXT             NOT NULL DEFAULT '',
    created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagnoses_session_id ON diagnoses (session_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_created_at ON diagnoses (created_at DESC);

-- ---------------------------------------------------------------------------
-- Symptoms catalog — used by GET /api/symptoms
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS symptoms_catalog (
    id               SERIAL PRIMARY KEY,
    name             VARCHAR(60)  NOT NULL UNIQUE,   -- atom identifier (e.g. "loose_stools")
    display_name     VARCHAR(100) NOT NULL,           -- human-readable (e.g. "Loose Stools")
    disease_category VARCHAR(60)  NOT NULL            -- "malaria" | "diarrhoea" | "HIV/AIDS"
);

-- Seed the catalog — all symptoms from the knowledge base
INSERT INTO symptoms_catalog (name, display_name, disease_category) VALUES
    -- Malaria
    ('fever',              'Fever',              'malaria'),
    ('chills',             'Chills',             'malaria'),
    ('headache',           'Headache',           'malaria'),
    ('sweating',           'Sweating',           'malaria'),
    ('muscle_pain',        'Muscle Pain',        'malaria'),
    ('nausea',             'Nausea',             'malaria'),
    ('vomiting',           'Vomiting',           'malaria'),

    -- Diarrhoea
    ('loose_stools',       'Loose Stools',       'diarrhoea'),
    ('stomach_cramps',     'Stomach Cramps',     'diarrhoea'),
    ('abdominal_pain',     'Abdominal Pain',     'diarrhoea'),
    ('dehydration',        'Dehydration',        'diarrhoea'),
    ('mild_fever',         'Mild Fever',         'diarrhoea'),
    ('loss_of_appetite',   'Loss of Appetite',   'diarrhoea'),
    ('bloating',           'Bloating',           'diarrhoea'),

    -- HIV/AIDS
    ('weight_loss',        'Weight Loss',        'HIV/AIDS'),
    ('persistent_fatigue', 'Persistent Fatigue', 'HIV/AIDS'),
    ('night_sweats',       'Night Sweats',       'HIV/AIDS'),
    ('swollen_lymph_nodes','Swollen Lymph Nodes','HIV/AIDS'),
    ('recurring_fever',    'Recurring Fever',    'HIV/AIDS'),
    ('oral_thrush',        'Oral Thrush',        'HIV/AIDS'),
    ('shortness_of_breath','Shortness of Breath','HIV/AIDS'),
    ('frequent_infections','Frequent Infections','HIV/AIDS')

ON CONFLICT (name) DO NOTHING;
