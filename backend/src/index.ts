import "regenerator-runtime/runtime";

import {
  QUESTION_IDS,
  isQuestionId,
  requiresProof,
  validateRegistration,
  REGISTRATION_DEADLINE,
  type QuestionId,
} from "./validators/registration";

import {
  storeCertificate,
} from "./services/storage";

import { handleAdminRoute } from "./routes/admin";

interface Env {
  DB: D1Database;
  DOCUMENTS: R2Bucket;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_FROM_NAME?: string;
  RESEND_EMAIL_ENABLED?: string;
  EMAIL_LOGO_BASE_URL?: string;
}

interface PendingRegistration {
  id: string;
  applicant_full_name: string;
  status: string;
  submission_token_hash: string | null;
  expires_at: string | null;
}

interface AnswerRow {
  answer: string | null;
}

interface DocumentRow {
  id: string;
  question_id: string;
  r2_object_key: string;
  file_size_bytes: number;
  upload_status: string;
}


  
const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",

  "http://localhost:5174",
  "http://127.0.0.1:5174",

  "https://winter-get-together.purple-forest-fa52.workers.dev",
]);



function response(
  data: unknown,
  status = 200,
  origin?: string
): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }

  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

function corsHeaders(origin: string): Headers {
  const headers = new Headers();

  if (ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, OPTIONS"
    );
    headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    headers.set("Access-Control-Max-Age", "600");
    headers.set("Vary", "Origin");
  }

  return headers;
}

async function sha256(value: string): Promise<string> {
  const input = new TextEncoder().encode(value);

  const digest = await crypto.subtle.digest(
    "SHA-256",
    input
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function registrationId(env: Env): Promise<string> {
  const result = await env.DB.prepare(
    `INSERT INTO registration_sequence (id, last_number)
     VALUES (1, 1)
     ON CONFLICT(id)
     DO UPDATE SET last_number = last_number + 1
     RETURNING last_number`
  ).first<{ last_number: number }>();

  if (!result) {
    throw new Error("Could not generate registration ID.");
  }

  return `WGT${String(result.last_number).padStart(5, "0")}`;
}

async function getRegistration(
  env: Env,
  id: string,
  request: Request
): Promise<PendingRegistration | null> {
  const auth = request.headers.get("Authorization") ?? "";

  if (!auth.startsWith("Bearer ")) {
    return null;
  }

  const token = auth.slice(7).trim();

  if (!token || token.length > 200) {
    return null;
  }

  const record = await env.DB.prepare(
    `SELECT id, applicant_full_name, status,
            submission_token_hash, expires_at
     FROM registrations
     WHERE id = ?`
  ).bind(id).first<PendingRegistration>();

  if (!record?.submission_token_hash) {
    return null;
  }

  const hashed = await sha256(token);

  if (hashed !== record.submission_token_hash) {
    return null;
  }

  return record;
}

function isPending(record: PendingRegistration): boolean {
  return (
    record.status === "pending" &&
    record.expires_at !== null &&
    Date.parse(record.expires_at) > Date.now()
  );
}

async function health(
  env: Env,
  origin: string
): Promise<Response> {
  const database = await env.DB.prepare(
    "SELECT 1 AS connected"
  ).first<{ connected: number }>()
    .then((r) => r?.connected === 1)
    .catch(() => false);

  const schema = await env.DB.prepare(
    `SELECT COUNT(*) AS total
     FROM sqlite_master
     WHERE type = 'table'
       AND name IN (
         'registrations',
         'achievement_answers',
         'documents',
         'email_messages',
         'admin_users',
         'admin_sessions',
         'admin_audit_logs'
       )`
  ).first<{ total: number }>()
    .then((r) => r?.total === 7)
    .catch(() => false);

  const r2 = await env.DOCUMENTS.list({ limit: 1 })
    .then(() => true)
    .catch(() => false);

  const healthy = database && schema && r2;

  return response({
    success: healthy,
    status: healthy ? "healthy" : "unhealthy",
    services: {
      database: database ? "connected" : "error",
      schema: schema ? "ready" : "missing",
      r2: r2 ? "connected" : "error",
    },
  }, healthy ? 200 : 503, origin);
}

async function startRegistration(
  request: Request,
  env: Env,
  origin: string
): Promise<Response> {
  if (Date.now() > Date.parse(REGISTRATION_DEADLINE)) {
    return response({
      success: false,
      message: "Registration has closed.",
    }, 403, origin);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return response({
      success: false,
      message: "Invalid JSON request.",
    }, 400, origin);
  }

  const result = validateRegistration(body);

  if (!result.success) {
    return response({
      success: false,
      message: result.error,
    }, 400, origin);
  }

  const { personal, language, answers } = result.data;

 const id = await registrationId(env);
  const token = crypto.randomUUID() +
    crypto.randomUUID();

  const tokenHash = await sha256(token);

  const expiresAt = new Date(
    Date.now() + 60 * 60 * 1000
  ).toISOString();

  const queries = [
    env.DB.prepare(
      `INSERT INTO registrations (
        id,
        applicant_full_name,
        date_of_birth,
        gender,
        phone,
        email,
        full_address,
        language,
        agreed_to_terms,
        status,
        submission_token_hash,
        expires_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      personal.fullName,
      personal.dob,
      personal.gender,
      personal.phone,
      personal.email,
      personal.address,
      language,
      1,
      "pending",
      tokenHash,
      expiresAt
    ),

    ...QUESTION_IDS.map((questionId) =>
      env.DB.prepare(
        `INSERT INTO achievement_answers
         (registration_id, question_id, answer)
         VALUES (?, ?, ?)`
      ).bind(
        id,
        questionId,
        answers[questionId] || null
      )
    ),
  ];

  await env.DB.batch(queries);

  const requiredDocuments = QUESTION_IDS.filter(
    (questionId) =>
      requiresProof(questionId, answers[questionId])
  );

  return response({
    success: true,
    message: "Pending registration created.",
    registrationId: id,
    uploadToken: token,
    expiresAt,
    requiredDocuments,
  }, 201, origin);
}

async function uploadDocument(
  request: Request,
  env: Env,
  origin: string,
  id: string,
  questionId: string
): Promise<Response> {
  if (!isQuestionId(questionId)) {
    return response({
      success: false,
      message: "Invalid achievement question.",
    }, 400, origin);
  }

  const registration = await getRegistration(
    env,
    id,
    request
  );

  if (!registration) {
    return response({
      success: false,
      message: "Unauthorized registration upload.",
    }, 401, origin);
  }

  if (!isPending(registration)) {
    return response({
      success: false,
      message: "Registration is not pending or has expired.",
    }, 409, origin);
  }

  const answer = await env.DB.prepare(
    `SELECT answer
     FROM achievement_answers
     WHERE registration_id = ?
       AND question_id = ?`
  ).bind(id, questionId).first<AnswerRow>();

  if (
    !answer ||
    !requiresProof(
      questionId as QuestionId,
      answer.answer ?? ""
    )
  ) {
    return response({
      success: false,
      message: "Certificate upload is not required.",
    }, 400, origin);
  }

  const previous = await env.DB.prepare(
    `SELECT id FROM documents
     WHERE registration_id = ?
       AND question_id = ?`
  ).bind(id, questionId).first();

  if (previous) {
    return response({
      success: false,
      message: "A certificate is already uploaded.",
    }, 409, origin);
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return response({
      success: false,
      message: "Invalid upload form.",
    }, 400, origin);
  }

  const upload = form.get("file");

  if (!(upload instanceof File)) {
    return response({
      success: false,
      message: "Select a certificate file.",
    }, 400, origin);
  }

  let stored;

  try {
    stored = await storeCertificate(
      env.DOCUMENTS,
      registration.applicant_full_name,
      id,
      questionId as QuestionId,
      upload
    );
  } catch (error) {
    return response({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Certificate upload failed.",
    }, 400, origin);
  }

  const documentId = crypto.randomUUID();

  try {
    await env.DB.prepare(
      `INSERT INTO documents (
        id,
        registration_id,
        question_id,
        applicant_name,
        original_filename,
        stored_filename,
        r2_object_key,
        mime_type,
        file_size_bytes,
        upload_status,
        uploaded_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded',
              strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
    ).bind(
      documentId,
      id,
      questionId,
      registration.applicant_full_name,
      upload.name.slice(0, 255),
      stored.storedFilename,
      stored.key,
      stored.mimeType,
      stored.size
    ).run();
  } catch {
    await env.DOCUMENTS.delete(stored.key);

    return response({
      success: false,
      message: "Could not save document record.",
    }, 500, origin);
  }

  return response({
    success: true,
    documentId,
    questionId,
    originalFilename: upload.name,
    size: stored.size,
    message: "Certificate uploaded successfully.",
  }, 201, origin);
}

// =====================================================
// RESEND: LOCAL-ONLY REGISTRATION CONFIRMATIONS
// =====================================================

// This is intentionally opt-in. Merely configuring an API key does not
// start sending emails. In .dev.vars set RESEND_EMAIL_ENABLED=true only
// when you are ready to test with a newly submitted test registration.
// Never enable email sending on an unreviewed production deployment.

function escapeEmailHTML(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface ConfirmationRecipient {
  email: string;
  language: "ta" | "en";
  applicant_full_name: string;
}

// Email images must be absolute HTTPS URLs. The public/ folder on the
// developer's PC is not accessible to a recipient's email application.
// You can override the base using EMAIL_LOGO_BASE_URL in .dev.vars.
const DEFAULT_PUBLIC_LOGO_BASE =
  "https://winter-get-together.purple-forest-fa52.workers.dev";

function emailLogoUrl(base: string, fileName: string): string {
  const url = new URL(fileName, `${base.replace(/\/+$/, "")}/images/`);
  if (url.protocol !== "https:") {
    throw new Error("Email logos require an HTTPS public URL.");
  }
  return escapeEmailHTML(url.toString());
}

function confirmationEmail(
  recipient: ConfirmationRecipient,
  registrationId: string,
  logoBase = DEFAULT_PUBLIC_LOGO_BASE
): { subject: string; htmlContent: string; textContent: string } {
  const tamil = recipient.language === "ta";
  const name = escapeEmailHTML(recipient.applicant_full_name);
  const id = escapeEmailHTML(registrationId);
  const logo1 = emailLogoUrl(logoBase, "logo-1.webp");
  const logo2 = emailLogoUrl(logoBase, "logo-2.webp");

  const subject = tamil
    ? `Winter Get Together 2026 - பதிவு உறுதிப்படுத்தல் (${registrationId})`
    : `Winter Get Together 2026 - Registration Confirmation (${registrationId})`;
  const heading = tamil ? "பதிவு உறுதிப்படுத்தப்பட்டது" : "Registration Confirmed";
  const greeting = tamil ? `அன்புடையீர் ${name},` : `Dear ${name},`;
  const intro = tamil
    ? "Winter Get Together 2026 நிகழ்வுக்கான உங்கள் பதிவு வெற்றிகரமாகப் பெறப்பட்டது."
    : "Your registration for Winter Get Together 2026 has been received successfully.";
  const idLabel = tamil ? "பதிவு இலக்கம்" : "Registration ID";
  const dateLabel = tamil ? "நிகழ்வு தேதி" : "Event Date";
  const timeLabel = tamil ? "நேரம்" : "Time";
  const venueLabel = tamil ? "இடம்" : "Venue";
  const closing = tamil
    ? "நிகழ்வில் உங்களைச் சந்திக்க ஆவலுடன் இருக்கிறோம்."
    : "We look forward to welcoming you to the event.";
  const noReply = tamil
    ? "இது தானாக அனுப்பப்பட்ட உறுதிப்படுத்தல் மின்னஞ்சல். தயவுசெய்து இதற்குப் பதில் அனுப்ப வேண்டாம்."
    : "This is an automated registration confirmation. Please do not reply to this email.";
  const lang = tamil ? "ta" : "en";

  // Tables and inline CSS improve Gmail/Outlook compatibility. No externally
  // hosted font or background image is needed. Logos use two small public PNGs.
  const htmlContent = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
@media only screen and (max-width:620px) {
  .mail-outer { padding:10px !important; }
  .mail-pad { padding:22px 18px !important; }
  .mail-title { font-size:25px !important; }
  .mail-heading { font-size:23px !important; }
  .mail-logo { width:106px !important; max-width:100% !important; height:auto !important; }
  .mail-logo-cell { padding:12px 5px !important; }
  .mail-text { font-size:14px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background-color:#eaf2fd;color:#102448;font-family:Arial,'Noto Sans Tamil','Nirmala UI',Latha,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background-color:#eaf2fd;">
<tr><td align="center" class="mail-outer" style="padding:28px 14px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;border-collapse:separate;background:#ffffff;border:1px solid #dbe5f2;border-radius:18px;overflow:hidden;">
    <tr><td align="center" class="mail-pad" style="background:#0d2b56;padding:32px 24px 22px;color:#ffffff;">
      <div style="font-size:22px;color:#d4e8ff;letter-spacing:9px;line-height:1;">❄ &nbsp; ❄ &nbsp; ❄</div>
      <div class="mail-title" style="font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.35;font-weight:bold;color:#ffffff;margin:14px 0 4px;">Winter Get Together 2026</div>
      <div style="font-size:12px;color:#c4dbf8;letter-spacing:3px;">❄ &nbsp; WINTER CELEBRATION &nbsp; ❄</div>
    </td></tr>
    <tr><td style="background:#e8f3ff;height:9px;line-height:9px;font-size:1px;">&nbsp;</td></tr>
    <tr><td class="mail-pad" style="padding:30px 32px 12px;background:#ffffff;" align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:auto;"><tr>
        <td style="font-size:32px;color:#15966b;padding-right:12px;vertical-align:middle;">&#10004;</td>
        <td class="mail-heading" style="font-size:27px;line-height:1.55;font-weight:800;color:#102448;vertical-align:middle;">${heading}</td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:14px 24px 16px;background:#ffffff;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        <tr>
          <td class="mail-logo-cell" width="50%" align="center" valign="middle" style="padding:12px 10px;border-right:1px solid #dce5f2;">
            <img class="mail-logo" src="${logo1}" width="155" alt="Valvai Welfare Association (UK)" style="display:block;width:155px;max-width:100%;height:auto;margin:auto;border:0;" />
            <div style="font-size:10px;line-height:1.5;font-weight:bold;color:#18345e;padding-top:9px;">VALVAI WELFARE ASSOCIATION (UK)</div>
          </td>
          <td class="mail-logo-cell" width="50%" align="center" valign="middle" style="padding:12px 10px;">
            <img class="mail-logo" src="${logo2}" width="155" alt="Valvai Blues Sports Club (UK)" style="display:block;width:155px;max-width:100%;height:auto;margin:auto;border:0;" />
            <div style="font-size:10px;line-height:1.5;font-weight:bold;color:#18345e;padding-top:9px;">VALVAI BLUES SPORTS CLUB (UK)</div>
          </td>
        </tr>
      </table>
    </td></tr>
    <tr><td class="mail-pad mail-text" style="padding:20px 32px 28px;background:#ffffff;font-size:15px;line-height:1.8;color:#172b4d;">
      <p style="margin:0 0 10px;font-weight:bold;">${greeting}</p>
      <p style="margin:0 0 23px;">${intro}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#123568;border-radius:10px;">
        <tr>
          <td style="padding:17px 20px;color:#ffffff;">
            <div style="font-size:11px;font-weight:bold;letter-spacing:1.4px;color:#d6e5ff;">${idLabel}</div>
            <div style="font-size:19px;line-height:1.5;font-weight:bold;overflow-wrap:anywhere;word-break:break-word;color:#ffffff;">${id}</div>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:18px;background:#f6f9ff;border:1px solid #dce6f4;">
        <tr><td width="30%" style="padding:13px 12px;border-bottom:1px solid #dce6f4;font-weight:bold;">${dateLabel}</td><td style="padding:13px 12px;border-bottom:1px solid #dce6f4;">13 December 2026</td></tr>
        <tr><td style="padding:13px 12px;border-bottom:1px solid #dce6f4;font-weight:bold;">${timeLabel}</td><td style="padding:13px 12px;border-bottom:1px solid #dce6f4;">5:00 PM – 10:00 PM (UK)</td></tr>
        <tr><td style="padding:13px 12px;font-weight:bold;vertical-align:top;">${venueLabel}</td><td style="padding:13px 12px;">St Boniface Social Club, 185 Mitcham Road, London SW17 9PG</td></tr>
      </table>
      <p style="margin:26px 0 10px;text-align:center;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:17px;line-height:1.7;color:#172b4d;">❄ &nbsp; ${closing} &nbsp; ❄</p>
    </td></tr>
    <tr><td class="mail-pad" style="padding:22px 26px 27px;text-align:center;background:#f0f5fd;border-top:1px solid #dfe8f5;">
      <div style="font-size:13px;line-height:1.8;font-weight:bold;color:#14284d;">Valvai Welfare Association (UK)<br />Valvai Blues Sports Club (UK)</div>
      <div style="font-size:12px;color:#62728e;line-height:1.7;margin-top:15px;">${noReply}</div>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  const textContent = [
    heading,
    "",
    tamil
      ? `அன்புடையீர் ${recipient.applicant_full_name},`
      : `Dear ${recipient.applicant_full_name},`,
    intro,
    "",
    `${idLabel}: ${registrationId}`,
    `${dateLabel}: 13 December 2026`,
    `${timeLabel}: 4:00 PM - 10:00 PM (UK)`,
    `${venueLabel}: St Boniface Social Club, 185 Mitcham Road, London SW17 9PG`,
    "",
    closing,
    "Valvai Welfare Association (UK)",
    "Valvai Blues Sports Club (UK)",
    "",
    noReply,
  ].join("\n");

  return { subject, htmlContent, textContent };
}

async function sendConfirmationWithResend(
  env: Env,
  emailId: string,
  registrationId: string,
  recipient: ConfirmationRecipient
): Promise<void> {
  const apiKey = env.RESEND_API_KEY?.trim();
  const senderEmail = env.RESEND_FROM_EMAIL?.trim();
  const senderName = env.RESEND_FROM_NAME?.trim() || "Winter Get Together 2026";

  // Keep all event emails on the specifically verified subdomain.
  // This never changes DNS or the Management System's website routing.
  if (!apiKey || !senderEmail) {
    console.error("Resend configuration missing; email remains pending.");
    return;
  }

  if (
    !/^[^\s<>@]+@events\.xyphoraprimemanagement\.com$/i.test(senderEmail) ||
    /[\r\n<>]/.test(senderName)
  ) {
    console.error("Invalid Resend sender configuration; email remains pending.");
    return;
  }

  const message = confirmationEmail(
    recipient,
    registrationId,
    env.EMAIL_LOGO_BASE_URL?.trim() || DEFAULT_PUBLIC_LOGO_BASE
  );
  let accepted = false;
  let failure = "Resend request failed.";

  try {
    // Resend accepts email via POST /emails (HTTP 200, response contains id).
    // Idempotency provides extra protection from accidental duplicate sends.
    const result = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `winter-get-together-confirmation-${registrationId}`,
      },
      body: JSON.stringify({
        from: `${senderName} <${senderEmail}>`,
        to: [recipient.email],
        subject: message.subject,
        html: message.htmlContent,
        text: message.textContent,
      }),
    });

    if (result.ok) {
      const data: unknown = await result.json().catch(() => null);
      accepted =
        typeof data === "object" &&
        data !== null &&
        "id" in data &&
        typeof data.id === "string" &&
        data.id.length > 0;
      if (!accepted) failure = "Resend returned no message ID.";
    } else {
      // Don't log secrets or untrusted response content.
      failure = `Resend rejected email (HTTP ${result.status}).`;
    }
  } catch {
    failure = "Could not contact Resend.";
  }

  try {
    if (accepted) {
      await env.DB.prepare(
        `UPDATE email_messages
         SET status = 'accepted',
             attempts = COALESCE(attempts, 0) + 1,
             last_error = NULL,
             sent_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ? AND status = 'pending'`
      ).bind(emailId).run();
    } else {
      await env.DB.prepare(
        `UPDATE email_messages
         SET status = 'failed',
             attempts = COALESCE(attempts, 0) + 1,
             last_error = ?
         WHERE id = ? AND status = 'pending'`
      ).bind(failure, emailId).run();
    }
  } catch {
    console.error("Resend email status could not be saved to local D1.");
  }
}

function resendIsEnabledLocally(request: Request, env: Env): boolean {
  const hostname = new URL(request.url).hostname;
  
return (
  env.RESEND_EMAIL_ENABLED === "true" &&
  (
    hostname === "127.0.0.1" ||
    hostname === "localhost" ||
    hostname === "winter-get-together.purple-forest-fa52.workers.dev"
  )
);

}

async function completeRegistration(
  request: Request,
  env: Env,
  origin: string,
  id: string,
  ctx: ExecutionContext
): Promise<Response> {
  const registration = await getRegistration(
    env,
    id,
    request
  );

  if (!registration) {
    return response({
      success: false,
      message: "Unauthorized registration request.",
    }, 401, origin);
  }

  if (!isPending(registration)) {
    return response({
      success: false,
      message: "Registration is not pending or has expired.",
    }, 409, origin);
  }

  if (Date.now() > Date.parse(REGISTRATION_DEADLINE)) {
    return response({
      success: false,
      message: "Registration has closed.",
    }, 403, origin);
  }

  const answers = await env.DB.prepare(
    `SELECT question_id, answer
     FROM achievement_answers
     WHERE registration_id = ?`
  ).bind(id).all<{
    question_id: string;
    answer: string | null;
  }>();

  const documents = await env.DB.prepare(
    `SELECT id, question_id, r2_object_key,
            file_size_bytes, upload_status
     FROM documents
     WHERE registration_id = ?`
  ).bind(id).all<DocumentRow>();

  const answersByQuestion = new Map(
    answers.results.map((r) => [
      r.question_id,
      r.answer ?? "",
    ])
  );

  const docsByQuestion = new Map(
    documents.results.map((doc) => [
      doc.question_id,
      doc,
    ])
  );

  for (const questionId of QUESTION_IDS) {
    const answer = answersByQuestion.get(questionId) ?? "";

    if (!requiresProof(questionId, answer)) {
      continue;
    }

    const doc = docsByQuestion.get(questionId);

    if (!doc || doc.upload_status !== "uploaded") {
      return response({
        success: false,
        message: `Certificate missing for ${questionId}.`,
      }, 400, origin);
    }

    const object = await env.DOCUMENTS.head(
      doc.r2_object_key
    );

    if (
      !object ||
      object.size !== doc.file_size_bytes
    ) {
      return response({
        success: false,
        message: `Certificate verification failed for ${questionId}.`,
      }, 400, origin);
    }
  }

  const emailId = crypto.randomUUID();

  const recipient = await env.DB.prepare(
    `SELECT email, language, applicant_full_name FROM registrations
     WHERE id = ?`
  ).bind(id).first<{
    email: string;
    language: "ta" | "en";
    applicant_full_name: string;
  }>();

  if (!recipient) {
    return response({
      success: false,
      message: "Registration was not found.",
    }, 404, origin);
  }

  const statements = [
    ...documents.results.map((doc) =>
      env.DB.prepare(
        `UPDATE documents
         SET upload_status = 'verified',
             verified_at =
               strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ? AND registration_id = ?`
      ).bind(doc.id, id)
    ),

    env.DB.prepare(
      `UPDATE registrations
       SET status = 'submitted',
           submitted_at =
             strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
           updated_at =
             strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND status = 'pending'`
    ).bind(id),

    env.DB.prepare(
      `INSERT INTO email_messages (
        id,
        registration_id,
        recipient_email,
        email_type,
        language,
        provider,
        status
      )
      VALUES (?, ?, ?, 'registration_confirmation',
              ?, 'resend', 'pending')`
    ).bind(
      emailId,
      id,
      recipient.email,
      recipient.language
    ),
  ];

  await env.DB.batch(statements);

  // Registration succeeds independently of email acceptance. Email is
  // requested only for this newly completed registration, never for old
  // records, and only when explicitly enabled in local Wrangler.
  if (resendIsEnabledLocally(request, env)) {
    ctx.waitUntil(
      sendConfirmationWithResend(env, emailId, id, recipient)
    );
  }

  return response({
    success: true,
    registrationId: id,
    status: "submitted",
    emailStatus: "pending",
    message: "Registration submitted successfully.",
  }, 200, origin);
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") ?? "";

    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return response({
        success: false,
        message: "Origin is not allowed.",
      }, 403);
    }

    try {
      // Handle protected admin routes (including their OPTIONS requests)
      // before processing the public API routes.
      if (url.pathname.startsWith("/api/admin/")) {
        const adminResponse = await handleAdminRoute(request, env, origin);
        return adminResponse ?? response({
          success: false,
          message: "Admin endpoint not found.",
        }, 404, origin);
      }

      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: corsHeaders(origin),
        });
      }

      if (
        request.method === "GET" &&
        url.pathname === "/"
      ) {
        return response({
          success: true,
          application: "Winter Get Together API",
          version: "2.0.0",
          message: "Backend is running locally.",
        }, 200, origin);
      }

      if (
        request.method === "GET" &&
        url.pathname === "/api/health"
      ) {
        return await health(env, origin);
      }

      if (
        request.method === "POST" &&
        url.pathname === "/api/registrations/start"
      ) {
        return await startRegistration(
          request,
          env,
          origin
        );
      }

      const uploadMatch = url.pathname.match(
        /^\/api\/registrations\/([^/]+)\/documents\/([^/]+)$/
      );

      if (
        request.method === "POST" &&
        uploadMatch
      ) {
        return await uploadDocument(
          request,
          env,
          origin,
          uploadMatch[1],
          uploadMatch[2]
        );
      }

      const completeMatch = url.pathname.match(
        /^\/api\/registrations\/([^/]+)\/complete$/
      );

      if (
        request.method === "POST" &&
        completeMatch
      ) {
        return await completeRegistration(
          request,
          env,
          origin,
          completeMatch[1],
          ctx
        );
      }

      return response({
        success: false,
        message: "Endpoint not found.",
      }, 404, origin);
    } catch (error) {
      console.error("API error:", error);

      return response({
        success: false,
        message: "Internal server error.",
      }, 500, origin);
    }
  },
} satisfies ExportedHandler<Env>;
