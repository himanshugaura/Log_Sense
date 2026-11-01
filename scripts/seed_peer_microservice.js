import { prisma } from "../backend/dist/core/config/db.js";

async function main() {
  const orgId = "85ba6798-d27e-4f42-a98b-12214dac2b84"; // User's org

  // Check if payment-service already exists
  let paymentProj = await prisma.project.findFirst({
    where: { organizationId: orgId, name: "payment-service" },
  });

  if (!paymentProj) {
    paymentProj = await prisma.project.create({
      data: {
        organizationId: orgId,
        name: "payment-service",
        description: "Payment gateway integration, ledgering, and checkout transactions",
      },
    });
    console.log("Created payment-service project:", paymentProj.id);
  } else {
    console.log("payment-service already exists:", paymentProj.id);
  }

  // Create ParserState for payment-service
  let parserState = await prisma.parserState.findFirst({
    where: { projectId: paymentProj.id },
  });

  if (!parserState) {
    parserState = await prisma.parserState.create({
      data: {
        projectId: paymentProj.id,
        stateData: "{}",
      },
    });
  }

  // Create LogCluster for pool exhaustion
  let cluster = await prisma.logCluster.findFirst({
    where: {
      parserStateId: parserState.id,
      drainClusterId: 101,
    },
  });

  if (!cluster) {
    cluster = await prisma.logCluster.create({
      data: {
        parserStateId: parserState.id,
        drainClusterId: 101,
        template: "Connection pool exhausted: <*> connections active",
        occurrenceCount: 88,
      },
    });
  }

  // Check if historical resolved incident exists
  let incident = await prisma.incident.findFirst({
    where: {
      projectId: paymentProj.id,
      title: "PostgreSQL database connection pool exhaustion",
    },
  });

  if (!incident) {
    const startedAt = new Date(Date.now() - 48 * 3600 * 1000);
    const resolvedAt = new Date(Date.now() - 47 * 3600 * 1000);

    incident = await prisma.incident.create({
      data: {
        projectId: paymentProj.id,
        title: "PostgreSQL database connection pool exhaustion",
        description: "HikariCP database pool saturation causing transaction queue timeouts and 504s on /checkout",
        severity: "CRITICAL",
        status: "RESOLVED",
        startedAt,
        resolvedAt,
        resolutionNotes: `[Verified Resolution by Payment SRE Team]
Identified stuck analytical transaction holding shared table lock on payments_ledger.
1. Terminated blocking backend PID:
   SELECT pg_terminate_backend(4821);
2. Scaled HikariCP maxPoolSize from 20 to 50 in ConfigMap:
   connectionTimeout: 5000
   idleTimeout: 30000
   maxLifetime: 1800000
3. Performed rolling restart of payment worker pods:
   kubectl rollout restart deployment/payment-worker -n production`,
      },
    });

    // Create RCA Analysis
    const rca = await prisma.rcaAnalysis.create({
      data: {
        incidentId: incident.id,
        conclusion: "Database connection pool exhausted due to unindexed transaction lock",
        confidence: 0.94,
      },
    });

    // Create RootCauseCandidate
    await prisma.rootCauseCandidate.create({
      data: {
        analysisId: rca.id,
        clusterId: cluster.id,
        template: "Connection pool exhausted: <*> connections active",
        totalScore: 14.5,
        temporalPoints: 5,
        frequencyPoints: 4.5,
        classificationPoints: 3,
        relationshipPoints: 2,
        rank: 1,
        explanation: "Primary initiating failure: PostgreSQL connection starvation on payments_ledger.",
      },
    });

    // Create Incident Summary
    await prisma.incidentSummary.create({
      data: {
        incidentId: incident.id,
        summary: "HikariCP connection pool exhausted after analytical query saturated active connections.",
        model: "gemini-flash-latest",
        recommendations: {
          whatMightBeCausingIt: "Database connection pool exhausted: 20 connections active, request timed out after 30000ms.",
          immediateRemediationSteps: "Terminate blocking query with pg_terminate_backend and increase max pool size to 50.",
          preventionPlan: "Add statement_timeout = 10000ms in postgresql.conf and enforce read-replica routing for analytical queries.",
        },
      },
    });

    console.log("Created historical resolved incident:", incident.id);
  } else {
    console.log("Historical incident already exists:", incident.id);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
