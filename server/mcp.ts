import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { Express, Request, Response, NextFunction } from "express";

const MCP_SERVER_NAME = "TELE-M3D-ECG-MCP";
const MCP_SERVER_VERSION = "1.0.0";
const MODEL_REFERENCE = "g-hKnYr7yJl-ecg-reader";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://chat.openai.com",
  "https://chatgpt.com",
];

function getAllowedOrigins(): string[] {
  const extra = process.env.MCP_CORS_ORIGINS;
  if (extra) {
    return [...DEFAULT_ALLOWED_ORIGINS, ...extra.split(",").map((o) => o.trim()).filter(Boolean)];
  }
  return DEFAULT_ALLOWED_ORIGINS;
}

const TOOLS = [
  {
    name: "analyzeTELEECG",
    description:
      "Analyze an ECG image using AI-powered analysis. Accepts a base64-encoded ECG image and optional patient context. Returns detailed cardiac interpretation, key findings, severity level, presumptive diagnosis, differential diagnoses, and recommended conduct.",
    inputSchema: {
      type: "object" as const,
      properties: {
        imageBase64: {
          type: "string",
          description: "Base64-encoded ECG image data",
        },
        patientContext: {
          type: "object",
          description:
            "Optional patient context including age, sex, symptoms, medical history",
          properties: {
            age: { type: "number", description: "Patient age in years" },
            sex: { type: "string", description: "Patient sex (M/F)" },
            symptoms: {
              type: "string",
              description: "Current symptoms description",
            },
            medicalHistory: {
              type: "string",
              description: "Relevant medical history",
            },
          },
        },
      },
      required: ["imageBase64"],
    },
  },
  {
    name: "getTELEReport",
    description:
      "Retrieve a study report by its ID. Returns the full diagnostic report including findings, interpretations, and recommendations.",
    inputSchema: {
      type: "object" as const,
      properties: {
        studyId: {
          type: "string",
          description: "The unique identifier of the study/observation report to retrieve",
        },
      },
      required: ["studyId"],
    },
  },
  {
    name: "uploadTELEStudy",
    description:
      "Upload a new ECG study for a patient. Creates a study record with the provided ECG data and patient information.",
    inputSchema: {
      type: "object" as const,
      properties: {
        patientId: {
          type: "string",
          description: "The FHIR patient ID to associate the study with",
        },
        imageBase64: {
          type: "string",
          description: "Base64-encoded ECG image data",
        },
        studyType: {
          type: "string",
          description: "Type of study (e.g., '12-lead', 'holter', 'stress')",
        },
        notes: {
          type: "string",
          description: "Optional clinical notes for the study",
        },
      },
      required: ["patientId", "imageBase64"],
    },
  },
  {
    name: "listTELEStudies",
    description:
      "List ECG studies for a specific patient. Returns all studies associated with the patient including dates, types, and status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        patientId: {
          type: "string",
          description: "The FHIR patient ID to list studies for",
        },
      },
      required: ["patientId"],
    },
  },
];

const analyzeECGSchema = z.object({
  imageBase64: z.string().min(1, "imageBase64 is required"),
  patientContext: z.object({
    age: z.number().optional(),
    sex: z.string().optional(),
    symptoms: z.string().optional(),
    medicalHistory: z.string().optional(),
  }).optional(),
});

const getReportSchema = z.object({
  studyId: z.string().uuid("studyId must be a valid UUID"),
});

const uploadStudySchema = z.object({
  patientId: z.string().uuid("patientId must be a valid UUID"),
  imageBase64: z.string().min(1, "imageBase64 is required"),
  studyType: z.string().optional(),
  notes: z.string().optional(),
});

const listStudiesSchema = z.object({
  patientId: z.string().uuid("patientId must be a valid UUID"),
});

function getInternalBaseUrl(): string {
  const port = process.env.PORT || "5000";
  return `http://localhost:${port}`;
}

async function proxyToApi(
  path: string,
  method: "GET" | "POST",
  body?: any
): Promise<any> {
  const baseUrl = getInternalBaseUrl();
  const url = `${baseUrl}${path}`;
  const secret = process.env.TELE_M3D_SECRET;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret) {
    headers["X-MCP-Auth"] = secret;
  }

  const options: RequestInit = { method, headers };
  if (body && method === "POST") {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    const errMsg = data?.message || data?.error || JSON.stringify(data);
    throw new Error(`API ${method} ${path} returned ${response.status}: ${errMsg}`);
  }

  return data;
}

async function handleToolCall(
  name: string,
  args: Record<string, any>
): Promise<any> {
  switch (name) {
    case "analyzeTELEECG": {
      const validated = analyzeECGSchema.parse(args);
      const result = await proxyToApi("/api/ecg/analyze", "POST", {
        imageBase64: validated.imageBase64,
        patientContext: validated.patientContext || {},
      });
      const { immersive_image, ...rest } = result;
      return rest;
    }

    case "getTELEReport": {
      const validated = getReportSchema.parse(args);
      return await proxyToApi(`/api/study-report/${validated.studyId}`, "GET");
    }

    case "uploadTELEStudy": {
      const validated = uploadStudySchema.parse(args);
      return await proxyToApi("/api/studies", "POST", {
        patientId: validated.patientId,
        imageBase64: validated.imageBase64,
        studyType: validated.studyType || "12-lead",
        notes: validated.notes || "",
      });
    }

    case "listTELEStudies": {
      const validated = listStudiesSchema.parse(args);
      return await proxyToApi(
        `/api/patient/${validated.patientId}/studies`,
        "GET"
      );
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function mcpAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.TELE_M3D_SECRET;
  if (!secret) {
    res.status(503).json({
      error: "MCP server not configured: TELE_M3D_SECRET environment variable is required",
    });
    return;
  }

  const authHeader = req.headers.authorization;
  const mcpHeader = req.headers["x-mcp-auth"] as string | undefined;

  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : mcpHeader;

  if (token === secret) {
    next();
    return;
  }

  res.status(401).json({ error: "Unauthorized: invalid or missing MCP authentication token" });
}

function setCorsHeaders(req: Request, res: Response): void {
  const origin = req.headers.origin;
  const allowed = getAllowedOrigins();
  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-MCP-Auth, Accept, Cache-Control"
  );
  res.setHeader("Access-Control-Expose-Headers", "Content-Type");
}

export function setupMcpServer(app: Express): void {
  const transports: Map<string, SSEServerTransport> = new Map();

  app.options("/mcp", (req: Request, res: Response) => {
    setCorsHeaders(req, res);
    res.status(204).end();
  });

  app.options("/mcp/message", (req: Request, res: Response) => {
    setCorsHeaders(req, res);
    res.status(204).end();
  });

  app.get("/mcp", mcpAuthMiddleware, async (req: Request, res: Response) => {
    setCorsHeaders(req, res);

    const server = new Server(
      { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOLS,
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        const result = await handleToolCall(name, args || {});
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        const message =
          error instanceof z.ZodError
            ? `Validation error: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
            : error.message;
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${message}`,
            },
          ],
          isError: true,
        };
      }
    });

    const transport = new SSEServerTransport("/mcp/message", res);
    transports.set(transport.sessionId, transport);

    transport.onclose = () => {
      transports.delete(transport.sessionId);
    };

    await server.connect(transport);
  });

  app.post("/mcp/message", mcpAuthMiddleware, async (req: Request, res: Response) => {
    setCorsHeaders(req, res);

    const sessionId = req.query.sessionId as string;
    const transport = transports.get(sessionId);

    if (!transport) {
      res.status(400).json({ error: "Invalid or expired session ID" });
      return;
    }

    await transport.handlePostMessage(req, res);
  });

  app.get("/health", (req: Request, res: Response) => {
    setCorsHeaders(req, res);

    res.json({
      status: "ok",
      server: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
      modelReference: MODEL_REFERENCE,
      transport: "sse",
      endpoints: {
        mcp: "/mcp",
        mcpMessage: "/mcp/message",
        health: "/health",
      },
      tools: TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
      })),
      timestamp: new Date().toISOString(),
    });
  });

  console.log(`[MCP] ${MCP_SERVER_NAME} v${MCP_SERVER_VERSION} initialized`);
  console.log(`[MCP] SSE endpoint: /mcp`);
  console.log(`[MCP] Message endpoint: /mcp/message`);
  console.log(`[MCP] Health endpoint: /health`);
}
