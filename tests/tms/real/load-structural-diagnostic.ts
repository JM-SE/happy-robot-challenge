import { getTmsConfig } from "../../../src/tms/config-core";
import { buildRequest } from "../../../src/tms/protocol";
import { connectTcp } from "../../../src/tms/transport";
import { fileURLToPath } from "node:url";

const FIELD_NAME = /^[A-Z][A-Z0-9_]*$/;
const SENSITIVE_FIELD_NAMES = new Set([
  "LOAD_ID",
  "MC_NUM",
  "RATE",
  "NOTES",
  "MAX_BUY",
  "AGREED_RATE",
  "AUTH",
  "TOKEN",
]);

export type StructuralLineClassification = "RECORD" | "END" | "ERR" | "INVALID";

export interface StructuralLineDiagnostic {
  lineIndex: number;
  classification: StructuralLineClassification;
  segmentCount: number;
  invalidSegmentIndexes: number[];
  fieldNames: string[];
  hasPipe: boolean;
  hasCR: boolean;
  hasLF: boolean;
  errorCategories: string[];
}

export interface LoadStructuralDiagnostic {
  totalResponseByteLength: number;
  totalLineCount: number;
  lines: StructuralLineDiagnostic[];
}

function responseLines(response: Buffer): Buffer[] {
  const lines: Buffer[] = [];
  let start = 0;
  for (let index = 0; index < response.length; index += 1) {
    if (response[index] === 10) {
      lines.push(response.subarray(start, index + 1));
      start = index + 1;
    }
  }
  if (start < response.length) lines.push(response.subarray(start));
  return lines;
}

function withoutLineEnding(line: Buffer): { body: string; hasCRLF: boolean } {
  const hasCRLF = line.length >= 2 && line[line.length - 2] === 13 && line[line.length - 1] === 10;
  let body = line;
  if (body.at(-1) === 10) body = body.subarray(0, -1);
  if (body.at(-1) === 13) body = body.subarray(0, -1);
  return { body: body.toString("latin1"), hasCRLF };
}

function inspectSegments(body: string, offset = 0): Pick<StructuralLineDiagnostic, "segmentCount" | "invalidSegmentIndexes" | "fieldNames" | "errorCategories"> {
  const segments = body ? body.split("|") : [];
  const invalidSegmentIndexes: number[] = [];
  const fieldNames: string[] = [];
  const errorCategories: string[] = [];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (!segment) {
      invalidSegmentIndexes.push(index + offset);
      errorCategories.push("EMPTY_SEGMENT");
      continue;
    }

    const separator = segment.indexOf(":");
    if (separator < 0) {
      invalidSegmentIndexes.push(index + offset);
      errorCategories.push("NO_COLON");
      continue;
    }
    if (separator === 0) {
      invalidSegmentIndexes.push(index + offset);
      errorCategories.push("EMPTY_FIELD_NAME");
      continue;
    }

    const name = segment.slice(0, separator).trim();
    if (!FIELD_NAME.test(name)) {
      invalidSegmentIndexes.push(index + offset);
      errorCategories.push("INVALID_FIELD_NAME");
      continue;
    }
    if (!SENSITIVE_FIELD_NAMES.has(name)) fieldNames.push(name);
  }

  return {
    segmentCount: segments.length + offset,
    invalidSegmentIndexes: [...new Set(invalidSegmentIndexes)],
    fieldNames: [...new Set(fieldNames)].sort(),
    errorCategories: [...new Set(errorCategories)],
  };
}

export function diagnoseLoadGetResponse(response: Buffer): LoadStructuralDiagnostic {
  let sawEnd = false;
  const lines = responseLines(response).map((line, lineIndex) => {
    const { body, hasCRLF } = withoutLineEnding(line);
    const hasCR = line.includes(13);
    const hasLF = line.includes(10);
    const hasPipe = body.includes("|");
    const errorCategories: string[] = [];
    let classification: StructuralLineClassification = "RECORD";
    let inspected: ReturnType<typeof inspectSegments> = {
      segmentCount: 0,
      invalidSegmentIndexes: [],
      fieldNames: [],
      errorCategories: [],
    };

    if (sawEnd) {
      classification = "INVALID";
      errorCategories.push("RESPONSE_AFTER_END");
    } else if (body === "END") {
      classification = hasCRLF ? "END" : "INVALID";
      if (!hasCRLF) errorCategories.push("INVALID_TERMINATOR");
      if (classification === "END") sawEnd = true;
    } else if (body.startsWith("ERR|")) {
      inspected = inspectSegments(body.slice(4), 1);
      classification = hasCRLF && inspected.errorCategories.length === 0 ? "ERR" : "INVALID";
      if (!hasCRLF) errorCategories.push("INVALID_TERMINATOR");
    } else if (!body) {
      classification = "INVALID";
      errorCategories.push("EMPTY_SEGMENT");
    } else {
      inspected = inspectSegments(body);
      if (!hasCRLF) errorCategories.push("INVALID_TERMINATOR");
      if (inspected.errorCategories.length > 0) classification = "INVALID";
    }

    const categories = [...new Set([...errorCategories, ...inspected.errorCategories])];
    return {
      lineIndex,
      classification,
      segmentCount: inspected.segmentCount || (body ? 1 : 0),
      invalidSegmentIndexes: inspected.invalidSegmentIndexes,
      fieldNames: inspected.fieldNames,
      hasPipe,
      hasCR,
      hasLF,
      errorCategories: categories,
    };
  });

  return {
    totalResponseByteLength: response.byteLength,
    totalLineCount: lines.length,
    lines,
  };
}

async function runOneRealLoadGet(): Promise<void> {
  const config = getTmsConfig();
  const loadId = process.env.TMS_REAL_LOAD_ID;
  if (config.mode !== "real" || !loadId) throw new Error("Real mode and an approved load id are required.");

  const request = buildRequest({
    command: "LOAD_GET",
    authToken: config.authToken,
    fields: { LOAD_ID: loadId },
  }, config.maxFrameBytes);
  const socket = connectTcp({ host: config.host, port: config.port });
  const chunks: Buffer[] = [];
  let connected = false;
  let settled = false;
  let timer: ReturnType<typeof setTimeout>;

  const finish = (outcome: string, errorCategory?: string) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    console.log(JSON.stringify({
      outcome,
      ...(errorCategory ? { errorCategory } : {}),
      ...diagnoseLoadGetResponse(Buffer.concat(chunks)),
    }, null, 2));
    socket.destroy();
  };

  socket.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))));
  socket.once("connect", () => {
    connected = true;
    clearTimeout(timer);
    timer = setTimeout(() => finish("incomplete", "RESPONSE_TIMEOUT"), config.responseTimeoutMs);
    socket.write(request, (error) => {
      if (error) finish("transport-error", "WRITE_ERROR");
    });
  });
  socket.once("error", () => finish("transport-error", connected ? "SOCKET_ERROR" : "CONNECT_ERROR"));
  socket.once("end", () => finish("captured", "PEER_END"));
  socket.once("close", () => finish("captured", "PEER_CLOSE"));
  timer = setTimeout(() => finish("incomplete", "CONNECT_TIMEOUT"), config.connectTimeoutMs);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runOneRealLoadGet().catch(() => {
    console.log(JSON.stringify({ outcome: "not-run", errorCategory: "CONFIGURATION_OR_SETUP_ERROR" }, null, 2));
    process.exitCode = 1;
  });
}
