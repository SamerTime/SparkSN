"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

export function SparkAdminDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [domainsText, setDomainsText] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/spark/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) {
          setEnabled(Boolean(data.settings.autoAcceptEnabled));
          setDomainsText((data.settings.autoAcceptDomains || []).join("\n"));
        }
      })
      .catch(() => toast.error("Couldn't load admin settings."))
      .finally(() => setLoading(false));
  }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      const autoAcceptDomains = domainsText
        .split(/[\n,]/)
        .map((d) => d.trim())
        .filter(Boolean);
      const res = await fetch("/api/spark/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoAcceptEnabled: enabled, autoAcceptDomains }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Couldn't save settings.");
      }
      setEnabled(Boolean(data.settings.autoAcceptEnabled));
      setDomainsText((data.settings.autoAcceptDomains || []).join("\n"));
      toast.success("Admin settings saved.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't save settings."
      );
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close admin"
        className="absolute inset-0 bg-slate-950/40"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-lg border border-[var(--sn-line)] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--sn-line)] p-4">
          <div className="flex items-center gap-2 font-extrabold text-[var(--sn-ink)]">
            <ShieldCheck className="h-5 w-5 text-[var(--sn-blue)]" />
            Admin
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 hover:bg-black/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-[var(--sn-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              <section>
                <h3 className="text-sm font-extrabold text-[var(--sn-ink)]">
                  Auto-accept
                </h3>
                <p className="mt-1 text-xs leading-5 text-[var(--sn-muted)]">
                  Applicants whose email domain is listed below skip recruiter
                  review + the email invite and go straight into the AI
                  screening.
                </p>
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="font-bold text-[var(--sn-ink)]">
                    Enable auto-accept
                  </span>
                </label>
                <label className="mt-4 block text-xs font-extrabold uppercase text-[var(--sn-muted)]">
                  Allowed domains (one per line)
                </label>
                <textarea
                  value={domainsText}
                  onChange={(e) => setDomainsText(e.target.value)}
                  rows={4}
                  placeholder="tcwglobal.com"
                  className="sn-input mt-1 w-full px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[11px] text-[var(--sn-muted)]">
                  Subdomains are included (tcwglobal.com also matches
                  hr.tcwglobal.com).
                </p>
              </section>

              <div className="mt-5 flex justify-end gap-2 border-t border-[var(--sn-line)] pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 rounded-md border border-[var(--sn-line)] px-4 text-sm font-medium hover:bg-black/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="inline-flex h-9 items-center gap-1 rounded-md bg-[var(--sn-ink)] px-4 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
