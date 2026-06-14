import Database from "better-sqlite3";
import path from "node:path";
import { applyOwnerOnlyFilePermissions, ensureOwnerOnlyDirectory, ensureRuntimeDataPermissions } from "./permissions";

const defaultDatabasePath = path.join(process.cwd(), "data", "nyc-apt-radar-loop.sqlite");

export function getDatabasePath() {
  const configured = process.env.NYC_APT_RADAR_DATABASE_PATH;
  return configured
    ? path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured)
    : defaultDatabasePath;
}

const databasePath = getDatabasePath();
ensureRuntimeDataPermissions(databasePath);

export const sqlite = new Database(databasePath);
sqlite.pragma("journal_mode = WAL");
ensureRuntimeDataPermissions(databasePath);

export function ensureDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY NOT NULL,
      source TEXT NOT NULL,
      source_url TEXT,
      title TEXT NOT NULL,
      address TEXT,
      neighborhood TEXT,
      borough TEXT,
      rent INTEGER,
      bedrooms REAL,
      bathrooms REAL,
      available_date TEXT,
      description TEXT NOT NULL,
      amenities TEXT NOT NULL,
      pets TEXT NOT NULL,
      fee_status TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      status TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      score INTEGER NOT NULL,
      score_explanation TEXT NOT NULL,
      contact_name TEXT,
      appointment_at TEXT,
      CHECK (status IN ('new', 'interested', 'contacted', 'scheduled', 'rejected', 'viewed', 'applied')),
      CHECK (pets IN ('cats_allowed', 'dogs_allowed', 'cats_and_dogs_allowed', 'no_pets', 'unknown')),
      CHECK (fee_status IN ('no_fee', 'broker_fee', 'unknown'))
    );

    CREATE INDEX IF NOT EXISTS listings_score_idx ON listings (score);
    CREATE INDEX IF NOT EXISTS listings_status_idx ON listings (status);
    CREATE INDEX IF NOT EXISTS listings_last_seen_at_idx ON listings (last_seen_at);

    CREATE TABLE IF NOT EXISTS source_events (
      id TEXT PRIMARY KEY NOT NULL,
      source_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_ref TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      raw_text TEXT NOT NULL,
      status TEXT NOT NULL,
      listings_found INTEGER NOT NULL,
      error_message TEXT,
      discovered_at TEXT NOT NULL,
      processed_at TEXT,
      UNIQUE (fingerprint)
    );

    CREATE INDEX IF NOT EXISTS source_events_discovered_at_idx ON source_events (discovered_at);
    CREATE INDEX IF NOT EXISTS source_events_status_idx ON source_events (status);

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY NOT NULL,
      listing_id TEXT NOT NULL,
      dedupe_key TEXT NOT NULL,
      channel TEXT NOT NULL,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL,
      sent_at TEXT,
      UNIQUE (dedupe_key)
    );

    CREATE INDEX IF NOT EXISTS notifications_listing_id_idx ON notifications (listing_id);
    CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications (created_at);

    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY NOT NULL,
      objective TEXT NOT NULL,
      mode TEXT NOT NULL,
      model TEXT,
      status TEXT NOT NULL,
      iterations INTEGER NOT NULL,
      summary TEXT,
      error_message TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      CHECK (mode IN ('openai')),
      CHECK (status IN ('running', 'completed', 'failed', 'skipped'))
    );

    CREATE INDEX IF NOT EXISTS agent_runs_started_at_idx ON agent_runs (started_at);
    CREATE INDEX IF NOT EXISTS agent_runs_status_idx ON agent_runs (status);

    CREATE TABLE IF NOT EXISTS agent_run_context (
      id TEXT PRIMARY KEY NOT NULL,
      run_id TEXT NOT NULL UNIQUE,
      objective TEXT NOT NULL,
      notification_mode TEXT NOT NULL,
      max_iterations INTEGER NOT NULL,
      active_experiment_id TEXT,
      resumed_operator_review_id TEXT,
      active_playbook_entry_ids_json TEXT NOT NULL,
      recent_reflection_ids_json TEXT NOT NULL,
      recent_evaluation_ids_json TEXT NOT NULL,
      recent_contract_audit_ids_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES agent_runs(id),
      FOREIGN KEY (active_experiment_id) REFERENCES agent_experiments(id),
      FOREIGN KEY (resumed_operator_review_id) REFERENCES agent_operator_reviews(id),
      CHECK (notification_mode IN ('send', 'dry-run', 'off')),
      CHECK (max_iterations > 0)
    );

    CREATE INDEX IF NOT EXISTS agent_run_context_run_id_idx ON agent_run_context (run_id);
    CREATE INDEX IF NOT EXISTS agent_run_context_experiment_idx ON agent_run_context (active_experiment_id);
    CREATE INDEX IF NOT EXISTS agent_run_context_review_idx ON agent_run_context (resumed_operator_review_id);

    CREATE TABLE IF NOT EXISTS agent_steps (
      id TEXT PRIMARY KEY NOT NULL,
      run_id TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      kind TEXT NOT NULL,
      tool_name TEXT,
      input_json TEXT NOT NULL,
      output_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES agent_runs(id),
      CHECK (kind IN ('model_response', 'tool_call', 'tool_result', 'final'))
    );

    CREATE INDEX IF NOT EXISTS agent_steps_run_id_idx ON agent_steps (run_id, step_index);

    CREATE TABLE IF NOT EXISTS agent_recommendations (
      id TEXT PRIMARY KEY NOT NULL,
      run_id TEXT NOT NULL,
      listing_id TEXT,
      priority TEXT NOT NULL,
      action_type TEXT NOT NULL,
      title TEXT NOT NULL,
      rationale TEXT NOT NULL,
      evidence_json TEXT NOT NULL DEFAULT '[]',
      proposed_status TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES agent_runs(id),
      CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
      CHECK (action_type IN ('inspect_listing', 'draft_outreach', 'status_update', 'search_adjustment', 'operator_review', 'config_change')),
      CHECK (status IN ('open', 'accepted', 'dismissed'))
    );

    CREATE INDEX IF NOT EXISTS agent_recommendations_run_id_idx ON agent_recommendations (run_id);
    CREATE INDEX IF NOT EXISTS agent_recommendations_listing_id_idx ON agent_recommendations (listing_id);

    CREATE TABLE IF NOT EXISTS agent_operator_reviews (
      id TEXT PRIMARY KEY NOT NULL,
      run_id TEXT NOT NULL,
      listing_id TEXT,
      urgency TEXT NOT NULL,
      question TEXT NOT NULL,
      options_json TEXT NOT NULL,
      recommended_option TEXT NOT NULL,
      rationale TEXT NOT NULL,
      evidence_json TEXT NOT NULL,
      blocking INTEGER NOT NULL,
      selected_option TEXT,
      operator_note TEXT,
      resolved_at TEXT,
      resume_run_id TEXT,
      resume_claimed_at TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES agent_runs(id),
      CHECK (urgency IN ('low', 'medium', 'high', 'urgent')),
      CHECK (blocking IN (0, 1)),
      CHECK (status IN ('open', 'answered', 'dismissed'))
    );

    CREATE INDEX IF NOT EXISTS agent_operator_reviews_run_id_idx ON agent_operator_reviews (run_id);
    CREATE INDEX IF NOT EXISTS agent_operator_reviews_status_idx ON agent_operator_reviews (status);
    CREATE INDEX IF NOT EXISTS agent_operator_reviews_listing_id_idx ON agent_operator_reviews (listing_id);
    CREATE INDEX IF NOT EXISTS agent_operator_reviews_resume_run_id_idx ON agent_operator_reviews (resume_run_id);

    CREATE TABLE IF NOT EXISTS agent_reflections (
      id TEXT PRIMARY KEY NOT NULL,
      run_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      outcome TEXT NOT NULL,
      summary TEXT NOT NULL,
      lessons_json TEXT NOT NULL,
      next_run_guidance TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES agent_runs(id),
      CHECK (score >= 0 AND score <= 100),
      CHECK (outcome IN ('useful', 'blocked', 'no_signal', 'unsafe', 'failed'))
    );

    CREATE INDEX IF NOT EXISTS agent_reflections_run_id_idx ON agent_reflections (run_id);
    CREATE INDEX IF NOT EXISTS agent_reflections_created_at_idx ON agent_reflections (created_at);

    CREATE TABLE IF NOT EXISTS agent_evaluations (
      id TEXT PRIMARY KEY NOT NULL,
      run_id TEXT NOT NULL,
      overall_score INTEGER NOT NULL,
      verdict TEXT NOT NULL,
      objective_alignment INTEGER NOT NULL,
      evidence_grounding INTEGER NOT NULL,
      tool_discipline INTEGER NOT NULL,
      safety_discipline INTEGER NOT NULL,
      operator_value INTEGER NOT NULL,
      learning_quality INTEGER NOT NULL,
      findings_json TEXT NOT NULL,
      next_experiment TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES agent_runs(id),
      CHECK (overall_score >= 0 AND overall_score <= 100),
      CHECK (objective_alignment >= 0 AND objective_alignment <= 100),
      CHECK (evidence_grounding >= 0 AND evidence_grounding <= 100),
      CHECK (tool_discipline >= 0 AND tool_discipline <= 100),
      CHECK (safety_discipline >= 0 AND safety_discipline <= 100),
      CHECK (operator_value >= 0 AND operator_value <= 100),
      CHECK (learning_quality >= 0 AND learning_quality <= 100),
      CHECK (verdict IN ('strong', 'useful', 'weak', 'unsafe', 'failed'))
    );

    CREATE INDEX IF NOT EXISTS agent_evaluations_run_id_idx ON agent_evaluations (run_id);
    CREATE INDEX IF NOT EXISTS agent_evaluations_created_at_idx ON agent_evaluations (created_at);
    CREATE INDEX IF NOT EXISTS agent_evaluations_score_idx ON agent_evaluations (overall_score);

    CREATE TABLE IF NOT EXISTS agent_experiments (
      id TEXT PRIMARY KEY NOT NULL,
      source_run_id TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL,
      started_run_id TEXT,
      completed_run_id TEXT,
      result_summary TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (source_run_id) REFERENCES agent_runs(id),
      FOREIGN KEY (started_run_id) REFERENCES agent_runs(id),
      FOREIGN KEY (completed_run_id) REFERENCES agent_runs(id),
      CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'skipped'))
    );

    CREATE INDEX IF NOT EXISTS agent_experiments_status_idx ON agent_experiments (status, created_at);
    CREATE INDEX IF NOT EXISTS agent_experiments_source_run_id_idx ON agent_experiments (source_run_id);
    CREATE INDEX IF NOT EXISTS agent_experiments_started_run_id_idx ON agent_experiments (started_run_id);

    CREATE TABLE IF NOT EXISTS agent_playbook_entries (
      id TEXT PRIMARY KEY NOT NULL,
      source_run_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      instruction TEXT NOT NULL,
      rationale TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (source_run_id) REFERENCES agent_runs(id),
      CHECK (kind IN ('policy', 'heuristic', 'anti_pattern', 'operator_preference')),
      CHECK (status IN ('active', 'superseded'))
    );

    CREATE INDEX IF NOT EXISTS agent_playbook_entries_status_idx ON agent_playbook_entries (status, created_at);
    CREATE INDEX IF NOT EXISTS agent_playbook_entries_source_run_id_idx ON agent_playbook_entries (source_run_id);

    CREATE TABLE IF NOT EXISTS agent_contract_audits (
      id TEXT PRIMARY KEY NOT NULL,
      run_id TEXT NOT NULL,
      status TEXT NOT NULL,
      score INTEGER NOT NULL,
      checks_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES agent_runs(id),
      CHECK (status IN ('pass', 'warn', 'fail')),
      CHECK (score >= 0 AND score <= 100)
    );

    CREATE INDEX IF NOT EXISTS agent_contract_audits_run_id_idx ON agent_contract_audits (run_id);
    CREATE INDEX IF NOT EXISTS agent_contract_audits_created_at_idx ON agent_contract_audits (created_at);

    CREATE TABLE IF NOT EXISTS agent_guardrail_events (
      id TEXT PRIMARY KEY NOT NULL,
      run_id TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      tool_name TEXT NOT NULL,
      decision TEXT NOT NULL,
      reason TEXT NOT NULL,
      input_json TEXT NOT NULL,
      effective_input_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES agent_runs(id),
      CHECK (decision IN ('allowed', 'rewritten', 'blocked'))
    );

    CREATE INDEX IF NOT EXISTS agent_guardrail_events_run_id_idx ON agent_guardrail_events (run_id, step_index);
    CREATE INDEX IF NOT EXISTS agent_guardrail_events_decision_idx ON agent_guardrail_events (decision);

    CREATE TABLE IF NOT EXISTS agent_working_memory (
      id TEXT PRIMARY KEY NOT NULL,
      run_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      focus TEXT NOT NULL,
      hypotheses_json TEXT NOT NULL,
      next_actions_json TEXT NOT NULL,
      open_questions_json TEXT NOT NULL,
      confidence REAL NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES agent_runs(id),
      CHECK (confidence >= 0 AND confidence <= 1)
    );

    CREATE INDEX IF NOT EXISTS agent_working_memory_run_id_idx ON agent_working_memory (run_id, revision);

    CREATE TABLE IF NOT EXISTS agent_run_plans (
      id TEXT PRIMARY KEY NOT NULL,
      run_id TEXT NOT NULL,
      objective TEXT NOT NULL,
      success_criteria_json TEXT NOT NULL,
      planned_steps_json TEXT NOT NULL,
      stop_conditions_json TEXT NOT NULL,
      risk_checks_json TEXT NOT NULL,
      confidence REAL NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES agent_runs(id),
      CHECK (confidence >= 0 AND confidence <= 1)
    );

    CREATE INDEX IF NOT EXISTS agent_run_plans_run_id_idx ON agent_run_plans (run_id, created_at);
  `);
  ensureColumn("agent_recommendations", "evidence_json", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn("agent_operator_reviews", "selected_option", "TEXT");
  ensureColumn("agent_operator_reviews", "operator_note", "TEXT");
  ensureColumn("agent_operator_reviews", "resolved_at", "TEXT");
  ensureColumn("agent_operator_reviews", "resume_run_id", "TEXT");
  ensureColumn("agent_operator_reviews", "resume_claimed_at", "TEXT");
  ensureTable("agent_run_context", `
    CREATE TABLE agent_run_context (
      id TEXT PRIMARY KEY NOT NULL,
      run_id TEXT NOT NULL UNIQUE,
      objective TEXT NOT NULL,
      notification_mode TEXT NOT NULL,
      max_iterations INTEGER NOT NULL,
      active_experiment_id TEXT,
      resumed_operator_review_id TEXT,
      active_playbook_entry_ids_json TEXT NOT NULL,
      recent_reflection_ids_json TEXT NOT NULL,
      recent_evaluation_ids_json TEXT NOT NULL,
      recent_contract_audit_ids_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES agent_runs(id),
      FOREIGN KEY (active_experiment_id) REFERENCES agent_experiments(id),
      FOREIGN KEY (resumed_operator_review_id) REFERENCES agent_operator_reviews(id),
      CHECK (notification_mode IN ('send', 'dry-run', 'off')),
      CHECK (max_iterations > 0)
    )
  `);
  ensureRuntimeDataPermissions(databasePath);
}

function ensureTable(tableName: string, createSql: string) {
  const row = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { name: string } | undefined;
  if (row) {
    return;
  }

  sqlite.exec(createSql);
}

function ensureColumn(tableName: string, columnName: string, definition: string) {
  const columns = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  sqlite.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

export async function backupDatabase(destinationPath: string) {
  ensureDatabase();
  ensureOwnerOnlyDirectory(path.dirname(destinationPath));
  await sqlite.backup(destinationPath);
  applyOwnerOnlyFilePermissions(destinationPath);
  return destinationPath;
}
