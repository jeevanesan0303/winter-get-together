
import {
  MAX_FILE_SIZE,
  type QuestionId,
} from "../validators/registration";

export interface StoredDocument {
  key: string;
  storedFilename: string;
  mimeType: string;
  size: number;
}

function safeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 70) || "Applicant";
}

export function getApplicantFolder(
  applicantName: string,
  registrationId: string
): string {
  return [
    "2026",
    `${safeName(applicantName)}_${registrationId}`,
  ].join("/");
}

function detectFileType(
  bytes: Uint8Array
): { mimeType: string; extension: string } | null {
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return {
      mimeType: "application/pdf",
      extension: "pdf",
    };
  }

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return {
      mimeType: "image/jpeg",
      extension: "jpg",
    };
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return {
      mimeType: "image/png",
      extension: "png",
    };
  }

  return null;
}

export async function storeCertificate(
  bucket: R2Bucket,
  applicantName: string,
  registrationId: string,
  questionId: QuestionId,
  file: File
): Promise<StoredDocument> {
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    throw new Error("File must be between 1 byte and 20 MB.");
  }

  if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) {
    throw new Error("Only PDF, JPG and PNG files are allowed.");
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const detected = detectFileType(bytes);

  if (!detected) {
    throw new Error("Invalid PDF or image file.");
  }

  const allowedExtensions: Record<string, string[]> = {
    pdf: ["pdf"],
    jpg: ["jpg", "jpeg"],
    png: ["png"],
  };

  const originalExtension =
    file.name.split(".").pop()?.toLowerCase() ?? "";

  if (
    !allowedExtensions[detected.extension]
      .includes(originalExtension)
  ) {
    throw new Error("File extension does not match file contents.");
  }

  const folder = getApplicantFolder(
    applicantName,
    registrationId
  );

  const storedFilename =
    `${questionId}_${crypto.randomUUID()}.${detected.extension}`;

  const key = `${folder}/${storedFilename}`;

  await bucket.put(key, buffer, {
    httpMetadata: {
      contentType: detected.mimeType,
    },
    customMetadata: {
      registrationId,
      questionId,
    },
  });

  return {
    key,
    storedFilename,
    mimeType: detected.mimeType,
    size: file.size,
  };
}
