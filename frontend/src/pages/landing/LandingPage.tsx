import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ChevronDown,
  Layers,
  Activity,
  GitCommit,
  Sparkles,
  FileSearch,
  Network,
  CheckCircle2,
  AlertCircle,
  Database,
  Terminal,
  ExternalLink,
  Shield,
  BarChart3,
  Clock,
} from 'lucide-react';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusIndicator } from '../../components/ui/Badge';
import { AuthModal } from '../../components/shared/AuthModal';
import { MOCK_INCIDENTS, MOCK_SERVICES, MOCK_CLUSTERS } from '../../mocks';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const features = [
    {
      id: 'log-parsing',
      title: '1. Log Parsing & Clustering',
      description:
        'Convert noisy, variable raw log messages into deterministic structured templates and group similar events with Drain-inspired clustering.',
      icon: Layers,
    },
    {
      id: 'anomaly-detection',
      title: '2. Anomaly Detection',
      description:
        'Identify unusual error patterns, sudden log-rate surges, and newly emergent log types before they cause wide blast-radius downtime.',
      icon: Activity,
    },
    {
      id: 'incident-timeline',
      title: '3. Incident Timeline',
      description:
        'Visualize exactly when anomalies occurred and how issues cascaded chronologically from root infrastructure to customer-facing APIs.',
      icon: GitCommit,
    },
    {
      id: 'ai-summary',
      title: '4. AI Incident Summary',
      description:
        'Generate concise, human-readable explanations of detected incidents in plain engineering language backed by concrete log records.',
      icon: Sparkles,
    },
    {
      id: 'root-cause',
      title: '5. Root Cause Analysis',
      description:
        'Rank likely responsible services using supporting chronological evidence, confidence metrics, and anomalous template clusters.',
      icon: FileSearch,
    },
    {
      id: 'service-mapping',
      title: '6. Service Dependency Mapping',
      description:
        'Map upstream and downstream dependencies to visualize real failure cascades and blast radius across microservices.',
      icon: Network,
    },
  ];

  const workflowSteps = [
    {
      step: '01',
      title: 'Upload Public Log Dataset',
      desc: 'Select from LogHub benchmarks (HDFS, BGL, OpenStack) or upload raw application text logs.',
    },
    {
      step: '02',
      title: 'Parse Logs into Templates',
      desc: 'Extract parameter wildcards (<*>) from timestamps, UUIDs, IPs, and identifiers.',
    },
    {
      step: '03',
      title: 'Cluster Similar Messages',
      desc: 'Aggregate millions of log rows into a compact catalog of unique behavioral templates.',
    },
    {
      step: '04',
      title: 'Detect Anomalies',
      desc: 'Evaluate frequency deviations, sudden error spikes, and never-before-seen template emergence.',
    },
    {
      step: '05',
      title: 'Correlate Affected Services',
      desc: 'Trace multi-service propagation along upstream dependency paths.',
    },
    {
      step: '06',
      title: 'Generate Incident Summary',
      desc: 'Produce an actionable triage dossier with ranked hypotheses and an investigation checklist.',
    },
  ];

  const faqs = [
    {
      q: 'What is LogSense?',
      a: 'LogSense is an AI-powered incident triage platform designed for SREs and DevOps teams. It compresses millions of raw cloud application logs into structured templates, isolates anomalous spikes, and pinpoints the responsible service with verifiable evidence.',
    },
    {
      q: 'How does log parsing work?',
      a: 'Log parsing strips variable parameters (such as IP addresses, transaction UUIDs, user IDs, and timestamps) from log messages, replacing them with wildcard tokens (<*>) to discover the underlying constant template executed by the code.',
    },
    {
      q: 'What is Drain3?',
      a: 'Drain3 is a state-of-the-art online log parser that uses a fixed-depth parse tree to extract message templates in near linear time. LogSense models its clustering and template induction on Drain3 specifications.',
    },
    {
      q: 'How does anomaly detection work?',
      a: 'LogSense analyzes sliding time windows to detect sudden volume surges, error template frequency spikes compared against moving baselines, and the emergence of previously unseen log templates.',
    },
    {
      q: 'How does LogSense identify the responsible service?',
      a: 'LogSense correlates chronological event precedence with the service dependency graph. The service that first exhibits internal fatal log clusters prior to downstream timeouts is ranked as the primary root-cause candidate.',
    },
    {
      q: 'What evidence is shown in incident summaries?',
      a: 'Summaries link directly to exact timestamped raw log lines, cluster template IDs, observed metric baseline deviations, and service dependency call paths. No hypothesis is presented without inspectable log evidence.',
    },
    {
      q: 'Which datasets can be used?',
      a: 'LogSense comes pre-loaded with public SRE research benchmarks from LogHub (including HDFS, BGL Supercomputer, and OpenStack) as well as an interactive cloud microservices failure slice.',
    },
    {
      q: 'Can I connect my own backend?',
      a: 'Yes. LogSense frontend is built with a typed API client abstraction (`apiClient`). Pointing `VITE_API_BASE_URL` to a Python (FastAPI/Drain3) or Node.js server seamlessly switches data from preview fixtures to live production endpoints.',
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 flex flex-col transition-colors">
      <Navbar onOpenAuthModal={() => setAuthModalOpen(true)} />

      <main className="flex-1">
        {/* Section A: Hero — Home */}
        <section id="hero" className="relative pt-16 sm:pt-24 pb-16 sm:pb-20 overflow-hidden">
          {/* Subtle Project Era background ambient glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-amber-500/5 via-neutral-100/30 dark:via-neutral-900/10 to-transparent pointer-events-none -z-10" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              {/* Supporting headline kicker */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 mb-6">
                <span>Find the Real Error. Trace the Service. Resolve the Incident.</span>
              </div>

              {/* Main Heading */}
              <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 leading-[1.15]">
                LogSense: AI-Powered Incident Triage for{' '}
                <em className="text-[#b45309] dark:text-amber-500 not-italic font-normal">
                  Cloud Applications
                </em>
              </h1>

              {/* Description */}
              <p className="mt-6 text-base sm:text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto leading-relaxed">
                Turn millions of application log lines into structured patterns, anomaly insights,
                and evidence-backed incident summaries.
              </p>

              {/* CTAs */}
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/dashboard')}
                  icon={<ArrowRight className="w-4 h-4" />}
                >
                  Explore Dashboard
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    const el = document.getElementById('how-it-works');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  See How It Works
                </Button>
              </div>
            </div>

            {/* Hero Live Product Preview Canvas */}
            <div className="mt-12 sm:mt-16 max-w-5xl mx-auto">
              <Card padding="none" className="shadow-xl border-neutral-300 dark:border-neutral-750">
                {/* Preview Window Header */}
                <div className="px-4 py-3 bg-neutral-100 dark:bg-neutral-850 border-b border-neutral-200 dark:border-neutral-750 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                    <span className="w-2.5 h-2.5 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                    <span className="w-2.5 h-2.5 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                    <span className="ml-2 text-xs font-mono text-neutral-500">
                      incident-triage-view · active incident INC-2026-894
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <StatusIndicator status="CRITICAL" />
                  </div>
                </div>

                {/* Preview Window Body */}
                <div className="p-4 sm:p-6 bg-white dark:bg-[#121212] space-y-5">
                  {/* Top banner: AI summary */}
                  <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-850/80 border border-neutral-200 dark:border-neutral-750">
                    <div className="flex items-center gap-2 text-xs font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500" />
                      <span>AI Incident Summary (Evidence-Correlated)</span>
                    </div>
                    <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                      Database connection pool in <code className="font-mono text-amber-700 dark:text-amber-400">database-service</code> exhausted at 100/100 active connections. This triggered cascading 5000ms socket timeouts in <code className="font-mono">payment-service</code> and HTTP 504 errors in <code className="font-mono">order-service</code>.
                    </p>
                  </div>

                  {/* Cascade flow strip */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/20">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-mono font-semibold text-red-900 dark:text-red-300">database-service</span>
                        <StatusIndicator status="CRITICAL" />
                      </div>
                      <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
                        100/100 connections saturated. 1,482 FATAL pool drops.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-mono font-semibold text-amber-900 dark:text-amber-300">payment-service</span>
                        <StatusIndicator status="HIGH" />
                      </div>
                      <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
                        938 timeouts at 5002ms. Circuit breaker tripped.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-100">order-service</span>
                        <StatusIndicator status="DEGRADED" />
                      </div>
                      <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
                        844 client 504 Gateway Timeouts forwarded.
                      </p>
                    </div>
                  </div>

                  {/* Template clustering visual snapshot */}
                  <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 sm:p-4 bg-neutral-50/50 dark:bg-neutral-900/50">
                    <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
                      <span className="font-medium">Extracted Log Template (Drain3 Pattern)</span>
                      <span className="font-mono text-[11px]">1,482 occurrences</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-neutral-900 text-neutral-100 font-mono text-xs overflow-x-auto whitespace-pre">
                      <span className="text-red-400">FATAL</span> connection pool exhausted: active <span className="text-amber-400 bg-amber-950/60 px-1 rounded">&lt;*&gt;</span>/<span className="text-amber-400 bg-amber-950/60 px-1 rounded">&lt;*&gt;</span>, queued requests <span className="text-amber-400 bg-amber-950/60 px-1 rounded">&lt;*&gt;</span> exceeded timeout <span className="text-amber-400 bg-amber-950/60 px-1 rounded">&lt;*&gt;</span>
                    </div>
                  </div>
                </div>

                {/* Preview CTA strip */}
                <div className="px-6 py-3.5 bg-neutral-50 dark:bg-neutral-850 border-t border-neutral-200 dark:border-neutral-750 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <span className="text-neutral-500">
                    Observing active incident timeline with 14 correlated anomalies.
                  </span>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate('/dashboard')}
                    icon={<ArrowRight className="w-3.5 h-3.5" />}
                  >
                    Open Live Investigation View
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Section B: Features */}
        <section id="features" className="py-20 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-[#0d0d0d] transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto text-center mb-12 sm:mb-16">
              <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                Architected for On-Call Precision
              </h2>
              <p className="mt-3 text-sm sm:text-base text-neutral-600 dark:text-neutral-400">
                Six specialized triage capabilities designed to eliminate log noise and resolve incidents faster.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feat) => {
                const Icon = feat.icon;
                return (
                  <Card key={feat.id} variant="default" padding="lg" className="flex flex-col justify-between">
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-900 dark:text-neutral-100 mb-5">
                        <Icon className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
                      </div>
                      <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                        {feat.title}
                      </h3>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        {feat.description}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Section C: How It Works */}
        <section id="how-it-works" className="py-20 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0a0a0a] transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto text-center mb-14">
              <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                How LogSense Works
              </h2>
              <p className="mt-3 text-sm sm:text-base text-neutral-600 dark:text-neutral-400">
                From raw, unstructured log lines to verified root cause in six deterministic stages.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {workflowSteps.map((ws) => (
                <div
                  key={ws.step}
                  className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 relative flex flex-col justify-between"
                >
                  <div>
                    <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-500 mb-3 block">
                      STAGE {ws.step}
                    </span>
                    <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                      {ws.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      {ws.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section D: Dashboard Preview Showcase */}
        <section className="py-20 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-[#0d0d0d] transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-6 mb-12">
              <div className="max-w-2xl">
                <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                  Full Observability & Incident Workspace
                </h2>
                <p className="mt-3 text-sm sm:text-base text-neutral-600 dark:text-neutral-400">
                  A high-density investigation console built for engineers. Filter raw streams, inspect anomalous clusters, and audit verified hypotheses.
                </p>
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/dashboard')}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Launch LogSense Console
              </Button>
            </div>

            {/* Realistic Dashboard Preview Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Stat Cards Row */}
              <div className="lg:col-span-12 grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121212]">
                  <span className="text-xs text-neutral-500">Total Log Events</span>
                  <p className="font-mono text-xl font-bold mt-1 text-neutral-900 dark:text-neutral-100">124,850</p>
                </div>
                <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121212]">
                  <span className="text-xs text-neutral-500">Error Events</span>
                  <p className="font-mono text-xl font-bold mt-1 text-red-600 dark:text-red-400">3,412</p>
                </div>
                <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121212]">
                  <span className="text-xs text-neutral-500">Detected Anomalies</span>
                  <p className="font-mono text-xl font-bold mt-1 text-amber-600 dark:text-amber-400">14</p>
                </div>
                <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121212]">
                  <span className="text-xs text-neutral-500">Active Incidents</span>
                  <p className="font-mono text-xl font-bold mt-1 text-neutral-900 dark:text-neutral-100">2</p>
                </div>
                <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121212] col-span-2 sm:col-span-1">
                  <span className="text-xs text-neutral-500">Monitored Services</span>
                  <p className="font-mono text-xl font-bold mt-1 text-neutral-900 dark:text-neutral-100">7</p>
                </div>
              </div>

              {/* Left Column: Recent Incidents Preview */}
              <div className="lg:col-span-7">
                <Card padding="md" className="h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
                      <div>
                        <h3 className="font-semibold text-sm">Recent Incidents</h3>
                        <p className="text-xs text-neutral-500">Correlated multi-service events</p>
                      </div>
                      <span className="text-xs font-mono text-amber-700 dark:text-amber-500">
                        2 tracked
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      {MOCK_INCIDENTS.map((inc) => (
                        <div
                          key={inc.id}
                          onClick={() => navigate(`/dashboard/incidents/${inc.id}`)}
                          className="p-3.5 rounded-xl border border-neutral-200/90 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 hover:border-neutral-400 dark:hover:border-neutral-700 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-mono text-xs font-semibold">{inc.id}</span>
                            <StatusIndicator status={inc.severity} />
                          </div>
                          <p className="text-xs sm:text-sm font-medium text-neutral-800 dark:text-neutral-200">
                            {inc.title}
                          </p>
                          <div className="mt-2 flex items-center gap-3 text-xs text-neutral-500">
                            <span>Root: {inc.suspectedRootCauseService}</span>
                            <span aria-hidden="true">·</span>
                            <span>{inc.affectedServices.length} affected services</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/dashboard/incidents')}
                      icon={<ArrowRight className="w-3.5 h-3.5" />}
                    >
                      View All Incidents
                    </Button>
                  </div>
                </Card>
              </div>

              {/* Right Column: Service Health & Anomaly Preview */}
              <div className="lg:col-span-5 space-y-5">
                <Card padding="md">
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
                    <div>
                      <h3 className="font-semibold text-sm">Service Health</h3>
                      <p className="text-xs text-neutral-500">Topology cascade status</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/service-map')}>
                      Map
                    </Button>
                  </div>

                  <div className="mt-3 space-y-2">
                    {MOCK_SERVICES.slice(0, 4).map((svc) => (
                      <div
                        key={svc.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 dark:bg-neutral-900/60 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{svc.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-neutral-500">{svc.errorRate}% err</span>
                          <StatusIndicator status={svc.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card padding="md">
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
                    <div>
                      <h3 className="font-semibold text-sm">Log Template Clusters</h3>
                      <p className="text-xs text-neutral-500">Top anomalous patterns</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/clusters')}>
                      Clusters
                    </Button>
                  </div>

                  <div className="mt-3 space-y-2">
                    {MOCK_CLUSTERS.slice(0, 2).map((clu) => (
                      <div key={clu.id} className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/60 text-xs">
                        <div className="flex items-center justify-between text-neutral-500 mb-1">
                          <span className="font-mono">{clu.id}</span>
                          <span className="font-mono">{clu.occurrenceCount} hits</span>
                        </div>
                        <p className="font-mono text-[11px] text-neutral-800 dark:text-neutral-200 truncate">
                          {clu.template}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Section E: FAQ Accordion */}
        <section id="faq" className="py-20 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0a0a0a] transition-colors">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                Frequently Asked Questions
              </h2>
              <p className="mt-3 text-sm sm:text-base text-neutral-600 dark:text-neutral-400">
                Concise, technically accurate answers about LogSense's architecture and algorithms.
              </p>
            </div>

            <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border-y border-neutral-200 dark:border-neutral-800">
              {faqs.map((faq, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <div key={faq.q} className="py-4">
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                      className="w-full flex items-center justify-between text-left gap-4 py-2 text-base font-semibold text-neutral-900 dark:text-neutral-100 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform duration-200 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="pt-2 pb-3 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => navigate('/dashboard')}
      />
    </div>
  );
};
