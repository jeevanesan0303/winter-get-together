
-- =====================================================
-- WINTER GET TOGETHER 2026
-- INITIAL DATABASE SCHEMA
-- Cloudflare D1 / SQLite
-- =====================================================

-- 1. APPLICANT REGISTRATIONS

CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY,

  applicant_full_name TEXT NOT NULL,
  date_of_birth TEXT NOT NULL,

  gender TEXT NOT NULL
    CHECK (gender IN ('Male', 'Female')),

  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  full_address TEXT NOT NULL,

  language TEXT NOT NULL DEFAULT 'ta'
    CHECK (language IN ('ta', 'en')),

  event_name TEXT NOT NULL
    DEFAULT 'WINTER GET TOGETHER',

  event_date TEXT NOT NULL
    DEFAULT '2026-12-13',

  agreed_to_terms INTEGER NOT NULL DEFAULT 0
    CHECK (agreed_to_terms IN (0, 1)),

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'submitted',
        'cancelled'
      )
    ),

  submission_token_hash TEXT,
  expires_at TEXT,

  created_at TEXT NOT NULL
    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  submitted_at TEXT,
  updated_at TEXT NOT NULL
    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  CHECK (phone GLOB '+44[0-9]*'),
  CHECK (length(phone) = 13)
);

CREATE INDEX IF NOT EXISTS idx_registrations_name
  ON registrations(applicant_full_name);

CREATE INDEX IF NOT EXISTS idx_registrations_email
  ON registrations(email);

CREATE INDEX IF NOT EXISTS idx_registrations_phone
  ON registrations(phone);

CREATE INDEX IF NOT EXISTS idx_registrations_status
  ON registrations(status);

CREATE INDEX IF NOT EXISTS idx_registrations_created
  ON registrations(created_at);

CREATE INDEX IF NOT EXISTS idx_registrations_submitted
  ON registrations(submitted_at);

CREATE INDEX IF NOT EXISTS idx_registrations_expires
  ON registrations(status, expires_at);


-- 2. ACHIEVEMENT QUESTIONS AND ANSWERS
-- One answer per question per applicant.
-- Empty answers are saved as NULL.

CREATE TABLE IF NOT EXISTS achievement_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  registration_id TEXT NOT NULL,

  question_id TEXT NOT NULL
    CHECK (
      question_id IN (
        'tamil_exam',
        'maths_competition',
        'grammar_school',
        'gcse',
        'gce_al',
        'university_degree',
        'other_achievements'
      )
    ),

  answer TEXT,

  created_at TEXT NOT NULL
    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  UNIQUE (registration_id, question_id),

  FOREIGN KEY (registration_id)
    REFERENCES registrations(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_answers_registration
  ON achievement_answers(registration_id);

CREATE INDEX IF NOT EXISTS idx_answers_question
  ON achievement_answers(question_id);


-- 3. APPLICANT UPLOADED CERTIFICATES

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,

  registration_id TEXT NOT NULL,
  question_id TEXT NOT NULL,

  applicant_name TEXT NOT NULL,

  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL,

  r2_object_key TEXT NOT NULL UNIQUE,

  mime_type TEXT NOT NULL
    CHECK (
      mime_type IN (
        'application/pdf',
        'image/jpeg',
        'image/png'
      )
    ),

  file_size_bytes INTEGER NOT NULL
    CHECK (
      file_size_bytes > 0
      AND file_size_bytes <= 20971520
    ),

  upload_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (
      upload_status IN (
        'pending',
        'uploaded',
        'verified',
        'rejected'
      )
    ),

  uploaded_at TEXT,
  verified_at TEXT,

  created_at TEXT NOT NULL
    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  UNIQUE (registration_id, question_id),

  FOREIGN KEY (registration_id)
    REFERENCES registrations(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_documents_registration
  ON documents(registration_id);

CREATE INDEX IF NOT EXISTS idx_documents_applicant
  ON documents(applicant_name);

CREATE INDEX IF NOT EXISTS idx_documents_status
  ON documents(upload_status);


-- 4. CONFIRMATION EMAIL TRACKING

CREATE TABLE IF NOT EXISTS email_messages (
  id TEXT PRIMARY KEY,

  registration_id TEXT NOT NULL,

  recipient_email TEXT NOT NULL,

  email_type TEXT NOT NULL
    DEFAULT 'registration_confirmation',

  language TEXT NOT NULL
    CHECK (language IN ('ta', 'en')),

  provider TEXT NOT NULL DEFAULT 'brevo',

  provider_message_id TEXT,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'sending',
        'accepted',
        'delivered',
        'failed',
        'bounced'
      )
    ),

  attempts INTEGER NOT NULL DEFAULT 0,

  last_error TEXT,
  next_attempt_at TEXT,

  created_at TEXT NOT NULL
    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  sent_at TEXT,
  delivered_at TEXT,

  FOREIGN KEY (registration_id)
    REFERENCES registrations(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_emails_registration
  ON email_messages(registration_id);

CREATE INDEX IF NOT EXISTS idx_emails_status
  ON email_messages(status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_emails_provider_id
  ON email_messages(provider_message_id);


-- 5. ADMINISTRATOR ACCOUNTS
-- No plaintext passwords are stored.

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,

  email TEXT NOT NULL UNIQUE,

  display_name TEXT NOT NULL,

  password_hash TEXT NOT NULL,

  role TEXT NOT NULL DEFAULT 'admin'
    CHECK (
      role IN ('admin', 'super_admin')
    ),

  is_active INTEGER NOT NULL DEFAULT 1
    CHECK (is_active IN (0, 1)),

  created_at TEXT NOT NULL
    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  last_login_at TEXT
);


-- 6. ADMINISTRATOR SESSIONS
-- Store a token hash, never the raw token.

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,

  admin_id TEXT NOT NULL,

  token_hash TEXT NOT NULL UNIQUE,

  expires_at TEXT NOT NULL,

  created_at TEXT NOT NULL
    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  revoked_at TEXT,

  FOREIGN KEY (admin_id)
    REFERENCES admin_users(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin
  ON admin_sessions(admin_id);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires
  ON admin_sessions(expires_at);


-- 7. ADMINISTRATOR AUDIT LOGS

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  admin_id TEXT,

  action TEXT NOT NULL,

  registration_id TEXT,

  details TEXT,

  created_at TEXT NOT NULL
    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  FOREIGN KEY (admin_id)
    REFERENCES admin_users(id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_created
  ON admin_audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_audit_registration
  ON admin_audit_logs(registration_id);
