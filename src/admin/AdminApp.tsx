
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft, ArrowRight, Download, FileDown, FileSpreadsheet, FileText,
  FolderOpen, LayoutDashboard, LockKeyhole, LogOut, Mail, RefreshCw,
  Search, ShieldCheck, Users,
} from "lucide-react";
import "./admin.css";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");
const PAGE_SIZE = 20;

type Section = "dashboard" | "registrations";
type AdminUser = { id: string; email: string; displayName: string; role: string };
type Registration = {
  id: string; applicant_full_name: string; date_of_birth?: string; gender?: string;
  email: string; phone: string; full_address?: string; language: string; status: string;
  document_count?: number; email_status?: string | null; created_at: string;
  submitted_at?: string | null;
};
type AchievementAnswer = { question_id: string; answer: string | null };
type CertificateDocument = {
  id: string; question_id: string; original_filename: string;
  file_size_bytes: number; mime_type: string; upload_status: string;
};
type EmailRecord = {
  id: string; recipient_email: string; status: string; attempts: number;
  last_error: string | null; sent_at: string | null;
};
type DashboardStats = {
  registrations: { total: number | null; submitted: number | null; pending: number | null };
  documents: { total: number | null };
  emails: { total: number | null; accepted: number | null; failed: number | null };
};
type ApplicantDetail = {
  registration: Registration; answers: AchievementAnswer[];
  documents: CertificateDocument[]; emails: EmailRecord[];
};
type Question = { id: string; en: string; ta: string; short: string };

const QUESTIONS: Question[] = [
  {
    id: "tamil_exam",
    short: "Tamil Examination",
    en: "Have you achieved Excellent or Very Good in the Tamil examination conducted by the Tamil Development Council?",
    ta: "தமிழ் மேம்பாட்டுப் பேரவையின் தமிழ்ப் பரீட்சையில் Excellent அல்லது Very Good பெற்றுள்ளீர்களா?",
  },
  {
    id: "maths_competition",
    short: "Chithambara Mathematics Competition",
    en: "Have you achieved Grade A or A* in the Chithambara Mathematics Competition?",
    ta: "சிதம்பரக் கணிதப் போட்டியில் A அல்லது A* தரத்தைப் பெற்றுள்ளீர்களா?",
  },
  {
    id: "grammar_school",
    short: "Grammar School Examination",
    en: "Have you passed the Grammar School entrance examination?",
    ta: "Grammar School தேர்வில் தேர்ச்சி பெற்றுள்ளீர்களா?",
  },
  {
    id: "gcse",
    short: "GCSE Examination",
    en: "Have you achieved at least five A grades (New Grade 5 Seven) in your GCSE examinations?",
    ta: "GCSE பரீட்சையில் குறைந்தபட்சம் 5A (New Grade 5 Seven) பெற்றுள்ளீர்களா?",
  },
  {
    id: "gce_al",
    short: "GCE A-Level",
    en: "Have you achieved Grade A or B in your GCE A-Level examinations?",
    ta: "GCE A/L பரீட்சையில் A, B பெறுபேறுகளைப் பெற்றுள்ளீர்களா?",
  },
  {
    id: "university_degree",
    short: "University Degree",
    en: "Have you obtained a university degree?",
    ta: "பல்கலைக்கழகத்தில் பட்டம் பெற்றுள்ளீர்களா?",
  },
  {
    id: "other_achievements",
    short: "Arts, Culture & Sports Achievements",
    en: "Have you received any awards, prizes or achievements in arts, culture or sports?",
    ta: "கலை, கலாசாரம் மற்றும் விளையாட்டுத் துறைகளில் சாதனைகள் அல்லது பரிசுகள் பெற்றுள்ளீர்களா?",
  },
];

function sectionFromPath(): Section {
  return window.location.pathname.startsWith("/admin/registrations")
    ? "registrations"
    : "dashboard";
}

function dateText(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function getFileName(
  disposition: string | null,
  fallback: string
): string {
  if (!disposition) return fallback;

  const utf8 = disposition.match(/filename\*\s*=\s*UTF-8''([^;\s]+)/i);

  if (utf8) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      return fallback;
    }
  }

  return disposition.match(/filename\s*=\s*"([^"]+)"/i)?.[1] || fallback;
}

async function apiRequest<T>(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);

  if (typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  const body: unknown = await response.json();

  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof body.message === "string"
        ? body.message
        : "Request failed";

    throw new Error(message);
  }

  return body as T;
}

// Escape applicant-controlled text before rendering HTML.
function escapeHTML(value: unknown): string {
  return String(value ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function answerLabel(
  answer: string | null | undefined,
  tamil: boolean
): string {
  if (!answer) {
    return tamil ? "தெரிவுசெய்யப்படவில்லை" : "Not answered";
  }

  if (tamil) return answer;

  const translations: Record<string, string> = {
    ஆம்: "Yes",
    இல்லை: "No",
    "தேர்ச்சி பெற்றுள்ளேன்": "Passed",
    "தேர்ச்சி பெறவில்லை": "Not passed",
  };

  return translations[answer] ?? answer;
}

// Build an A4-friendly HTML report. html2pdf.js captures its
// browser-rendered appearance and downloads a PDF directly.
function buildApplicantReport(detail: ApplicantDetail): HTMLElement {
  const r = detail.registration;
  const tamil = r.language === "ta";

  const labels = tamil
    ? {
        report: "விண்ணப்பதாரர் பதிவு அறிக்கை",
        personal: "தனிப்பட்ட தகவல்கள்",
        achievements: "சாதனைகள் மற்றும் தகுதிகள்",
        certificates: "இணைக்கப்பட்ட சான்றிதழ்கள்",
        event: "நிகழ்வு விவரங்கள்",
        id: "பதிவு இலக்கம்",
        name: "விண்ணப்பதாரரின் முழுப் பெயர்",
        dob: "பிறந்த தேதி",
        gender: "பாலினம்",
        phone: "தொடர்பு இலக்கம்",
        email: "மின்னஞ்சல் முகவரி",
        address: "முழு முகவரி",
        language: "படிவ மொழி",
        submitted: "சமர்ப்பிக்கப்பட்ட நேரம்",
        status: "பதிவு நிலை",
        answer: "பதில்",
        consent: "ஒப்புதல்",
        noFiles: "சான்றிதழ்கள் பதிவேற்றப்படவில்லை.",
        venue: "நிகழ்வு இடம்",
        eventDate: "நிகழ்வு தேதி",
        eventTime: "நிகழ்வு நேரம்",
      }
    : {
        report: "Applicant Registration Report",
        personal: "Personal Information",
        achievements: "Achievements & Qualifications",
        certificates: "Supporting Certificates",
        event: "Event Information",
        id: "Registration ID",
        name: "Applicant Full Name",
        dob: "Date of Birth",
        gender: "Gender",
        phone: "Contact Number",
        email: "Email Address",
        address: "Full Address",
        language: "Form Language",
        submitted: "Submitted At",
        status: "Registration Status",
        answer: "Answer",
        consent: "Consent",
        noFiles: "No certificates uploaded.",
        venue: "Venue",
        eventDate: "Event Date",
        eventTime: "Event Time",
      };

  const field = (label: string, value: unknown) => `
    <div class="pdf-field">
      <span>${escapeHTML(label)}</span>
      <strong>${escapeHTML(value ?? "—")}</strong>
    </div>
  `;

  const answers = new Map(
    detail.answers.map((answer) => [
      answer.question_id,
      answer.answer,
    ])
  );

  const gender = tamil
    ? r.gender === "Male"
      ? "ஆண்"
      : r.gender === "Female"
        ? "பெண்"
        : r.gender
    : r.gender;

  const status = tamil
    ? r.status === "submitted"
      ? "சமர்ப்பிக்கப்பட்டது"
      : "நிலுவையில்"
    : r.status;

  const questions = QUESTIONS.map(
    (question, index) => `
      <div class="pdf-question" lang="${tamil ? "ta" : "en"}">
        <div class="pdf-question-title">
          ${index + 1}. ${escapeHTML(tamil ? question.ta : question.en)}
        </div>
        <div class="pdf-answer">
          ${escapeHTML(labels.answer)}:
          <strong>
            ${escapeHTML(answerLabel(answers.get(question.id), tamil))}
          </strong>
        </div>
      </div>
    `
  ).join("");

  const certificates = detail.documents.length
    ? detail.documents
        .map((document, index) => {
          const question = QUESTIONS.find(
            (item) => item.id === document.question_id
          );

          const questionText = question
            ? tamil
              ? question.ta
              : question.en
            : document.question_id;

          return `
            <div class="pdf-document">
              <strong>
                ${index + 1}. ${escapeHTML(questionText)}
              </strong>
              <div>
                ${escapeHTML(document.original_filename)}
                · ${(document.file_size_bytes / 1048576).toFixed(2)} MB
              </div>
            </div>
          `;
        })
        .join("")
    : `<p class="pdf-empty">${escapeHTML(labels.noFiles)}</p>`;

  const container = document.createElement("div");

  container.setAttribute("lang", tamil ? "ta" : "en");
  container.className = "winter-report-root";

  container.style.cssText =
    "width:794px;background:white;color:#11234b;padding:0;margin:0;";

  container.innerHTML = `
    <style>
      .winter-report-root,
      .winter-report-root * {
        box-sizing: border-box;
      }

      .winter-report-root {
        font-family:
          "Nirmala UI",
          "Latha",
          "Noto Sans Tamil",
          Arial,
          sans-serif;
        line-height: 1.5;
        font-size: 13px;
      }

      .winter-report-root .pdf-header {
        background: #101f46;
        color: #ffffff;
        padding: 27px 34px 24px;
        border-bottom: 5px solid #6d5be4;
      }

      .winter-report-root .pdf-kicker {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 1.4px;
        color: #c7c0ff;
      }

      .winter-report-root .pdf-header h1 {
        font-size: 23px;
        line-height: 1.45;
        margin: 9px 0 6px;
        color: #ffffff;
        font-weight: 800;
      }

      .winter-report-root .pdf-reference {
        font-size: 12px;
        color: #e2e6ff;
      }

      .winter-report-root .pdf-body {
        padding: 24px 34px 30px;
      }

      .winter-report-root .pdf-section {
        margin: 0 0 22px;
      }

      .winter-report-root .pdf-section h2 {
        font-size: 16px;
        font-weight: 800;
        margin: 0 0 13px;
        color: #14264f;
        padding-bottom: 9px;
        border-bottom: 1px solid #dfe5f0;
      }

      .winter-report-root .pdf-fields {
        display: grid;
        grid-template-columns:
          minmax(0, 1fr)
          minmax(0, 1fr);
        gap: 14px 22px;
      }

      .winter-report-root .pdf-field {
        min-width: 0;
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .winter-report-root .pdf-field span {
        display: block;
        font-size: 10px;
        color: #70809c;
        margin-bottom: 3px;
      }

      .winter-report-root .pdf-field strong {
        display: block;
        font-size: 12px;
        line-height: 1.6;
        font-weight: 700;
        color: #15244b;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }

      .winter-report-root .pdf-question,
      .winter-report-root .pdf-document {
        border-bottom: 1px solid #e9edf5;
        padding: 10px 0;
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .winter-report-root .pdf-question-title,
      .winter-report-root .pdf-document strong {
        font-size: 12px;
        font-weight: 700;
        color: #182951;
        line-height: 1.6;
        display: block;
      }

      .winter-report-root .pdf-answer,
      .winter-report-root .pdf-document div {
        font-size: 11px;
        color: #61708c;
        margin-top: 4px;
        padding-left: 12px;
      }

      .winter-report-root .pdf-answer strong {
        color: #22396a;
      }

      .winter-report-root .pdf-empty {
        color: #61708c;
        font-size: 12px;
      }

      .winter-report-root .pdf-footer {
        font-size: 10px;
        color: #8190aa;
        border-top: 1px solid #e7ebf3;
        padding-top: 12px;
        margin-top: 16px;
      }
    </style>

    <header class="pdf-header">
      <div class="pdf-kicker">
        WINTER GET TOGETHER 2026
      </div>

      <h1>
        ${escapeHTML(labels.report)}
      </h1>

      <div class="pdf-reference">
        ${escapeHTML(r.id)}
      </div>
    </header>

    <main class="pdf-body">
      <section class="pdf-section">
        <div class="pdf-fields">
          ${field(labels.id, r.id)}
          ${field(labels.status, status)}
          ${field(labels.submitted, dateText(r.submitted_at))}
          ${field(labels.language, tamil ? "தமிழ்" : "English")}
        </div>
      </section>

      <section class="pdf-section">
        <h2>${escapeHTML(labels.personal)}</h2>

        <div class="pdf-fields">
          ${field(labels.name, r.applicant_full_name)}
          ${field(labels.dob, r.date_of_birth)}
          ${field(labels.gender, gender)}
          ${field(labels.phone, r.phone)}
          ${field(labels.email, r.email)}
          ${field(labels.address, r.full_address)}
          ${field(labels.consent, tamil ? "ஆம்" : "Yes")}
        </div>
      </section>

      <section class="pdf-section">
        <h2>${escapeHTML(labels.achievements)}</h2>
        ${questions}
      </section>

      <section class="pdf-section">
        <h2>${escapeHTML(labels.certificates)}</h2>
        ${certificates}
      </section>

      <section class="pdf-section">
        <h2>${escapeHTML(labels.event)}</h2>

        <div class="pdf-fields">
          ${field(labels.eventDate, "13 December 2026")}
          ${field(labels.eventTime, "5:00 PM - 10:00 PM")}
          ${field(
            labels.venue,
            "St Boniface Social Club, 185 Mitcham Road, London SW17 9PG"
          )}
        </div>
      </section>

      <footer class="pdf-footer">
        WINTER GET TOGETHER 2026 · ${escapeHTML(r.id)}
      </footer>
    </main>
  `;

  return container;
}

export default function AdminApp() {
  const [token, setToken] = useState("");
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState("");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<ApplicantDetail | null>(null);
  const [activeSection, setActiveSection] =
    useState<Section>(sectionFromPath);
  const [refreshKey, setRefreshKey] = useState(0);

  const navigate = useCallback(
    (section: Section, id?: string, replace = false) => {
      const path = id
        ? `/admin/registrations/${encodeURIComponent(id)}`
        : section === "registrations"
          ? "/admin/registrations"
          : "/admin/dashboard";

      if (window.location.pathname !== path) {
        if (replace) {
          window.history.replaceState({}, "", path);
        } else {
          window.history.pushState({}, "", path);
        }
      }

      setActiveSection(section);
      setError("");

      if (!id) {
        setDetail(null);
      }
    },
    []
  );

  const clearSession = useCallback(() => {
    setToken("");
    setAdmin(null);
    setStats(null);
    setRegistrations([]);
    setDetail(null);
    setPassword("");
    setDownloading("");

    window.history.replaceState({}, "", "/admin");
  }, []);

  useEffect(() => {
    function onPopState() {
      if (!token || !admin) {
        window.history.replaceState({}, "", "/admin");
        return;
      }

      const match = window.location.pathname.match(
        /^\/admin\/registrations\/([^/]+)$/
      );

      setActiveSection(sectionFromPath());
      setError("");

      if (!match) {
        setDetail(null);
        return;
      }

      let id: string;

      try {
        id = decodeURIComponent(match[1]);
      } catch {
        setError("Invalid registration ID.");
        setDetail(null);
        return;
      }

      setDetail(null);

      void apiRequest<ApplicantDetail>(
        `/api/admin/registrations/${encodeURIComponent(id)}`,
        token
      )
        .then((data) => {
          if (
            window.location.pathname ===
            `/admin/registrations/${encodeURIComponent(id)}`
          ) {
            setDetail(data);
          }
        })
        .catch((err) => {
          if (
            window.location.pathname ===
            `/admin/registrations/${encodeURIComponent(id)}`
          ) {
            setError(errorText(err, "Unable to open applicant."));
          }
        });
    }

    window.addEventListener("popstate", onPopState);

    return () => window.removeEventListener("popstate", onPopState);
  }, [token, admin]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) return;

    setBusy(true);
    setError("");

    try {
      const result = await apiRequest<{
        success: boolean;
        token: string;
        admin: AdminUser;
      }>("/api/admin/login", "", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (!result.success || !result.token || !result.admin) {
        throw new Error("Unable to sign in.");
      }

      setToken(result.token);
      setAdmin(result.admin);
      setPassword("");

      navigate("dashboard", undefined, true);
    } catch (err) {
      setError(errorText(err, "Unable to sign in."));
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    const current = token;

    clearSession();
    setError("");

    if (current) {
      try {
        await apiRequest("/api/admin/logout", current, {
          method: "POST",
        });
      } catch {
        // Local session has already been cleared.
      }
    }
  }

  useEffect(() => {
    if (!token || !admin) return;

    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        const [statsResponse, listResponse] = await Promise.all([
          apiRequest<DashboardStats>("/api/admin/stats", token),
          apiRequest<{
            rows: Registration[];
            total: number;
          }>(
            `/api/admin/registrations?search=${encodeURIComponent(
              search
            )}&page=${page}`,
            token
          ),
        ]);

        if (!cancelled) {
          setStats(statsResponse);
          setRegistrations(listResponse.rows);
          setTotal(listResponse.total);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          const message = errorText(
            err,
            "Unable to load dashboard."
          );

          setError(message);

          if (/unauthorized|expired session/i.test(message)) {
            clearSession();
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    token,
    admin,
    search,
    page,
    refreshKey,
    clearSession,
  ]);

  async function openApplicant(id: string) {
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      const data = await apiRequest<ApplicantDetail>(
        `/api/admin/registrations/${encodeURIComponent(id)}`,
        token
      );

      navigate("registrations", id);
      setDetail(data);
    } catch (err) {
      setError(errorText(err, "Unable to open applicant."));
    } finally {
      setBusy(false);
    }
  }

  // =====================================================
  // DIRECT PDF DOWNLOAD - NO PRINT DIALOG
  // =====================================================

  async function downloadApplicantPDF() {
    if (!detail || downloading) return;

    setError("");
    setDownloading(`pdf-${detail.registration.id}`);

    try {
      const report = buildApplicantReport(detail);

      await document.fonts.ready;

      const module = await import("html2pdf.js");
      const html2pdf = module.default;


const pdfOptions = {
  margin: [10, 10, 10, 10] as [
    number,
    number,
    number,
    number
  ],

  filename: `${detail.registration.id}.pdf`,

  image: {
    type: "jpeg" as const,
    quality: 0.98,
  },

  html2canvas: {
    scale: 2,
    useCORS: false,
    backgroundColor: "#ffffff",
    scrollX: 0,
    scrollY: 0,
    windowWidth: 1000,
  },

  jsPDF: {
    unit: "mm" as const,
    format: "a4",
    orientation: "portrait" as const,
  },

  pagebreak: {
    mode: ["css", "legacy"],
    avoid: [
      ".pdf-field",
      ".pdf-question",
      ".pdf-document",
    ],
  },
};

await html2pdf()
  .set(pdfOptions)
  .from(report)
  .save();


    } catch (err) {
      setError(
        errorText(err, "Unable to generate the applicant PDF.")
      );
    } finally {
      setDownloading("");
    }
  }

  // =====================================================
  // AUTHENTICATED CSV AND CERTIFICATE DOWNLOAD
  // =====================================================

  async function downloadAdminFile(
    endpoint: string,
    fallbackName: string,
    key: string
  ) {
    if (!token || downloading) return;

    setError("");
    setDownloading(key);

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data: { message?: string } | null = await response
          .json()
          .catch(() => null);

        throw new Error(
          data?.message || `Download failed (${response.status}).`
        );
      }

      if (
        (response.headers.get("Content-Type") || "").includes(
          "application/json"
        )
      ) {
        throw new Error("Server returned JSON instead of a file.");
      }

      const blob = await response.blob();

      if (!blob.size) {
        throw new Error("Downloaded file is empty.");
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = getFileName(
        response.headers.get("Content-Disposition"),
        fallbackName
      );

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
      setError(errorText(err, "Unable to download file."));
    } finally {
      setDownloading("");
    }
  }

  if (!token || !admin) {
    return (
      <main className="login-screen">
        <section className="login-card">
          <div className="login-brand">
            <div className="brand-icon">
              <ShieldCheck size={27} />
            </div>
            <span>WINTER GET TOGETHER 2026</span>
          </div>

          <h1>Administrator Login</h1>

          <p>
            Sign in to securely manage applicant registrations and
            supporting certificates.
          </p>

          <form onSubmit={handleLogin}>
            <label htmlFor="admin-email">Email Address</label>

            <input
              id="admin-email"
              type="email"
              placeholder="admin@example.com"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <label htmlFor="admin-password">Password</label>

            <input
              id="admin-password"
              type="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            {error && (
              <div className="admin-error" role="alert">
                {error}
              </div>
            )}

            <button
              className="primary-button"
              type="submit"
              disabled={busy}
            >
              <LockKeyhole size={18} />
              {busy ? "Signing in..." : "Secure Sign In"}
            </button>
          </form>

          <small>Authorized administrators only</small>
        </section>
      </main>
    );
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">
            <ShieldCheck size={24} />
          </div>

          <div>
            <strong>Winter Get Together</strong>
            <span>ADMINISTRATION</span>
          </div>
        </div>

        <nav
          className="sidebar-navigation"
          aria-label="Admin navigation"
        >
          <button
            type="button"
            className={
              activeSection === "dashboard" && !detail
                ? "nav-active"
                : ""
            }
            onClick={() => navigate("dashboard")}
          >
            <LayoutDashboard size={19} />
            Dashboard
          </button>

          <button
            type="button"
            className={
              activeSection === "registrations"
                ? "nav-active"
                : ""
            }
            onClick={() => navigate("registrations")}
          >
            <Users size={19} />
            Registrations
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="admin-identity">
            <strong>{admin.displayName}</strong>
            <small>{admin.email}</small>
          </div>

          <button
            type="button"
            onClick={() => void handleLogout()}
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="eyebrow">
              EVENT MANAGEMENT SYSTEM
            </span>

            <h1>
              {detail
                ? "Applicant Details"
                : activeSection === "registrations"
                  ? "Applicant Registrations"
                  : "Dashboard Overview"}
            </h1>
          </div>

          <div className="topbar-user">
            <ShieldCheck size={18} />
            {admin.displayName}
          </div>
        </header>

        {error && (
          <div className="admin-error" role="alert">
            {error}
          </div>
        )}

        {detail ? (
          <section className="detail-view">
            <button
              type="button"
              className="back-link"
              onClick={() => navigate("registrations")}
            >
              <ArrowLeft size={17} />
              Back to registrations
            </button>

            <div className="panel">
              <div className="panel-title">
                <h2>{detail.registration.applicant_full_name}</h2>

                <div className="admin-export-actions">
                  <button
                    type="button"
                    className="table-view-button"
                    onClick={() => void downloadApplicantPDF()}
                    disabled={downloading !== ""}
                  >
                    <FileDown size={17} />
                    {downloading.startsWith("pdf-")
                      ? "Generating PDF..."
                      : "Download PDF"}
                  </button>

                  <span className="status-pill">
                    {detail.registration.status}
                  </span>
                </div>
              </div>

              <p className="registration-id">
                {detail.registration.id}
              </p>

              <div className="details-grid">
                {(
                  [
                    [
                      "Applicant Full Name",
                      detail.registration.applicant_full_name,
                    ],
                    [
                      "Date of Birth",
                      detail.registration.date_of_birth,
                    ],
                    ["Gender", detail.registration.gender],
                    ["Email Address", detail.registration.email],
                    ["Contact Number", detail.registration.phone],
                    [
                      "Full Address",
                      detail.registration.full_address,
                    ],
                    [
                      "Form Language",
                      detail.registration.language === "ta"
                        ? "Tamil"
                        : "English",
                    ],
                    [
                      "Submitted At",
                      dateText(detail.registration.submitted_at),
                    ],
                  ] as [string, string | undefined][]
                ).map(([label, value]) => (
                  <div className="detail-field" key={label}>
                    <span>{label}</span>
                    <strong>{value || "—"}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <h2>Achievements &amp; Qualifications</h2>

              <div className="answers-list">
                {QUESTIONS.map((question, index) => {
                  const answer = detail.answers.find(
                    (item) => item.question_id === question.id
                  )?.answer;

                  return (
                    <div
                      className="answer-item"
                      key={question.id}
                    >
                      <span className="question-number">
                        {index + 1}
                      </span>

                      <div>
                        <strong>
                          {detail.registration.language === "ta"
                            ? question.ta
                            : question.short}
                        </strong>

                        <p>
                          {answerLabel(
                            answer,
                            detail.registration.language === "ta"
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="panel">
              <h2>
                <FolderOpen size={20} />
                Supporting Certificates
              </h2>

              {detail.documents.length === 0 ? (
                <p className="empty-text">
                  No certificates uploaded.
                </p>
              ) : (
                <div className="document-list">
                  {detail.documents.map((file) => (
                    <div
                      className="document-item"
                      key={file.id}
                    >
                      <FileText size={22} />

                      <div>
                        <strong>{file.original_filename}</strong>

                        <small>
                          {QUESTIONS.find(
                            (question) =>
                              question.id === file.question_id
                          )?.short || file.question_id}
                          {" · "}
                          {(
                            file.file_size_bytes / 1048576
                          ).toFixed(2)}
                          {" MB · "}
                          {file.upload_status}
                        </small>
                      </div>

                      <button
                        type="button"
                        disabled={
                          file.upload_status !== "verified" ||
                          downloading !== ""
                        }
                        onClick={() =>
                          void downloadAdminFile(
                            `/api/admin/registrations/${encodeURIComponent(
                              detail.registration.id
                            )}/documents/${encodeURIComponent(
                              file.id
                            )}/download`,
                            file.original_filename,
                            `certificate-${file.id}`
                          )
                        }
                      >
                        <Download size={17} />

                        {downloading === `certificate-${file.id}`
                          ? "Downloading..."
                          : "Download"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="panel">
              <h2>
                <Mail size={20} />
                Confirmation Email
              </h2>

              {detail.emails.length === 0 ? (
                <p className="empty-text">
                  No email has been queued.
                </p>
              ) : (
                detail.emails.map((mail) => (
                  <div
                    className="email-record"
                    key={mail.id}
                  >
                    <span>{mail.recipient_email}</span>

                    <span>
                      Status: <strong>{mail.status}</strong>
                    </span>

                    <span>Attempts: {mail.attempts}</span>

                    {mail.last_error && (
                      <p>{mail.last_error}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        ) : (
          <>
            {activeSection === "dashboard" && (
              <section className="stats-grid">
                {[
                  {
                    label: "Total Applicants",
                    value: stats?.registrations.total ?? 0,
                    Icon: Users,
                  },
                  {
                    label: "Submitted",
                    value: stats?.registrations.submitted ?? 0,
                    Icon: ShieldCheck,
                  },
                  {
                    label: "Certificates",
                    value: stats?.documents.total ?? 0,
                    Icon: FolderOpen,
                  },
                  {
                    label: "Emails Accepted",
                    value: stats?.emails.accepted ?? 0,
                    Icon: Mail,
                  },
                ].map(({ label, value, Icon }) => (
                  <div className="stat-card" key={label}>
                    <div className="stat-icon">
                      <Icon size={22} />
                    </div>

                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </section>
            )}

            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>
                    {activeSection === "registrations"
                      ? "All Applicant Registrations"
                      : "Recent Applicant Registrations"}
                  </h2>

                  <p>{total} records found</p>
                </div>

                <div className="admin-export-actions">
                  {activeSection === "registrations" && (
                    <button
                      type="button"
                      className="table-view-button"
                      disabled={downloading !== ""}
                      onClick={() =>
                        void downloadAdminFile(
                          "/api/admin/registrations/export.csv",
                          "Winter_Get_Together_Registrations_2026.csv",
                          "csv"
                        )
                      }
                    >
                      <FileSpreadsheet size={17} />
                      {downloading === "csv"
                        ? "Exporting..."
                        : "Export All CSV"}
                    </button>
                  )}

                  <button
                    type="button"
                    className="table-view-button"
                    aria-label="Refresh applicant records"
                    disabled={loading}
                    onClick={() =>
                      setRefreshKey((value) => value + 1)
                    }
                  >
                    <RefreshCw
                      size={19}
                      className={loading ? "spin" : ""}
                    />
                    Refresh
                  </button>
                </div>
              </div>

              <div className="search-box">
                <Search size={19} />

                <input
                  type="search"
                  placeholder="Search applicant name, email, phone or registration ID"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div className="table-scroll">
                <table className="applicants-table">
                  <thead>
                    <tr>
                      <th>Applicant</th>
                      <th>Contact</th>
                      <th>Documents</th>
                      <th>Status</th>
                      <th>Email</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {registrations.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>
                            {item.applicant_full_name}
                          </strong>
                          <small>{item.id}</small>
                        </td>

                        <td>
                          {item.email}
                          <small>{item.phone}</small>
                        </td>

                        <td>{item.document_count ?? 0}</td>

                        <td>
                          <span className="status-pill">
                            {item.status}
                          </span>
                        </td>

                        <td>
                          {item.email_status || "Not queued"}
                        </td>

                        <td>
                          <button
                            type="button"
                            className="table-view-button"
                            disabled={busy}
                            onClick={() =>
                              void openApplicant(item.id)
                            }
                          >
                            View
                            <ArrowRight size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!loading && registrations.length === 0 && (
                <p className="empty-text">
                  No registrations found.
                </p>
              )}

              <div className="pagination">
                <span>
                  Page {page} of{" "}
                  {Math.max(1, Math.ceil(total / PAGE_SIZE))}
                </span>

                <div>
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() =>
                      setPage((value) => value - 1)
                    }
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    disabled={
                      page * PAGE_SIZE >= total || loading
                    }
                    onClick={() =>
                      setPage((value) => value + 1)
                    }
                  >
                    Next
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
