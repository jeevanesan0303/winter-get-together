
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import fontkit from "@pdf-lib/fontkit";

// =====================================================
// TYPES AND CONFIGURATION
// =====================================================

interface AdminEnv {
  DB: D1Database;
  DOCUMENTS: R2Bucket;
}

interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  role: string;
  password_hash: string;
}

interface SessionUser {
  id: string;
  email: string;
  display_name: string;
  role: string;
}

interface ApplicantRecord {
  id: string;
  applicant_full_name: string;
  date_of_birth: string;
  gender: string;
  phone: string;
  email: string;
  full_address: string;
  language: string;
  event_name: string | null;
  event_date: string | null;
  agreed_to_terms: number;
  status: string;
  created_at: string;
  submitted_at: string | null;
  updated_at: string | null;
}

interface AchievementRow {
  question_id: string;
  answer: string | null;
}

interface DocumentRow {
  id: string;
  question_id: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  upload_status: string;
}

interface DownloadableDocument {
  original_filename: string;
  mime_type: string;
  r2_object_key: string;
}

interface EmailRow {
  id: string;
  recipient_email: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
}

interface CsvApplicantRow extends ApplicantRecord {
  document_count: number;
  email_status: string | null;
}


const ADMIN_ORIGINS = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "https://winter-get-together.purple-forest-fa52.workers.dev",
]);


const PDF_FONT_R2_KEY =
  "system/fonts/NotoSansTamil-Regular.ttf";

const QUESTIONS = [
  {
    id: "tamil_exam",
    label: "Tamil Examination",
    english: "Have you achieved Excellent or Very Good in the Tamil examination conducted by the Tamil Development Council?",
    tamil: "தமிழ் மேம்பாட்டுப் பேரவையின் தமிழ்ப் பரீட்சையில் Excellent அல்லது Very Good பெற்றுள்ளீர்களா?",
  },
  {
    id: "maths_competition",
    label: "Chithambara Mathematics Competition",
    english: "Have you achieved Grade A or A* in the Chithambara Mathematics Competition?",
    tamil: "சிதம்பரக் கணிதப் போட்டியில் A அல்லது A* தரத்தைப் பெற்றுள்ளீர்களா?",
  },
  {
    id: "grammar_school",
    label: "Grammar School Examination",
    english: "Have you passed the Grammar School entrance examination?",
    tamil: "Grammar School தேர்வில் தேர்ச்சி பெற்றுள்ளீர்களா?",
  },
  {
    id: "gcse",
    label: "GCSE Examination",
    english: "Have you achieved at least five A grades (New Grade 5 Seven) in your GCSE examinations?",
    tamil: "GCSE பரீட்சையில் குறைந்தபட்சம் 5A (New Grade 5 Seven) பெற்றுள்ளீர்களா?",
  },
  {
    id: "gce_al",
    label: "GCE A-Level",
    english: "Have you achieved Grade A or B in your GCE A-Level examinations?",
    tamil: "GCE A/L பரீட்சையில் A, B பெறுபேறுகளைப் பெற்றுள்ளீர்களா?",
  },
  {
    id: "university_degree",
    label: "University Degree",
    english: "Have you obtained a university degree?",
    tamil: "பல்கலைக்கழகத்தில் பட்டம் பெற்றுள்ளீர்களா?",
  },
  {
    id: "other_achievements",
    label: "Arts, Culture & Sports Achievements",
    english: "Have you received any awards, prizes or achievements in arts, culture or sports?",
    tamil: "கலை, கலாசாரம் மற்றும் விளையாட்டுத் துறைகளில் சாதனைகள் அல்லது பரிசுகள் பெற்றுள்ளீர்களா?",
  },
] as const;

const PDF_TRANSLATIONS = {
  ta: {
    title: "விண்ணப்பதாரர் பதிவு அறிக்கை",
    registrationId: "பதிவு இலக்கம்",
    status: "பதிவு நிலை",
    submittedAt: "சமர்ப்பிக்கப்பட்ட நேரம்",
    personal: "தனிப்பட்ட தகவல்கள்",
    fullName: "விண்ணப்பதாரரின் முழுப் பெயர்",
    dob: "பிறந்த தேதி",
    gender: "பாலினம்",
    phone: "தொடர்பு இலக்கம்",
    email: "மின்னஞ்சல் முகவரி",
    address: "முழு முகவரி",
    language: "படிவ மொழி",
    consent: "ஒப்புதல் வழங்கப்பட்டது",
    achievements: "சாதனைகள் மற்றும் தகுதிகள்",
    answer: "பதில்",
    notAnswered: "தெரிவுசெய்யப்படவில்லை",
    certificates: "இணைக்கப்பட்ட சான்றிதழ்கள்",
    noCertificates: "சான்றிதழ்கள் பதிவேற்றப்படவில்லை.",
    event: "நிகழ்வு விவரங்கள்",
    eventName: "நிகழ்வு",
    eventDate: "நிகழ்வு தேதி",
    eventTime: "நிகழ்வு நேரம்",
    venue: "நிகழ்வு இடம்",
    footer: "அங்கீகரிக்கப்பட்ட நிகழ்வு நிர்வாகப் பயன்பாட்டிற்காக உருவாக்கப்பட்டது.",
    yes: "ஆம்",
    no: "இல்லை",
    male: "ஆண்",
    female: "பெண்",
    tamil: "தமிழ்",
    english: "ஆங்கிலம்",
    pending: "நிலுவையில்",
    submitted: "சமர்ப்பிக்கப்பட்டது",
  },
  en: {
    title: "APPLICANT REGISTRATION REPORT",
    registrationId: "Registration ID",
    status: "Registration Status",
    submittedAt: "Submitted At",
    personal: "PERSONAL INFORMATION",
    fullName: "Applicant Full Name",
    dob: "Date of Birth",
    gender: "Gender",
    phone: "Contact Number",
    email: "Email Address",
    address: "Full Address",
    language: "Form Language",
    consent: "Consent Given",
    achievements: "ACHIEVEMENTS AND QUALIFICATIONS",
    answer: "Answer",
    notAnswered: "Not answered",
    certificates: "SUPPORTING CERTIFICATES",
    noCertificates: "No supporting certificates uploaded.",
    event: "EVENT INFORMATION",
    eventName: "Event",
    eventDate: "Event Date",
    eventTime: "Event Time",
    venue: "Venue",
    footer: "Generated for authorized event administration.",
    yes: "Yes",
    no: "No",
    male: "Male",
    female: "Female",
    tamil: "Tamil",
    english: "English",
    pending: "Pending",
    submitted: "Submitted",
  },
} as const;

function pdfAnswer(answer: string | null | undefined, tamil: boolean): string {
  if (!answer) return tamil ? PDF_TRANSLATIONS.ta.notAnswered : PDF_TRANSLATIONS.en.notAnswered;
  if (tamil) return answer;
  const labels: Record<string, string> = {
    "ஆம்": "Yes",
    "இல்லை": "No",
    "தேர்ச்சி பெற்றுள்ளேன்": "Passed",
    "தேர்ச்சி பெறவில்லை": "Not Passed",
  };
  return labels[answer] ?? answer;
}

const CSV_BATCH_SIZE = 200;

// =====================================================
// GENERAL HTTP RESPONSE HELPERS
// =====================================================

function setAdminCors(
  headers: Headers,
  origin: string
): void {
  if (ADMIN_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set(
      "Access-Control-Expose-Headers",
      "Content-Disposition"
    );
  }
}

function apiJSON(
  data: unknown,
  status = 200,
  origin = ""
): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });

  setAdminCors(headers, origin);

  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

function fileResponse(
  body: BodyInit,
  mimeType: string,
  filename: string,
  origin: string
): Response {
  const safeAsciiName = filename
    .replaceAll("\r", "_")
    .replaceAll("\n", "_")
    .replace(/["\\]/g, "_")
    .replace(/[^\x20-\x7e]/g, "_")
    .slice(0, 180);
  const safeUnicodeName = filename
    .replaceAll("\r", "_")
    .replaceAll("\n", "_")
    .replace(/["\\]/g, "_")
    .slice(0, 180);
  const headers = new Headers({
    "Content-Type": mimeType,
    "Content-Disposition":
      `attachment; filename="${safeAsciiName}"; filename*=UTF-8''${encodeURIComponent(safeUnicodeName)}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  });
  setAdminCors(headers, origin);
  return new Response(body, { status: 200, headers });
}

function safeFilename(value: string): string {
  return (
    value
      .normalize("NFC")
      .replace(/[^\p{L}\p{N}_-]+/gu, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 70) || "Applicant"
  );
}

// =====================================================
// PASSWORD AND SESSION CRYPTOGRAPHY
// =====================================================

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}

function fromHex(hex: string): Uint8Array {
  if (
    !hex ||
    !/^(?:[0-9a-f]{2})+$/i.test(hex)
  ) {
    throw new Error("Invalid hash encoding");
  }

  const matches = hex.match(/.{2}/g);

  if (!matches) {
    throw new Error("Invalid hash encoding");
  }

  return Uint8Array.from(
    matches.map((part) =>
      parseInt(part, 16)
    )
  );
}

async function sha256(
  value: string
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );

  return toHex(
    new Uint8Array(digest)
  );
}

async function checkPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const parts = storedHash.split("$");

  if (
    parts.length !== 4 ||
    parts[0] !== "pbkdf2_sha256"
  ) {
    return false;
  }

  const iterations = Number(parts[1]);

  if (
    !Number.isInteger(iterations) ||
    iterations < 210000 ||
    iterations > 1000000
  ) {
    return false;
  }

  const salt = fromHex(parts[2]);
  const expected = fromHex(parts[3]);

  if (
    salt.length !== 16 ||
    expected.length !== 32
  ) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derived = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: new Uint8Array(salt),
        iterations,
        hash: "SHA-256",
      },
      key,
      256
    )
  );

  let difference = 0;

  for (
    let i = 0;
    i <expected.length;
    i++
  ) {
    difference |= derived[i] ^ expected[i];
  }

  return difference === 0;
}

async function authenticatedAdmin(
  request: Request,
  env: AdminEnv
): Promise<SessionUser | null> {
  const authorization =
    request.headers.get("Authorization") ?? "";

  const match =
    /^Bearer ([A-Za-z0-9_-]{32,256})$/.exec(
      authorization
    );

  if (!match) {
    return null;
  }

  const tokenHash = await sha256(match[1]);

  return env.DB.prepare(
    `SELECT
      a.id,
      a.email,
      a.display_name,
      a.role
     FROM admin_sessions s
     JOIN admin_users a
       ON a.id = s.admin_id
     WHERE s.token_hash = ?
       AND s.revoked_at IS NULL
       AND s.expires_at > ?
       AND a.is_active = 1
     LIMIT 1`
  )
    .bind(
      tokenHash,
      new Date().toISOString()
    )
    .first<SessionUser>();
}

async function addAudit(
  env: AdminEnv,
  adminId: string,
  action: string,
  registrationId: string | null = null
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO admin_audit_logs
       (admin_id, action, registration_id)
       VALUES (?, ?, ?)`
    )
      .bind(
        adminId,
        action,
        registrationId
      )
      .run();
  } catch (error) {
    console.error(
      "Admin audit failed:",
      error
    );
  }
}

// =====================================================
// DATABASE HELPERS
// =====================================================

async function getApplicant(
  env: AdminEnv,
  id: string
): Promise<ApplicantRecord | null> {
  return env.DB.prepare(
    `SELECT
      id,
      applicant_full_name,
      date_of_birth,
      gender,
      phone,
      email,
      full_address,
      language,
      event_name,
      event_date,
      agreed_to_terms,
      status,
      created_at,
      submitted_at,
      updated_at
     FROM registrations
     WHERE id = ?
     LIMIT 1`
  )
    .bind(id)
    .first<ApplicantRecord>();
}

async function getAnswers(
  env: AdminEnv,
  registrationId: string
): Promise<AchievementRow[]> {
  const result = await env.DB.prepare(
    `SELECT
      question_id,
      answer
     FROM achievement_answers
     WHERE registration_id = ?`
  )
    .bind(registrationId)
    .all<AchievementRow>();

  return result.results;
}

async function getDocuments(
  env: AdminEnv,
  registrationId: string
): Promise<DocumentRow[]> {
  const result = await env.DB.prepare(
    `SELECT
      id,
      question_id,
      original_filename,
      mime_type,
      file_size_bytes,
      upload_status
     FROM documents
     WHERE registration_id = ?
     ORDER BY question_id, uploaded_at`
  )
    .bind(registrationId)
    .all<DocumentRow>();

  return result.results;
}

async function getEmailMessages(
  env: AdminEnv,
  registrationId: string
): Promise<EmailRow[]> {
  const result = await env.DB.prepare(
    `SELECT
      id,
      recipient_email,
      status,
      attempts,
      last_error,
      created_at,
      sent_at
     FROM email_messages
     WHERE registration_id = ?
     ORDER BY created_at DESC`
  )
    .bind(registrationId)
    .all<EmailRow>();

  return result.results;
}

// =====================================================
// CSV HELPERS
// =====================================================

function csvCell(value: unknown): string {
  // Keep every CSV value on one row and remove control characters.
  let valueText = Array.from(String(value ?? ""))
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? " " : character;
    })
    .join("");

  // Excel and other spreadsheet tools may execute leading formulas.
  // A leading apostrophe forces these values to be treated as text.
  const firstVisible = valueText.trimStart().charAt(0);
  if (["=", "+", "-", "@"].includes(firstVisible)) {
    valueText = `'${valueText}`;
  }

  return `"${valueText.replaceAll('"', '""')}"`;
}

function csvLine(
  values: unknown[]
): string {
  return (
    values.map(csvCell).join(",") + "\r\n"
  );
}

function getCsvHeaders(): string[] {
  return [
    "Registration ID",
    "Applicant Full Name",
    "Date of Birth",
    "Gender",
    "Contact Number",
    "Email Address",
    "Full Address",
    "Form Language",
    "Event Name",
    "Event Date",
    "Consent Given",
    "Registration Status",
    "Created At",
    "Submitted At",
    ...QUESTIONS.map((q) => q.label),
    "Certificate Count",
    "Email Status",
  ];
}

async function getCsvBatch(
  env: AdminEnv,
  limit: number,
  offset: number
): Promise<{
  rows: CsvApplicantRow[];
  answers: Map<string, Map<string, string>>;
}> {
  const query = await env.DB.prepare(
    `SELECT
      r.id,
      r.applicant_full_name,
      r.date_of_birth,
      r.gender,
      r.phone,
      r.email,
      r.full_address,
      r.language,
      r.event_name,
      r.event_date,
      r.agreed_to_terms,
      r.status,
      r.created_at,
      r.submitted_at,
      r.updated_at,
      (
        SELECT COUNT(*)
        FROM documents d
        WHERE d.registration_id = r.id
          AND d.upload_status = 'verified'
      ) AS document_count,
      (
        SELECT e.status
        FROM email_messages e
        WHERE e.registration_id = r.id
        ORDER BY e.created_at DESC
        LIMIT 1
      ) AS email_status
     FROM registrations r
     ORDER BY r.created_at ASC, r.id ASC
     LIMIT ? OFFSET ?`
  )
    .bind(limit, offset)
    .all<CsvApplicantRow>();

  const rows = query.results;

  const answerMap = new Map<
    string,
    Map<string, string>
  >();

  if (rows.length === 0) {
    return {
      rows,
      answers: answerMap,
    };
  }

  const placeholders = rows
    .map(() => "?")
    .join(",");

  const answerResults =
    await env.DB.prepare(
      `SELECT
        registration_id,
        question_id,
        answer
       FROM achievement_answers
       WHERE registration_id IN (${placeholders})`
    )
      .bind(...rows.map((row) => row.id))
      .all<{
        registration_id: string;
        question_id: string;
        answer: string | null;
      }>();

  for (const answer of answerResults.results) {
    let applicantAnswers =
      answerMap.get(
        answer.registration_id
      );

    if (!applicantAnswers) {
      applicantAnswers =
        new Map<string, string>();

      answerMap.set(
        answer.registration_id,
        applicantAnswers
      );
    }

    applicantAnswers.set(
      answer.question_id,
      answer.answer ?? ""
    );
  }

  return {
    rows,
    answers: answerMap,
  };
}

function exportAllCsv(
  env: AdminEnv,
  origin: string
): Response {
  const encoder = new TextEncoder();

  let offset = 0;
  let headerWritten = false;
  let finished = false;

  const stream =
    new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (finished) {
          controller.close();
          return;
        }

        try {
          if (!headerWritten) {
            headerWritten = true;

            controller.enqueue(
              encoder.encode(
                "\uFEFF" +
                  csvLine(
                    getCsvHeaders()
                  )
              )
            );

            return;
          }

          const batch =
            await getCsvBatch(
              env,
              CSV_BATCH_SIZE,
              offset
            );

          if (batch.rows.length === 0) {
            finished = true;
            controller.close();
            return;
          }

          const csvContent =
            batch.rows
              .map((row) => {
                const answers =
                  batch.answers.get(
                    row.id
                  ) ??
                  new Map<string, string>();

                return csvLine([
                  row.id,
                  row.applicant_full_name,
                  row.date_of_birth,
                  row.gender,
                  row.phone,
                  row.email,
                  row.full_address,
                  row.language === "ta"
                    ? "Tamil"
                    : "English",
                  row.event_name ??
                    "Winter Get Together",
                  row.event_date ??
                    "13.12.2026",
                  row.agreed_to_terms
                    ? "Yes"
                    : "No",
                  row.status,
                  row.created_at,
                  row.submitted_at ?? "",
                  ...QUESTIONS.map(
                    (question) =>
                      answers.get(
                        question.id
                      ) ?? ""
                  ),
                  row.document_count,
                  row.email_status ??
                    "Not queued",
                ]);
              })
              .join("");

          controller.enqueue(
            encoder.encode(csvContent)
          );

          offset += batch.rows.length;

          if (
            batch.rows.length <
            CSV_BATCH_SIZE
          ) {
            finished = true;
            controller.close();
          }
        } catch (error) {
          console.error(
            "CSV export error:",
            error
          );

          controller.error(error);
        }
      },

      cancel() {
        finished = true;
      },
    });

  const filename =
    "Winter_Get_Together_Registrations_2026.csv";

  return fileResponse(
    stream,
    "text/csv; charset=utf-8",
    filename,
    origin
  );
}

// =====================================================
// BILINGUAL APPLICANT PDF
// =====================================================

const PDF_WIDTH = 595.28;
const PDF_HEIGHT = 841.89;
const PDF_MARGIN = 43;
const PDF_CONTENT_WIDTH = PDF_WIDTH - 2 * PDF_MARGIN;
const PDF_NAVY = rgb(0.06, 0.14, 0.34);
const PDF_PURPLE = rgb(0.35, 0.25, 0.80);
const PDF_MUTED = rgb(0.39, 0.45, 0.57);
const PDF_LINE = rgb(0.87, 0.90, 0.96);

function pdfCleanText(value: unknown): string {
  const input = String(value ?? "—")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n");
  const cleaned = Array.from(input).filter((character) => {
    const code = character.charCodeAt(0);
    return code === 10 || code >= 32;
  }).join("").trim();
  return cleaned || "—";
}

// Route Tamil code points to Noto Sans Tamil and Latin characters
// to Helvetica. Never ask Helvetica to encode characters outside WinAnsi.
// A fallback is used for unknown characters instead of crashing a PDF.
function scriptRuns(text: string, latinFont: PDFFont, tamilFont: PDFFont) {
  const runs: { text: string; font: PDFFont }[] = [];
  const latinCodes = new Set(latinFont.getCharacterSet());
  const tamilCodes = new Set(tamilFont.getCharacterSet());
  let lastFont: PDFFont | null = null;

  for (const character of Array.from(text.normalize("NFC"))) {
    const code = character.codePointAt(0) ?? 0;
    const isTamil = code >= 0x0b80 && code <= 0x0bff;
    let selected: PDFFont;
    let displayed = character;

    if (isTamil) {
      if (!tamilCodes.has(code)) {
        throw new Error(`PDF_TAMIL_GLYPH_MISSING: U+${code.toString(16).toUpperCase()}`);
      }
      selected = tamilFont;
    } else if (latinCodes.has(code)) {
      selected = latinFont;
    } else if (tamilCodes.has(code)) {
      selected = tamilFont;
    } else {
      // Avoid 500 errors for exotic punctuation in applicant-entered text.
      selected = latinFont;
      displayed = "?";
      console.warn(`PDF font fallback: unsupported U+${code.toString(16).toUpperCase()}`);
    }

    if (lastFont === selected && runs.length) {
      runs[runs.length - 1].text += displayed;
    } else {
      runs.push({ text: displayed, font: selected });
      lastFont = selected;
    }
  }
  return runs;
}

function measureMixed(
  value: string,
  size: number,
  latinFont: PDFFont,
  tamilFont: PDFFont
): number {
  return scriptRuns(value, latinFont, tamilFont).reduce(
    (sum, run) => sum + run.font.widthOfTextAtSize(run.text, size), 0
  );
}

// Never split a Tamil combining sequence while wrapping.
function wrapMixed(
  value: string,
  size: number,
  width: number,
  latinFont: PDFFont,
  tamilFont: PDFFont
): string[] {
  const lines: string[] = [];
  for (const paragraph of pdfCleanText(value).split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (measureMixed(candidate, size, latinFont, tamilFont) <= width) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : ["—"];
}

async function buildApplicantPdf(
  env: AdminEnv,
  registration: ApplicantRecord,
  answers: AchievementRow[],
  documents: DocumentRow[]
): Promise<Uint8Array> {
  const storedFont = await env.DOCUMENTS.get(PDF_FONT_R2_KEY);
  if (!storedFont) throw new Error("PDF_FONT_MISSING");

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  // The font is small (~59 KB); embedding it whole avoids subsetting
  // complications with Tamil OpenType glyph substitution.
  const tamilFont = await pdf.embedFont(await storedFont.arrayBuffer(), {
    subset: false,
  });
  const latinFont = await pdf.embedFont(StandardFonts.Helvetica);
  const supported = new Set(tamilFont.getCharacterSet());
  // The Supplement font does not cover ordinary Tamil. Fail explicitly
  // instead of silently producing blank applicant names and addresses.
  const requiredTamilCodepoints = [0x0b85, 0x0ba4, 0x0bae, 0x0bbf, 0x0bcd];
  if (requiredTamilCodepoints.some((code) => !supported.has(code))) {
    throw new Error("PDF_FONT_NOT_TAMIL");
  }

  pdf.setTitle(`Winter Get Together - ${registration.id}`);
  pdf.setAuthor("Winter Get Together Administration");
  pdf.setSubject("Applicant Registration Report");

  const tamil = registration.language === "ta";
  const t = tamil ? PDF_TRANSLATIONS.ta : PDF_TRANSLATIONS.en;
  let page: PDFPage = pdf.addPage([PDF_WIDTH, PDF_HEIGHT]);
  let y = PDF_HEIGHT - PDF_MARGIN;

  function ensureSpace(required: number) {
    if (y - required < PDF_MARGIN + 20) {
      page = pdf.addPage([PDF_WIDTH, PDF_HEIGHT]);
      y = PDF_HEIGHT - PDF_MARGIN;
    }
  }

  function text(
    value: unknown,
    options: {
      size?: number;
      color?: ReturnType<typeof rgb>;
      lineHeight?: number;
      indent?: number;
    } = {}
  ) {
    const size = options.size ?? 10;
    const lineHeight = options.lineHeight ?? size * 1.65;
    const indent = options.indent ?? 0;
    const width = PDF_CONTENT_WIDTH - indent;
    const lines = wrapMixed(String(value ?? "—"), size, width, latinFont, tamilFont);
    for (const line of lines) {
      ensureSpace(lineHeight + 4);
      let x = PDF_MARGIN + indent;
      for (const run of scriptRuns(line, latinFont, tamilFont)) {
        if (!run.text) continue;
        page.drawText(run.text, {
          x, y, size, font: run.font,
          color: options.color ?? PDF_NAVY,
        });
        x += run.font.widthOfTextAtSize(run.text, size);
      }
      y -= lineHeight;
    }
  }

  function divider() {
    ensureSpace(20);
    y -= 8;
    page.drawLine({
      start: { x: PDF_MARGIN, y },
      end: { x: PDF_WIDTH - PDF_MARGIN, y },
      thickness: 0.7, color: PDF_LINE,
    });
    y -= 13;
  }

  function section(label: string) {
    ensureSpace(55);
    y -= 12;
    text(label, { size: 12.5, color: PDF_PURPLE, lineHeight: 24 });
    divider();
  }

  function field(label: string, value: unknown) {
    ensureSpace(45);
    text(label, { size: 8.5, color: PDF_MUTED, lineHeight: 17 });
    text(value, { size: 10, lineHeight: 19 });
    y -= 10;
  }

  text("WINTER GET TOGETHER 2026", {
    size: 18, color: PDF_NAVY, lineHeight: 30,
  });
  text(t.title, { size: 11, color: PDF_PURPLE, lineHeight: 23 });
  divider();

  field(t.registrationId, registration.id);
  field(t.status, registration.status === "submitted" ? t.submitted : t.pending);
  field(t.submittedAt, registration.submitted_at ?? "—");

  section(t.personal);
  field(t.fullName, registration.applicant_full_name);
  field(t.dob, registration.date_of_birth);
  field(t.gender,
    registration.gender === "Male" ? t.male :
    registration.gender === "Female" ? t.female : registration.gender);
  field(t.phone, registration.phone);
  field(t.email, registration.email);
  field(t.address, registration.full_address);
  field(t.language, tamil ? t.tamil : t.english);
  field(t.consent, registration.agreed_to_terms ? t.yes : t.no);

  section(t.achievements);
  const answerMap = new Map(answers.map((answer) => [
    answer.question_id,
    answer.answer,
  ]));
  for (const [index, question] of QUESTIONS.entries()) {
    ensureSpace(64);
    text(`${index + 1}. ${tamil ? question.tamil : question.english}`, {
      size: 10, color: PDF_NAVY, lineHeight: 19,
    });
    text(`${t.answer}: ${pdfAnswer(answerMap.get(question.id), tamil)}`, {
      size: 10, color: PDF_MUTED, lineHeight: 19, indent: 13,
    });
    y -= 10;
  }

  section(t.certificates);
  if (!documents.length) {
    text(t.noCertificates, { color: PDF_MUTED });
  } else {
    for (const [index, document] of documents.entries()) {
      const question = QUESTIONS.find((q) => q.id === document.question_id);
      ensureSpace(43);
      text(`${index + 1}. ${question ? (tamil ? question.tamil : question.english) : document.question_id}`, {
        size: 9.5, lineHeight: 18,
      });
      text(document.original_filename, {
        size: 9, color: PDF_MUTED, lineHeight: 17, indent: 12,
      });
      y -= 7;
    }
  }

  section(t.event);
  field(t.eventName, "Winter Get Together 2026");
  field(t.eventDate, "13 December 2026");
  field(t.eventTime, "5:00 PM - 10:00 PM");
  field(t.venue, "St Boniface Social Club, 185 Mitcham Road, London SW17 9PG");
  y -= 8;
  text(t.footer, { size: 8, color: PDF_MUTED, lineHeight: 15 });
  return pdf.save();
}

// =====================================================
// MAIN ADMIN ROUTER
// =====================================================

export async function handleAdminRoute(
  request: Request,
  env: AdminEnv,
  origin: string
): Promise<Response | null> {
  const url = new URL(
    request.url
  );

  const path = url.pathname;

  if (
    !path.startsWith(
      "/api/admin/"
    )
  ) {
    return null;
  }

  // Only allow the configured local frontend
  // origin during the local development phase.
  if (
    origin &&
    !ADMIN_ORIGINS.has(origin)
  ) {
    return apiJSON(
      {
        success: false,
        message:
          "Origin not allowed",
      },
      403
    );
  }

  // =================================================
  // CORS PREFLIGHT
  // =================================================

  if (
    request.method === "OPTIONS"
  ) {
    const headers =
      new Headers({
        "Access-Control-Allow-Methods":
          "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization",
        "Access-Control-Max-Age":
          "600",
      });

    setAdminCors(
      headers,
      origin
    );

    return new Response(
      null,
      {
        status: 204,
        headers,
      }
    );
  }

  // =================================================
  // LOGIN
  // =================================================

  if (
    path ===
      "/api/admin/login" &&
    request.method === "POST"
  ) {
    let body: unknown;

    try {
      body =
        await request.json();
    } catch {
      return apiJSON(
        {
          success: false,
          message:
            "Invalid JSON request",
        },
        400,
        origin
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return apiJSON(
        {
          success: false,
          message:
            "Invalid login request",
        },
        400,
        origin
      );
    }

    const input =
      body as Record<
        string,
        unknown
      >;

    const email =
      typeof input.email ===
      "string"
        ? input.email
            .trim()
            .toLowerCase()
        : "";

    const password =
      typeof input.password ===
      "string"
        ? input.password
        : "";

    if (
      !email ||
      email.length > 254 ||
      !password ||
      password.length > 1024
    ) {
      return apiJSON(
        {
          success: false,
          message:
            "Invalid email or password",
        },
        401,
        origin
      );
    }

    const admin =
      await env.DB.prepare(
        `SELECT
          id,
          email,
          display_name,
          role,
          password_hash
         FROM admin_users
         WHERE email = ?
           AND is_active = 1
         LIMIT 1`
      )
        .bind(email)
        .first<AdminUser>();

   
let validPassword = false;

if (admin) {
  try {
    validPassword = await checkPassword(
      password,
      admin.password_hash
    );

    console.info("Admin login verification:", {
      accountFound: true,
      verificationCompleted: true,
      passwordMatched: validPassword,
    });
  } catch (error) {
    console.error("Admin login verification failed:", {
      errorName:
        error instanceof Error
          ? error.name
          : "UnknownError",
      errorMessage:
        error instanceof Error
          ? error.message
          : "Verification exception",
    });

    validPassword = false;
  }
} else {
  console.warn("Admin login verification:", {
    accountFound: false,
  });
}


    if (
      !admin ||
      !validPassword
    ) {
      return apiJSON(
        {
          success: false,
          message:
            "Invalid email or password",
        },
        401,
        origin
      );
    }

    const token =
      crypto.randomUUID()
        .replace(/-/g, "") +
      crypto.randomUUID()
        .replace(/-/g, "");

    const tokenHash =
      await sha256(token);

    const expiresAt =
      new Date(
        Date.now() +
          4 * 60 * 60 * 1000
      ).toISOString();

    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO admin_sessions
         (
           id,
           admin_id,
           token_hash,
           expires_at
         )
         VALUES (?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(),
        admin.id,
        tokenHash,
        expiresAt
      ),

      env.DB.prepare(
        `UPDATE admin_users
         SET last_login_at = ?
         WHERE id = ?`
      ).bind(
        new Date().toISOString(),
        admin.id
      ),
    ]);

    await addAudit(
      env,
      admin.id,
      "admin_login"
    );

    return apiJSON(
      {
        success: true,
        token,
        expiresAt,
        admin: {
          id: admin.id,
          email: admin.email,
          displayName:
            admin.display_name,
          role: admin.role,
        },
      },
      200,
      origin
    );
  }

  // =================================================
  // AUTHENTICATION FOR ALL OTHER ADMIN ROUTES
  // =================================================

  const admin =
    await authenticatedAdmin(
      request,
      env
    );

  if (!admin) {
    return apiJSON(
      {
        success: false,
        message:
          "Unauthorized or expired session",
      },
      401,
      origin
    );
  }

  // =================================================
  // GET CURRENT ADMIN
  // =================================================

  if (
    path ===
      "/api/admin/me" &&
    request.method === "GET"
  ) {
    return apiJSON(
      {
        success: true,
        admin: {
          id: admin.id,
          email: admin.email,
          displayName:
            admin.display_name,
          role: admin.role,
        },
      },
      200,
      origin
    );
  }

  // =================================================
  // LOGOUT
  // =================================================

  if (
    path ===
      "/api/admin/logout" &&
    request.method === "POST"
  ) {
    const authorization =
      request.headers.get(
        "Authorization"
      ) ?? "";

    const token =
      authorization
        .replace(/^Bearer /, "")
        .trim();

    await env.DB.prepare(
      `UPDATE admin_sessions
       SET revoked_at = ?
       WHERE token_hash = ?`
    )
      .bind(
        new Date().toISOString(),
        await sha256(token)
      )
      .run();

    await addAudit(
      env,
      admin.id,
      "admin_logout"
    );

    return apiJSON(
      {
        success: true,
      },
      200,
      origin
    );
  }

  // =================================================
  // DASHBOARD STATISTICS
  // =================================================

  if (
    path ===
      "/api/admin/stats" &&
    request.method === "GET"
  ) {
    const [
      registrations,
      documents,
      emails,
    ] = await Promise.all([
      env.DB.prepare(
        `SELECT
          COUNT(*) AS total,
          SUM(
            CASE
              WHEN status = 'submitted'
              THEN 1
              ELSE 0
            END
          ) AS submitted,
          SUM(
            CASE
              WHEN status = 'pending'
              THEN 1
              ELSE 0
            END
          ) AS pending
         FROM registrations`
      ).first(),

      env.DB.prepare(
        `SELECT COUNT(*) AS total
         FROM documents
         WHERE upload_status = 'verified'`
      ).first(),

      env.DB.prepare(
        `SELECT
          COUNT(*) AS total,
          SUM(
            CASE
              WHEN status IN (
                'accepted',
                'delivered'
              )
              THEN 1
              ELSE 0
            END
          ) AS accepted,
          SUM(
            CASE
              WHEN status = 'failed'
              THEN 1
              ELSE 0
            END
          ) AS failed
         FROM email_messages`
      ).first(),
    ]);

    return apiJSON(
      {
        success: true,
        registrations,
        documents,
        emails,
      },
      200,
      origin
    );
  }

  // =================================================
  // CSV EXPORT - AUTHENTICATED ADMIN ONLY
  // =================================================

  if (
    path ===
      "/api/admin/registrations/export.csv" &&
    request.method === "GET"
  ) {
    await addAudit(
      env,
      admin.id,
      "registrations_csv_export"
    );

    return exportAllCsv(
      env,
      origin
    );
  }

  // =================================================
  // APPLICANT LIST
  // =================================================

  if (
    path ===
      "/api/admin/registrations" &&
    request.method === "GET"
  ) {
    const search = (
      url.searchParams.get(
        "search"
      ) ?? ""
    )
      .trim()
      .slice(0, 100);

    const rawPage =
      Number(
        url.searchParams.get(
          "page"
        ) ?? 1
      );

    const page =
      Number.isFinite(rawPage)
        ? Math.max(
            1,
            Math.min(
              100000,
              Math.floor(rawPage)
            )
          )
        : 1;

    const limit = 20;

    const offset =
      (page - 1) *
      limit;

    const filter = `
      (
        instr(
          lower(r.applicant_full_name),
          lower(?)
        ) > 0
        OR instr(
          lower(r.email),
          lower(?)
        ) > 0
        OR instr(
          lower(r.phone),
          lower(?)
        ) > 0
        OR instr(
          lower(r.id),
          lower(?)
        ) > 0
      )
    `;

    const args = [
      search,
      search,
      search,
      search,
    ];

    const [
      countRow,
      rows,
    ] = await Promise.all([
      env.DB.prepare(
        `SELECT COUNT(*) AS total
         FROM registrations r
         WHERE ${filter}`
      )
        .bind(...args)
        .first<{
          total: number;
        }>(),

      env.DB.prepare(
        `SELECT
          r.id,
          r.applicant_full_name,
          r.email,
          r.phone,
          r.language,
          r.status,
          r.created_at,
          r.submitted_at,
          (
            SELECT COUNT(*)
            FROM documents d
            WHERE d.registration_id = r.id
              AND d.upload_status = 'verified'
          ) AS document_count,
          (
            SELECT e.status
            FROM email_messages e
            WHERE e.registration_id = r.id
            ORDER BY e.created_at DESC
            LIMIT 1
          ) AS email_status
         FROM registrations r
         WHERE ${filter}
         ORDER BY r.created_at DESC
         LIMIT ? OFFSET ?`
      )
        .bind(
          ...args,
          limit,
          offset
        )
        .all(),
    ]);

    return apiJSON(
      {
        success: true,
        rows: rows.results,
        total:
          countRow?.total ?? 0,
        page,
        pageSize: limit,
      },
      200,
      origin
    );
  }

  // =================================================
  // INDIVIDUAL APPLICANT PDF EXPORT
  // =================================================

  const pdfMatch =
    path.match(
      /^\/api\/admin\/registrations\/([^/]+)\/pdf$/
    );

  if (
    pdfMatch &&
    request.method === "GET"
  ) {
    let id: string;

    try {
      id =
        decodeURIComponent(
          pdfMatch[1]
        );
    } catch {
      return apiJSON(
        {
          success: false,
          message:
            "Invalid registration ID",
        },
        400,
        origin
      );
    }

    const registration =
      await getApplicant(
        env,
        id
      );

    if (!registration) {
      return apiJSON(
        {
          success: false,
          message:
            "Applicant not found",
        },
        404,
        origin
      );
    }

    const [
      answers,
      documents,
    ] = await Promise.all([
      getAnswers(env, id),
      getDocuments(env, id),
    ]);

    let pdfBytes: Uint8Array;

    try {
      pdfBytes =
        await buildApplicantPdf(
          env,
          registration,
          answers,
          documents
        );
    } catch (error) {
      console.error("========== PDF GENERATION FAILED ==========");
      console.error("Registration ID:", id);
      console.error("Applicant language:", registration.language);
      console.error("Error message:", error instanceof Error ? error.message : String(error));
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack available");
      console.error("===========================================");
        

      if (
        error instanceof Error &&
        error.message ===
          "PDF_FONT_MISSING"
      ) {
        return apiJSON(
          {
            success: false,
            message:
              `Tamil PDF font missing from local R2. Upload NotoSansTamil-Regular.ttf at ${PDF_FONT_R2_KEY}.`,
          },
          503,
          origin
        );
      }

      if (error instanceof Error && error.message === "PDF_FONT_NOT_TAMIL") {
        return apiJSON(
          { success: false, message: "The uploaded font lacks normal Tamil glyphs. Upload NotoSansTamil-Regular.ttf, not the Supplement font." },
          503,
          origin
        );
      }

      return apiJSON(
        {
          success: false,
          message: "Could not generate applicant PDF. Check the backend terminal for the exact error.",
        },
        500,
        origin
      );
    }

    await addAudit(
      env,
      admin.id,
      "registration_pdf_export",
      id
    );

    const filename =
      `${safeFilename(
        registration.applicant_full_name
      )}_${registration.id}.pdf`;

    const blob = new Blob(
      [
        new Uint8Array(
          pdfBytes
        ),
      ],
      {
        type:
          "application/pdf",
      }
    );

    return fileResponse(
      blob,
      "application/pdf",
      filename,
      origin
    );
  }

  // =================================================
  // SECURE CERTIFICATE DOWNLOAD
  // =================================================

  const downloadMatch =
    path.match(
      /^\/api\/admin\/registrations\/([^/]+)\/documents\/([^/]+)\/download$/
    );

  if (
    downloadMatch &&
    request.method === "GET"
  ) {
    let registrationId: string;
    let documentId: string;

    try {
      registrationId =
        decodeURIComponent(
          downloadMatch[1]
        );

      documentId =
        decodeURIComponent(
          downloadMatch[2]
        );
    } catch {
      return apiJSON(
        {
          success: false,
          message:
            "Invalid document request",
        },
        400,
        origin
      );
    }

    const doc =
      await env.DB.prepare(
        `SELECT
          original_filename,
          mime_type,
          r2_object_key
         FROM documents
         WHERE id = ?
           AND registration_id = ?
           AND upload_status = 'verified'
         LIMIT 1`
      )
        .bind(
          documentId,
          registrationId
        )
        .first<DownloadableDocument>();

    if (!doc) {
      return apiJSON(
        {
          success: false,
          message:
            "Document not found",
        },
        404,
        origin
      );
    }

    const object =
      await env.DOCUMENTS.get(
        doc.r2_object_key
      );

    if (!object) {
      return apiJSON(
        {
          success: false,
          message:
            "Stored file not found",
        },
        404,
        origin
      );
    }

    await addAudit(
      env,
      admin.id,
      "document_download",
      registrationId
    );

    const filename =
      doc.original_filename
        .replace(
          /[\r\n"\\]/g,
          "_"
        )
        .slice(0, 200);

    const headers =
      new Headers({
        "Content-Type":
          doc.mime_type,
        "Content-Disposition":
          `attachment; filename="certificate"; ` +
          `filename*=UTF-8''${encodeURIComponent(
            filename
          )}`,
        "Cache-Control":
          "private, no-store",
        "X-Content-Type-Options":
          "nosniff",
      });

    setAdminCors(
      headers,
      origin
    );

    return new Response(
      object.body,
      {
        status: 200,
        headers,
      }
    );
  }

  // =================================================
  // COMPLETE APPLICANT DETAILS
  // =================================================

  const detailMatch =
    path.match(
      /^\/api\/admin\/registrations\/([^/]+)$/
    );

  if (
    detailMatch &&
    request.method === "GET"
  ) {
    let id: string;

    try {
      id =
        decodeURIComponent(
          detailMatch[1]
        );
    } catch {
      return apiJSON(
        {
          success: false,
          message:
            "Invalid registration ID",
        },
        400,
        origin
      );
    }

    const registration =
      await getApplicant(
        env,
        id
      );

    if (!registration) {
      return apiJSON(
        {
          success: false,
          message:
            "Applicant not found",
        },
        404,
        origin
      );
    }

    const [
      answers,
      documents,
      emails,
    ] = await Promise.all([
      getAnswers(
        env,
        id
      ),
      getDocuments(
        env,
        id
      ),
      getEmailMessages(
        env,
        id
      ),
    ]);

    await addAudit(
      env,
      admin.id,
      "registration_view",
      id
    );

    return apiJSON(
      {
        success: true,
        registration,
        answers,
        documents,
        emails,
      },
      200,
      origin
    );
  }

  // =================================================
  // UNKNOWN ADMIN ENDPOINT
  // =================================================

  return apiJSON(
    {
      success: false,
      message:
        "Admin endpoint not found",
    },
    404,
    origin
  );
}
