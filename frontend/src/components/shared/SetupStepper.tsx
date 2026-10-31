import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Building2, FolderKanban, Cpu, Network, ShieldAlert, Check } from 'lucide-react';

interface SetupStepperProps {
  currentStep: 1 | 2 | 3 | 4 | 5;
  orgId?: string;
  projectId?: string;
}

export const SetupStepper: React.FC<SetupStepperProps> = ({ currentStep, orgId, projectId }) => {
  const steps = [
    {
      num: 1,
      title: 'Organization',
      desc: 'Account & workspace unit',
      icon: Building2,
      path: '/organizations',
      disabled: false,
    },
    {
      num: 2,
      title: 'Projects',
      desc: 'Environment boundaries',
      icon: FolderKanban,
      path: orgId ? `/organizations/${orgId}/projects` : '/organizations',
      disabled: currentStep < 2 && !orgId,
    },
    {
      num: 3,
      title: 'Microservices',
      desc: 'Define distributed nodes',
      icon: Cpu,
      path: projectId ? `/projects/${projectId}/services` : '#',
      disabled: currentStep < 3 && !projectId,
    },
    {
      num: 4,
      title: 'Dependency Graph',
      desc: 'Topology DAG & links',
      icon: Network,
      path: projectId ? `/projects/${projectId}/dependency-graph` : '#',
      disabled: currentStep < 4 && !projectId,
    },
    {
      num: 5,
      title: 'AI Incident Console',
      desc: 'Root cause analysis (RCA)',
      icon: ShieldAlert,
      path: '/dashboard',
      disabled: currentStep < 5 && !projectId,
    },
  ];

  return (
    <div className="w-full pb-6 pt-2">
      <nav aria-label="Setup Pipeline Progress" className="w-full">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
          {steps.map((s) => {
            const isCompleted = s.num < currentStep;
            const isCurrent = s.num === currentStep;
            const Icon = s.icon;

            const content = (
              <div
                className={`p-3 rounded-xl border text-left transition-all relative ${
                  isCurrent
                    ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-neutral-100 dark:text-neutral-900 shadow-sm'
                    : isCompleted
                    ? 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700'
                    : 'border-neutral-200/50 dark:border-neutral-800/50 bg-neutral-50/30 dark:bg-neutral-900/10 text-neutral-400 dark:text-neutral-600 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                      isCurrent
                        ? 'bg-amber-400 text-neutral-900'
                        : isCompleted
                        ? 'bg-emerald-500 text-white'
                        : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
                    }`}
                  >
                    {isCompleted ? <Check className="w-3 h-3 stroke-[3]" /> : s.num}
                  </span>
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isCurrent
                        ? 'text-amber-400 dark:text-amber-600'
                        : isCompleted
                        ? 'text-emerald-500'
                        : 'text-neutral-400'
                    }`}
                  />
                </div>
                <div className="text-xs font-semibold truncate">{s.title}</div>
                <div
                  className={`text-[10px] truncate hidden md:block ${
                    isCurrent
                      ? 'text-neutral-300 dark:text-neutral-600'
                      : 'text-neutral-400 dark:text-neutral-500'
                  }`}
                >
                  {s.desc}
                </div>
              </div>
            );

            if (s.disabled) {
              return (
                <div key={s.num} className="cursor-not-allowed">
                  {content}
                </div>
              );
            }

            return (
              <Link key={s.num} to={s.path} className="block">
                {content}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
