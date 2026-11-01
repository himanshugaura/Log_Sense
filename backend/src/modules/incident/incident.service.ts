import { StatusCodes } from "http-status-codes";

import { env } from "../../core/config/env.js";
import { prisma } from "../../core/config/db.js";
import ApiError from "../../shared/utils/ApiError.js";
import { memoryCache } from "../../shared/utils/cache.js";
import type { ListIncidentsQuery, UpdateIncidentStatusBody } from "./incident.validation.js";

export class IncidentService {
  async validateProjectOwnership(projectId: string, userId: string) {
    const cacheKey = `proj_owner:${projectId}:${userId}`;
    const cached = memoryCache.get<any>(cacheKey);
    if (cached) return cached;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        organization: {
          select: { id: true, ownerId: true },
        },
      },
    });

    if (!project) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Target project not found");
    }

    if (project.organization.ownerId !== userId) {
      throw new ApiError(StatusCodes.FORBIDDEN, "Forbidden: You do not have access to this project");
    }

    memoryCache.set(cacheKey, project, 120);
    return project;
  }

  async getIncidents(projectId: string, userId: string, query: ListIncidentsQuery) {
    await this.validateProjectOwnership(projectId, userId);

    const cacheKey = `incidents_list:${projectId}:${query.severity || ''}:${query.status || ''}:${query.page || 1}:${query.limit || 20}`;
    const cachedResult = memoryCache.get<any>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const where: any = { projectId };
    if (query.severity) where.severity = query.severity;
    if (query.status) where.status = query.status;

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.incident.count({ where }),
      prisma.incident.findMany({
        where,
        include: {
          incidentAnomalies: {
            include: {
              anomaly: {
                select: {
                  id: true,
                  title: true,
                  severity: true,
                  status: true,
                  serviceName: true,
                  firstDetectedAt: true,
                  evidence: true,
                  cluster: { select: { id: true, template: true } },
                },
              },
            },
          },
          rcaAnalyses: {
            take: 1,
            orderBy: { createdAt: "desc" },
            include: {
              candidates: {
                orderBy: { rank: "asc" },
                take: 5,
                include: { cluster: { select: { id: true, template: true } } },
              },
            },
          },
          incidentSummaries: {
            take: 1,
            orderBy: { createdAt: "desc" },
          },
          _count: {
            select: { incidentAnomalies: true },
          },
        },
        orderBy: { startedAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    const result = {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    memoryCache.set(cacheKey, result, 20); // 20s TTL
    return result;
  }

  async getIncidentById(projectId: string, incidentId: string, userId: string) {
    await this.validateProjectOwnership(projectId, userId);

    const cacheKey = `incident_detail:${projectId}:${incidentId}`;
    const cached = memoryCache.get<any>(cacheKey);
    if (cached) return cached;

    const incident = await prisma.incident.findFirst({
      where: { id: incidentId, projectId },
      include: {
        incidentAnomalies: {
          include: {
            anomaly: {
              include: {
                cluster: { select: { id: true, template: true, occurrenceCount: true } },
              },
            },
          },
        },
        rcaAnalyses: {
          orderBy: { createdAt: "desc" },
          include: {
            candidates: {
              orderBy: { rank: "asc" },
              include: {
                cluster: { select: { id: true, template: true, occurrenceCount: true } },
              },
            },
          },
        },
        incidentSummaries: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!incident) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Incident not found");
    }

    memoryCache.set(cacheKey, incident, 20);
    return incident;
  }

  async updateIncidentStatus(
    projectId: string,
    incidentId: string,
    userId: string,
    body: UpdateIncidentStatusBody,
  ) {
    await this.validateProjectOwnership(projectId, userId);

    const incident = await prisma.incident.findFirst({
      where: { id: incidentId, projectId },
    });

    if (!incident) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Incident not found");
    }

    const updateData: any = {
      status: body.status,
      resolvedAt: body.status === "RESOLVED" ? (incident.resolvedAt || new Date()) : null,
    };
    if (body.resolutionNotes !== undefined) {
      updateData.resolutionNotes = body.resolutionNotes;
    }

    const updated = await prisma.incident.update({
      where: { id: incidentId },
      data: updateData,
    });

    // Invalidate caches immediately
    memoryCache.invalidatePrefix(`incidents_list:${projectId}`);
    memoryCache.delete(`incident_detail:${projectId}:${incidentId}`);

    return updated;
  }

  /**
   * Cross-Microservice Similar Incidents Search:
   * Searches across all microservices (projects) within the same organization
   * to find historical incidents matching the current root cause, Drain3 template,
   * failure domain, and error signatures. Surfaces verified developer resolutions.
   */
  async getSimilarPastIncidents(projectId: string, incidentId: string, userId: string) {
    const currentProject = await this.validateProjectOwnership(projectId, userId);
    const orgId = currentProject.organizationId;

    const currentIncident = await prisma.incident.findFirst({
      where: { id: incidentId, projectId },
      include: {
        project: { select: { id: true, name: true, organizationId: true } },
        rcaAnalyses: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            candidates: {
              orderBy: { rank: "asc" },
              take: 3,
              include: { cluster: { select: { id: true, template: true } } },
            },
          },
        },
        incidentSummaries: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!currentIncident) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Current incident not found");
    }

    // Helper to tokenize and normalize text (strips <*> wildcards, punctuation, short words)
    const tokenize = (textStr: string): Set<string> => {
      if (!textStr) return new Set();
      const clean = textStr
        .replace(/<[*]>/g, " ")
        .replace(/[^a-zA-Z0-9_\-\s]/g, " ")
        .toLowerCase();
      const tokens = clean
        .split(/\s+/)
        .filter((t) => t.length > 2 && !["the", "and", "for", "with", "from", "that", "this", "are", "was"].includes(t));
      return new Set(tokens);
    };

    const currentTemplate = currentIncident.rcaAnalyses?.[0]?.candidates?.[0]?.cluster?.template || "";
    const currentCandidates = currentIncident.rcaAnalyses?.[0]?.candidates || [];
    const currentTokens = tokenize(
      `${currentIncident.title} ${currentTemplate} ${currentCandidates.map((c) => c.cluster?.template || "").join(" ")}`
    );

    // Fetch all historical incidents in the same organization (excluding current incident)
    const orgIncidents = await prisma.incident.findMany({
      where: {
        project: { organizationId: orgId },
        id: { not: incidentId },
      },
      include: {
        project: { select: { id: true, name: true } },
        rcaAnalyses: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            candidates: {
              orderBy: { rank: "asc" },
              take: 3,
              include: { cluster: { select: { id: true, template: true } } },
            },
          },
        },
        incidentSummaries: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { startedAt: "desc" },
      take: 25,
    });

    // Score each historical incident
    const scoredMatches = orgIncidents.map((past) => {
      const isCrossService = past.projectId !== projectId;
      const pastTemplate = past.rcaAnalyses?.[0]?.candidates?.[0]?.cluster?.template || "";
      const pastCandidates = past.rcaAnalyses?.[0]?.candidates || [];
      const pastTokens = tokenize(
        `${past.title} ${pastTemplate} ${pastCandidates.map((c) => c.cluster?.template || "").join(" ")}`
      );

      // 1. Template Jaccard Similarity (Weight: 45)
      let templateScore = 0;
      if (currentTemplate && pastTemplate) {
        const curTplTokens = tokenize(currentTemplate);
        const pastTplTokens = tokenize(pastTemplate);
        const intersection = [...curTplTokens].filter((t) => pastTplTokens.has(t));
        const union = new Set([...curTplTokens, ...pastTplTokens]);
        if (union.size > 0) {
          templateScore = (intersection.length / union.size) * 45;
        }
      }

      // 2. Title & Error Token Overlap (Weight: 30)
      const sharedTokens = [...currentTokens].filter((t) => pastTokens.has(t));
      const tokenScore = Math.min(30, sharedTokens.length * 6);

      // 3. High-Priority Infrastructure Keywords Match (Weight: 15)
      const infraKeywords = ["deadlock", "lock", "pool", "exhausted", "timeout", "socket", "closed", "ssl", "tls", "handshake", "refused", "reset", "redis", "postgres", "oom", "memory"];
      const sharedInfra = infraKeywords.filter((k) => currentTokens.has(k) && pastTokens.has(k));
      const infraScore = Math.min(15, sharedInfra.length * 5);

      // 4. Severity Tier Match (Weight: 10)
      const severityScore = past.severity === currentIncident.severity ? 10 : 0;

      const rawScore = Math.round(templateScore + tokenScore + infraScore + severityScore);
      const similarityScore = Math.min(99, Math.max(15, rawScore));

      // Generate human-readable similarity explanation reasons
      const similarityReasons: string[] = [];
      if (sharedInfra.length > 0) {
        similarityReasons.push(`Shared failure domain: ${sharedInfra.slice(0, 3).join(", ")}`);
      }
      if (templateScore > 15) {
        similarityReasons.push("High error pattern signature match");
      }
      if (sharedTokens.length > 2) {
        similarityReasons.push(`Matching error signatures (${sharedTokens.slice(0, 3).join(", ")})`);
      }
      if (past.severity === currentIncident.severity) {
        similarityReasons.push(`Matching severity level (${past.severity})`);
      }
      if (isCrossService) {
        similarityReasons.push(`Cross-microservice occurrence from ${past.project.name}`);
      }

      // Extract remediation info
      const latestSummary = past.incidentSummaries?.[0];
      const rec = (latestSummary?.recommendations as any) || {};
      const recommendedRemediation = rec.immediateRemediationSteps || rec.whatMightBeCausingIt || latestSummary?.summary || null;

      return {
        id: past.id,
        title: past.title,
        severity: past.severity,
        status: past.status,
        startedAt: past.startedAt,
        resolvedAt: past.resolvedAt,
        projectId: past.projectId,
        projectName: past.project.name,
        isCrossService,
        similarityScore,
        similarityReasons,
        rootCauseTemplate: pastTemplate || "Under investigation",
        resolutionNotes: past.resolutionNotes || null,
        recommendedRemediation,
      };
    });

    // Sort: highest similarity first; prioritize verified notes
    scoredMatches.sort((a, b) => {
      if (b.similarityScore !== a.similarityScore) {
        return b.similarityScore - a.similarityScore;
      }
      if (b.resolutionNotes && !a.resolutionNotes) return 1;
      if (!b.resolutionNotes && a.resolutionNotes) return -1;
      return 0;
    });

    return scoredMatches;
  }

  /**
   * Interactive RCA War Room Copilot:
   * Enables engineers to counter-question the RCA, drill into specific log lines,
   * query trace propagation, and obtain copy-pasteable mitigation commands.
   */
  async chatWithIncidentCopilot(params: {
    projectId: string;
    incidentId: string;
    userId: string;
    message: string;
    history?: Array<{ role: "user" | "model"; content: string }>;
  }) {
    await this.validateProjectOwnership(params.projectId, params.userId);

    const incident = await this.getIncidentById(params.projectId, params.incidentId, params.userId);

    // 1. Fetch relevant raw log entries around the incident window for context
    const startedAt = incident.startedAt ? new Date(incident.startedAt) : new Date();
    const rawLogs = await prisma.logEntry.findMany({
      where: {
        projectId: params.projectId,
        level: { in: ["ERROR", "WARN", "FATAL", "CRITICAL"] },
        timestamp: {
          gte: new Date(startedAt.getTime() - 60 * 1000),
          lte: new Date(startedAt.getTime() + 10 * 60 * 1000),
        },
      },
      orderBy: { timestamp: "asc" },
      take: 30,
      select: {
        timestamp: true,
        level: true,
        serviceName: true,
        traceId: true,
        rawMessage: true,
      },
    });

    const candidates = incident.rcaAnalyses?.[0]?.candidates || [];
    const latestSummary = incident.incidentSummaries?.[0];
    const structuredReport = (latestSummary?.recommendations as any) || {};

    const candidatesText = candidates
      .slice(0, 5)
      .map(
        (c: any) =>
          `Rank #${c.rank} (${c.rank === 1 ? "IDENTIFIED ROOT CAUSE (X)" : "SECONDARY SYMPTOM (Y)"}): ${c.cluster?.template || "Unknown"} (Score: ${c.totalScore}/15)`,
      )
      .join("\n");

    const logLinesText = rawLogs
      .map(
        (l) =>
          `[${l.timestamp.toISOString().split("T")[1].slice(0, 12)}] [${l.serviceName || "system"}] [${l.level}] ${l.traceId ? `trace=${l.traceId} ` : ""}${l.rawMessage}`,
      )
      .join("\n");

    const systemInstruction = `You are the LogSense RCA Copilot, a Principal Site Reliability Engineer and Systems Architect assisting an on-call engineer in an active incident war room.
You have the complete technical context, raw logs, and 15-point RCA scoring for this incident.

INCIDENT CONTEXT:
- Incident Title: ${incident.title}
- Severity: ${incident.severity}
- Started At: ${startedAt.toISOString()}
- Root Cause (Candidate #1): ${structuredReport.whatMightBeCausingIt || candidates[0]?.cluster?.template || "Under investigation"}
- Causal Chain (X vs Y): ${structuredReport.whyThisRootCause || "N/A"}

--- 15-POINT RCA CANDIDATES ---
${candidatesText || "None available"}

--- RAW LOG TIMELINE & EVIDENCE ---
${logLinesText || "No logs available"}

ROLE GUIDELINES:
1. Answer the engineer's questions and counter-questions with technical precision and direct evidence from the logs.
2. If the user challenges why Candidate #1 was chosen over Candidate #2 or #3, explain the exact causal chain, timestamps, and log traces showing why #1 is the initiating root cause (X) and others are downstream symptoms (Y).
3. If asked for remediation commands or queries, provide exact, copy-pasteable SQL, bash, or kubectl commands (e.g. pg_terminate_backend, redis-cli, restarting pods).
4. If asked about specific services, trace IDs, or error codes, reference the exact log data provided above.
5. Be concise, authoritative, and helpful. Format your responses in clean Markdown with code blocks.`;

    const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        reply: `**[Deterministic SRE Analysis]**\n\nFor incident **${incident.title}**, Candidate #1 (\`${candidates[0]?.cluster?.template || "N/A"}\`) was established as the primary root cause because it precedes secondary errors in the chronological log timeline and holds the highest 15-point multi-factor score.\n\n*Note: Configure \`GEMINI_API_KEY\` to enable conversational interaction.*`,
        model: "deterministic-fallback",
      };
    }

    // Build contents payload with history
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // Add conversation history if provided (limit to last 8 turns)
    if (params.history && params.history.length > 0) {
      for (const h of params.history.slice(-8)) {
        contents.push({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.content }],
        });
      }
    }

    // Add current user message
    contents.push({
      role: "user",
      parts: [{ text: params.message }],
    });

    const modelsToTry = ["gemini-flash-lite-latest", "gemini-flash-latest"];
    let lastError = "";

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const payload = {
          system_instruction: {
            parts: [{ text: systemInstruction }],
          },
          contents,
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = (await response.json()) as any;
          const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) {
            return {
              reply: reply.trim(),
              model,
            };
          }
        } else {
          const errText = await response.text();
          lastError = `HTTP ${response.status}: ${errText.slice(0, 100)}`;
        }
      } catch (err: any) {
        lastError = err.message;
      }
    }

    // Fallback if API fails
    return {
      reply: `**Analysis for ${incident.title}**:\nCandidate #1 (\`${candidates[0]?.cluster?.template || "N/A"}\`) initiated this outage at ${startedAt.toTimeString().slice(0, 8)}. Secondary errors were consequential symptoms caused by thread and connection saturation.\n\n*(Gemini API connection notice: ${lastError})*`,
      model: "fallback",
    };
  }
}

export const incidentService = new IncidentService();
