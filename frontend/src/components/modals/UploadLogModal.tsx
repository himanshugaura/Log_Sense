import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  X,
  FileUp,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Cpu,
  ArrowRight,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { logService } from '../../services/log-service';
import { ProcessingJob } from '../../types';

interface ServiceOption {
  id: string;
  name: string;
}

interface UploadLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  targetService?: ServiceOption | null;
  availableServices?: ServiceOption[];
  onSuccess?: () => void;
}

export const UploadLogModal: React.FC<UploadLogModalProps> = ({
  isOpen,
  onClose,
  projectId,
  targetService,
  availableServices = [],
  onSuccess,
}) => {
  const navigate = useNavigate();
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [activeJob, setActiveJob] = useState<ProcessingJob | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (targetService) {
      setSelectedServiceId(targetService.id);
    } else if (availableServices.length > 0) {
      setSelectedServiceId((prev) => {
        if (prev && availableServices.some((s) => s.id === prev)) {
          return prev;
        }
        return availableServices[0].id;
      });
    } else {
      setSelectedServiceId('');
    }
  }, [targetService, availableServices, isOpen]);

  // Always reset to a fresh idle upload state whenever modal opens or service changes
  useEffect(() => {
    if (isOpen) {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
      setUploadFile(null);
      setUploadState('idle');
      setUploadError(null);
      setActiveJob(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen, targetService?.id]);

  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const handleFileSelect = (file: File) => {
    const validExtensions = ['.log', '.txt', '.csv', '.json'];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!hasValidExt) {
      setUploadError('Invalid file type. Please upload a .log, .txt, .csv, or .json file.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setUploadError('File size exceeds the 50MB limit.');
      return;
    }

    setUploadFile(file);
    setUploadError(null);
    setUploadState('idle');
  };

  const handleStartUpload = async () => {
    if (!uploadFile || !projectId) return;
    setUploadState('uploading');
    setUploadError(null);

    const serviceIdToUse = targetService?.id || (selectedServiceId !== 'all' ? selectedServiceId : undefined);

    try {
      const res = await logService.uploadLogFile(projectId, uploadFile, serviceIdToUse);
      setUploadState('processing');
      const jobId = res.processingJob?.id;

      if (jobId) {
        pollingTimerRef.current = setInterval(async () => {
          try {
            const jobs = await logService.getProcessingJobs(projectId);
            const current = jobs.find((j) => j.id === jobId);
            if (current) {
              setActiveJob(current);
              if (current.status === 'COMPLETED') {
                if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
                setUploadState('success');
                onSuccess?.();
              } else if (current.status === 'FAILED') {
                if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
                setUploadState('error');
                setUploadError(current.errorMessage || 'Log parsing and anomaly detection failed');
              }
            }
          } catch (err) {
            console.warn('Job polling error:', err);
          }
        }, 1500);
      } else {
        setUploadState('success');
        onSuccess?.();
      }
    } catch (err: any) {
      setUploadState('error');
      setUploadError(err?.message || 'File upload failed');
    }
  };

  const handleResetAndClose = () => {
    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    setUploadFile(null);
    setUploadState('idle');
    setUploadError(null);
    setActiveJob(null);
    onClose();
  };

  const resolvedServiceName =
    targetService?.name ||
    availableServices.find((s) => s.id === selectedServiceId)?.name ||
    'Selected Microservice';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={handleResetAndClose} />
      <div className="relative w-full max-w-xl rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121212] p-6 shadow-2xl text-neutral-900 dark:text-neutral-100 animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={handleResetAndClose}
          className="absolute right-4 top-4 p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-lg bg-neutral-900 dark:bg-white flex items-center justify-center text-white dark:text-neutral-900">
            <UploadCloud className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold tracking-tight">
              Upload Service Log File
            </h3>
            <p className="text-xs text-neutral-500">
              Ingest telemetry logs directly mapped to microservice DAG topology.
            </p>
          </div>
        </div>

        {uploadError && (
          <div className="my-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Target Service Badge or Dropdown */}
        <div className="my-4 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-600 dark:text-amber-500" />
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Target Microservice:
              </span>
            </div>
            {targetService ? (
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-neutral-900 text-white dark:bg-neutral-800 dark:text-neutral-100">
                {targetService.name}
              </span>
            ) : availableServices.length > 0 ? (
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="text-xs font-mono font-bold rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-1 text-neutral-900 dark:text-neutral-100 focus:outline-none"
              >
                {availableServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-amber-600">No services found</span>
            )}
          </div>
          <p className="text-[11px] text-neutral-400 mt-1.5">
            Log entries will be tagged to <span className="font-semibold text-neutral-600 dark:text-neutral-300 font-mono">{resolvedServiceName}</span> for Drain3 template clustering and automated RCA blast-radius evaluation.
          </p>
        </div>

        {/* Drop Zone */}
        {uploadState === 'idle' && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files?.[0]) {
                handleFileSelect(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-850'
                : 'border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".log,.txt,.csv,.json"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
              }}
            />
            <FileUp className="w-8 h-8 mx-auto mb-2 text-neutral-400" />
            {uploadFile ? (
              <div>
                <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 block font-mono">
                  {uploadFile.name}
                </span>
                <span className="text-[11px] text-neutral-400">
                  {(uploadFile.size / 1024).toFixed(1)} KB · Ready to ingest for {resolvedServiceName}
                </span>
              </div>
            ) : (
              <div>
                <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                  Click to select or drag <span className="font-mono font-semibold">{resolvedServiceName}</span> log file here
                </p>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Supports .log, .txt, .csv, and JSON formats up to 50MB
                </p>
              </div>
            )}
          </div>
        )}

        {/* Uploading or Processing Progress */}
        {(uploadState === 'uploading' || uploadState === 'processing') && (
          <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-amber-600 dark:text-amber-500 animate-spin shrink-0" />
              <div>
                <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  {uploadState === 'uploading'
                    ? `Uploading ${resolvedServiceName} log stream...`
                    : `Clustering & mining templates for ${resolvedServiceName}...`}
                </h4>
                <p className="text-[11px] text-neutral-500">
                  {uploadState === 'uploading'
                    ? 'Transferring payload to encrypted storage'
                    : `Analyzed ${activeJob?.processedLines || 0} lines · ${activeJob?.progressPercentage || 15}%`}
                </p>
              </div>
            </div>

            <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-amber-600 dark:bg-amber-500 h-2 transition-all duration-300 rounded-full"
                style={{
                  width: `${
                    uploadState === 'uploading'
                      ? 25
                      : activeJob?.progressPercentage || 45
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Success State */}
        {uploadState === 'success' && (
          <div className="p-6 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Logs Ingested & Analyzed for {resolvedServiceName}!</span>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              Drain3 templates discovered and anomaly detection completed for this service node.
            </p>
            <div className="pt-2 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUploadFile(null);
                  setUploadState('idle');
                  setUploadError(null);
                  setActiveJob(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                icon={<FileUp className="w-3.5 h-3.5" />}
              >
                Upload Another Log
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  handleResetAndClose();
                  navigate(`/dashboard/logs?service=${encodeURIComponent(resolvedServiceName)}`);
                }}
                icon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                Inspect Logs & Anomalies
              </Button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-neutral-100 dark:border-neutral-850">
          <Button variant="ghost" size="sm" onClick={handleResetAndClose}>
            {uploadState === 'success' ? 'Done' : 'Cancel'}
          </Button>
          {uploadState === 'idle' && (
            <Button
              variant="primary"
              size="sm"
              disabled={!uploadFile}
              onClick={handleStartUpload}
              icon={<UploadCloud className="w-3.5 h-3.5" />}
            >
              Upload to {resolvedServiceName}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
