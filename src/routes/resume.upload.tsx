import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Upload, X, CheckCircle2, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingState } from "@/components/common/LoadingState";
import { resumeService } from "@/services/api";
import { useResumeStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  // Present = this upload is a NEW VERSION of an existing resume group.
  resumeId: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/resume/upload")({
  head: () => ({ meta: [{ title: "Upload resume — CareerPilot" }] }),
  validateSearch: searchSchema,
  component: UploadPage,
});

type Phase = "idle" | "uploading" | "analyzing";

function UploadPage() {
  const navigate = useNavigate();
  const { resumeId } = Route.useSearch();
  const record = useResumeStore((s) =>
    resumeId ? s.resumes.find((r) => r.id === resumeId) : undefined,
  );
  const isVersion = Boolean(resumeId);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((files: File[]) => {
    setError(null);
    if (files[0]) setFile(files[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    onDropRejected: (rejections) => {
      const msg = rejections[0]?.errors[0]?.message ?? "File rejected";
      setError(msg);
      toast.error(msg);
    },
  });

  async function startAnalysis() {
    if (!file) return;
    setError(null);
    try {
      let id: string;
      if (isVersion && resumeId) {
        // New snapshot of an existing group — upload keeps the stable resume id.
        setPhase("uploading");
        setProgress(0);
        await resumeService.addVersion(resumeId, file, setProgress);
        id = resumeId;
      } else {
        setPhase("uploading");
        setProgress(0);
        const out = await resumeService.upload(file, setProgress);
        id = out.id;
      }
      setPhase("analyzing");
      await resumeService.analyze(id);
      toast.success(isVersion ? "New version analyzed" : "Analysis complete");
      navigate({ to: "/resume/analysis/$id", params: { id } });
    } catch (e) {
      setPhase("idle");
      const message = e instanceof Error ? e.message : "Analysis failed. Please try again.";
      setError(message);
      toast.error(message);
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow={isVersion ? `New version — v${(record?.versionCount ?? 0) + 1}` : "ResumeAI"}
        title={
          isVersion
            ? `Upload a new version${record ? ` of ${record.title}` : ""}`
            : "Upload your resume"
        }
        description={
          isVersion
            ? "Your previous snapshot stays untouched — this upload becomes the current version and gets a fresh analysis."
            : "Drop a PDF up to 10MB. We'll parse structure, extract skills, and benchmark against your target roles."
        }
        actions={
          isVersion && record ? (
            <Link
              to="/resume/analysis/$id"
              params={{ id: record.id }}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-sm transition hover:bg-card"
            >
              <GitBranch className="h-4 w-4" /> {record.versions.length} version
              {record.versions.length > 1 ? "s" : ""}
            </Link>
          ) : undefined
        }
      />

      {phase === "analyzing" ? (
        <div className="glass mx-auto max-w-2xl rounded-3xl p-10">
          <LoadingState label="Analyzing resume with GPT-grade models…" />
          <div className="mx-auto max-w-md space-y-3">
            {[
              "Extracting sections and structure",
              "Detecting skills and experience",
              "Benchmarking against target roles",
              "Generating improvement suggestions",
            ].map((s, i) => (
              <motion.div
                key={s}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.35 }}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <CheckCircle2 className="h-4 w-4 text-primary" /> {s}
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl">
          <div
            {...getRootProps()}
            className={cn(
              "glass relative flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-14 text-center transition",
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40",
            )}
          >
            <input {...getInputProps()} />
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
              <Upload className="h-6 w-6 text-white" />
            </div>
            <div className="text-base font-semibold">
              {isDragActive ? "Drop your PDF here" : "Drag & drop your resume"}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              or <span className="text-primary">browse files</span> · PDF up to 10MB
            </p>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <AnimatePresence>
            {file && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="glass mt-4 flex items-center gap-4 rounded-2xl p-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{file.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(0)} KB
                  </div>
                  {phase === "uploading" && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className="h-full bg-[image:var(--gradient-primary)]"
                        animate={{ width: `${progress}%` }}
                        transition={{ ease: "easeOut" }}
                      />
                    </div>
                  )}
                </div>
                {phase === "idle" && (
                  <button
                    onClick={() => setFile(null)}
                    className="rounded-lg p-2 text-muted-foreground hover:text-foreground"
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={() => setFile(null)}
              disabled={!file || phase !== "idle"}
              className="rounded-lg border border-border bg-card/50 px-4 py-2 text-sm transition hover:bg-card disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={startAnalysis}
              disabled={!file || phase !== "idle"}
              className="rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:opacity-90 disabled:opacity-40"
            >
              {phase === "uploading"
                ? `Uploading ${progress}%`
                : isVersion
                  ? "Upload & analyze version"
                  : "Analyze resume"}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
