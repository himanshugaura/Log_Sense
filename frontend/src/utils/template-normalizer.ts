/**
 * Rule-Based Log Template Normalizer for LogicSense.
 *
 * Maps raw Drain3 log templates containing technical wording, wildcards and dynamic
 * placeholders (<*>, [<*>], /<*>) into clean, concise, human-readable display titles
 * and short descriptions for general users.
 *
 * Preserves the original Drain3 templates without modification for clustering,
 * statistical anomaly detection, and deterministic 15-point RCA calculations.
 */

export interface NormalizerRule {
  id: string;
  pattern: RegExp;
  displayTitle: string;
  category: string;
  shortDescription: string;
}

export interface NormalizedTemplateResult {
  displayTitle: string;
  category: string;
  shortDescription: string;
  isMatched: boolean;
  ruleId: string;
}

/**
 * Configurable, easily extensible normalization rules.
 * Uses targeted regular expressions to avoid overly broad keyword misclassifications.
 */
export const NORMALIZER_RULES: NormalizerRule[] = [
  // 1. User-specified example: "Established session <*> with negotiated timeout <*> for client /<*>"
  {
    id: 'session_establishment_issue',
    pattern: /\bestablished\s+session\b.*\bnegotiated\s+timeout\b/i,
    displayTitle: 'Session establishment issue',
    category: 'Session & Consensus',
    shortDescription: 'Repeated session renegotiation or connection establishment disturbance detected.',
  },
  // 2. User-specified example: "Expiring session <*>, timeout of 10000ms exceeded"
  {
    id: 'session_timeout_exceeded',
    pattern: /\bexpiring\s+session\b.*\btimeout.*exceeded\b/i,
    displayTitle: 'Session timeout exceeded',
    category: 'Session & Consensus',
    shortDescription: 'Client session expired after exceeding the configured heartbeat lease timeout window.',
  },
  // 3. User-specified example: "caught end of stream exception"
  {
    id: 'connection_stream_interrupted',
    pattern: /\bcaught\s+end\s+of\s+stream\s+exception\b/i,
    displayTitle: 'Connection stream interrupted',
    category: 'Network & Transport',
    shortDescription: 'Network communication stream terminated prematurely by the remote peer or intermediary gateway.',
  },
  // 4. User-specified example: "Database connection failed for user <*>"
  {
    id: 'database_connection_failure',
    pattern: /\bdatabase\s+connection\s+failed\b/i,
    displayTitle: 'Database connection failure',
    category: 'Database',
    shortDescription: 'Failed to authenticate or establish an active connection to the backend database.',
  },
  // 5. Database Connection Pool Exhaustion (HikariCP / c3p0 / DBCP)
  {
    id: 'connection_pool_exhausted',
    pattern: /\b(hikaripool|connection\s+pool)\b.*\b(not\s+available|exhausted|timeout)\b/i,
    displayTitle: 'Database connection pool exhausted',
    category: 'Database Connection Pool',
    shortDescription: 'All available database connections in the pool were occupied, causing incoming queries to time out.',
  },
  // 6. TCP Connection Reset / Socket Termination
  {
    id: 'network_socket_reset',
    pattern: /\b(connection\s+(broken|reset|refused)|broken\s+pipe|socket\s+closed|connection\s+closed\s+by\s+peer)\b/i,
    displayTitle: 'Network connection reset',
    category: 'Network & Transport',
    shortDescription: 'Active TCP socket was abruptly closed or reset by the remote host, gateway, or load balancer.',
  },
  // 7. Asynchronous Worker / Thread Interruption
  {
    id: 'worker_thread_interrupted',
    pattern: /\b(interrupting\s+sendworker|interrupted\s+while\s+waiting|worker\s+thread\s+interrupted|leaving\s+thread)\b/i,
    displayTitle: 'Background task worker interrupted',
    category: 'Worker Thread Pool',
    shortDescription: 'An asynchronous worker thread was forcibly halted due to an upstream socket closure or queue backpressure.',
  },
  // 8. Memory Limit Exhaustion
  {
    id: 'memory_limit_exceeded',
    pattern: /\b(outofmemoryerror|java\s+heap\s+space|gc\s+overhead\s+limit|out\s+of\s+memory)\b/i,
    displayTitle: 'Memory limit exceeded',
    category: 'System Resources',
    shortDescription: 'Process heap memory reached capacity, triggering garbage collection pause or allocation failures.',
  },
  // 9. Storage / Disk Capacity & I/O
  {
    id: 'storage_io_failure',
    pattern: /\b(disk\s+full|no\s+space\s+left\s+on\s+device|ioexception.*write|file\s+system\s+error)\b/i,
    displayTitle: 'Storage capacity or I/O failure',
    category: 'Storage & File System',
    shortDescription: 'Failed to complete file system read or write operations due to disk constraints or permission errors.',
  },
  // 10. Authentication / Authorization Failures
  {
    id: 'authentication_failure',
    pattern: /\b(authentication\s+failed|access\s+denied|unauthorized|invalid\s+credentials|token\s+expired)\b/i,
    displayTitle: 'Authentication failure',
    category: 'Security & Access',
    shortDescription: 'Access request rejected due to invalid credentials, expired session token, or permission restrictions.',
  },
  // 11. Upstream HTTP / RPC Gateway Failure
  {
    id: 'upstream_service_gateway_error',
    pattern: /\b(bad\s+gateway|service\s+unavailable|gateway\s+timeout|502\s+bad\s+gateway|503\s+service\s+unavailable|504\s+gateway\s+timeout)\b/i,
    displayTitle: 'Upstream service gateway failure',
    category: 'Microservice Integration',
    shortDescription: 'Upstream dependency failed to respond within expected latency SLA or returned a gateway error.',
  },
  // 12. Deadlock / Lock Acquisition Timeout
  {
    id: 'lock_acquisition_timeout',
    pattern: /\b(deadlock\s+detected|lock\s+wait\s+timeout|failed\s+to\s+acquire\s+lock)\b/i,
    displayTitle: 'Resource lock contention timeout',
    category: 'Concurrency & Locking',
    shortDescription: 'Concurrent operations exceeded lock wait limits, resulting in transaction rollback or cancellation.',
  },
];

/**
 * Removes unnecessary wildcard placeholders (<*>, [<*>], /<*>, <*ms>) and collapses whitespace.
 */
export function stripWildcards(template: string): string {
  if (!template) return '';
  return template
    .replace(/\[?\s*\/?<[*:][^>]*>\s*\]?/g, ' ')
    .replace(/\b0x[0-9a-fA-F]+\b/g, '')
    .replace(/[:\-_/]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Derives a human-readable display title, category, and short description
 * from a raw Drain3 template or raw event title.
 *
 * Never alters the original Drain3 template string.
 */
export function normalizeLogTemplate(
  template?: string | null,
  rawTitle?: string | null
): NormalizedTemplateResult {
  const textToEval = (template || rawTitle || '').trim();

  // Strip common incident/anomaly wrapper prefixes when analyzing
  const cleanedEval = textToEval
    .replace(/^(incident:\s*(critical\s*spike\s*in\s*|new\s*pattern\s*emergence\s*)?|cluster\s*spike:\s*|new\s*pattern:\s*)/i, '')
    .replace(/^['"]|['"]$/g, '')
    .trim();

  // 1. Match against configured normalization rules
  for (const rule of NORMALIZER_RULES) {
    if (rule.pattern.test(cleanedEval) || rule.pattern.test(textToEval)) {
      return {
        displayTitle: rule.displayTitle,
        category: rule.category,
        shortDescription: rule.shortDescription,
        isMatched: true,
        ruleId: rule.id,
      };
    }
  }

  // 2. Generic fallback for unknown templates: strip wildcards and format cleanly
  const cleaned = stripWildcards(cleanedEval);
  if (cleaned && cleaned.length > 3) {
    const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    const displayTitle = capitalized.length > 65 ? `${capitalized.slice(0, 62).trim()}...` : capitalized;
    return {
      displayTitle,
      category: 'Application Service',
      shortDescription: `An unusual frequency of '${displayTitle}' log events was detected.`,
      isMatched: false,
      ruleId: 'generic_fallback',
    };
  }

  return {
    displayTitle: 'Unexpected application disruption',
    category: 'Application Service',
    shortDescription: 'An unexpected surge in operational error logs was detected during the observation window.',
    isMatched: false,
    ruleId: 'generic_fallback',
  };
}

/**
 * Returns just the normalized display title string.
 */
export function getDisplayTitle(template?: string | null, rawTitle?: string | null): string {
  return normalizeLogTemplate(template, rawTitle).displayTitle;
}

/**
 * Returns just the short description explaining the detected behaviour.
 */
export function getShortDescription(template?: string | null, rawTitle?: string | null): string {
  return normalizeLogTemplate(template, rawTitle).shortDescription;
}
