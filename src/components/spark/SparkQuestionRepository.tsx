"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
} from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

export type QuestionRepositoryRow = {
  questionId: string;
  bankId: string;
  bankStatus: string;
  postingId: string;
  jobOrder: string;
  clientName: string | null;
  text: string;
  type: string;
  intent: string;
  source: string;
  generator: string;
  model: string | null;
  promptVersion: string | null;
  targetSeconds: number | null;
  answersCount: number;
  mcpRunId: string | null;
  createdAt: string;
  up?: number;
  down?: number;
  lessons?: number;
};

type GridContext = {
  onRate: (row: QuestionRepositoryRow, signal: "up" | "down") => void;
  onTeach: (rows: QuestionRepositoryRow[]) => void;
};

function ActionsCell(params: ICellRendererParams<QuestionRepositoryRow>) {
  const row = params.data;
  const ctx = params.context as GridContext;
  if (!row) return null;
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        title="Strong question"
        onClick={() => ctx.onRate(row, "up")}
        className="rounded px-1.5 py-0.5 text-sm hover:bg-black/5"
      >
        👍
      </button>
      <button
        type="button"
        title="Weak question"
        onClick={() => ctx.onRate(row, "down")}
        className="rounded px-1.5 py-0.5 text-sm hover:bg-black/5"
      >
        👎
      </button>
      <button
        type="button"
        title="Teach Roger a lesson from this question"
        onClick={() => ctx.onTeach([row])}
        className="rounded px-1.5 py-0.5 text-sm hover:bg-black/5"
      >
        ✎
      </button>
    </div>
  );
}

const GROUP_OPTIONS: Array<{ value: keyof QuestionRepositoryRow; label: string }> = [
  { value: "jobOrder", label: "Job order" },
  { value: "type", label: "Type" },
  { value: "generator", label: "Generator" },
  { value: "bankStatus", label: "Bank status" },
];

export function SparkQuestionRepository({
  rows,
}: {
  rows: QuestionRepositoryRow[];
}) {
  const apiRef = useRef<GridApi<QuestionRepositoryRow> | null>(null);
  const [quickFilter, setQuickFilter] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [teachRows, setTeachRows] = useState<QuestionRepositoryRow[]>([]);
  const [lessonText, setLessonText] = useState("");
  const [appliesTo, setAppliesTo] = useState("");

  const flash = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const postFeedback = useCallback(async (items: unknown[]) => {
    const res = await fetch("/api/spark/question-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || `Request failed (${res.status})`);
    }
    return data as { anyForwardFailed?: boolean };
  }, []);

  const bumpRows = useCallback(
    (rowsToBump: QuestionRepositoryRow[], field: "up" | "down" | "lessons") => {
      for (const row of rowsToBump) row[field] = (row[field] ?? 0) + 1;
      apiRef.current?.refreshCells({ force: true });
    },
    []
  );

  const onRate = useCallback(
    async (row: QuestionRepositoryRow, signal: "up" | "down") => {
      bumpRows([row], signal);
      try {
        await postFeedback([
          { questionId: row.questionId, postingId: row.postingId, kind: "signal", signal },
        ]);
      } catch (error) {
        flash(`Couldn't save: ${error instanceof Error ? error.message : "error"}`);
      }
    },
    [bumpRows, postFeedback, flash]
  );

  const onTeach = useCallback((rowsToTeach: QuestionRepositoryRow[]) => {
    setTeachRows(rowsToTeach);
    setLessonText("");
    setAppliesTo("");
  }, []);

  const submitTeach = useCallback(async () => {
    const lesson = lessonText.trim();
    if (!lesson || teachRows.length === 0) return;
    setBusy(true);
    try {
      const result = await postFeedback(
        teachRows.map((row) => ({
          questionId: row.questionId,
          postingId: row.postingId,
          kind: "lesson",
          lesson,
          appliesTo: appliesTo.trim(),
        }))
      );
      bumpRows(teachRows, "lessons");
      const count = teachRows.length;
      setTeachRows([]);
      flash(
        result.anyForwardFailed
          ? "Lesson saved, but it didn't reach Roger's queue — you can retry."
          : `Lesson proposed to Roger (${count} question${count > 1 ? "s" : ""}).`
      );
    } catch (error) {
      flash(`Couldn't save lesson: ${error instanceof Error ? error.message : "error"}`);
    } finally {
      setBusy(false);
    }
  }, [lessonText, appliesTo, teachRows, postFeedback, bumpRows, flash]);

  const rateSelected = useCallback(
    async (signal: "up" | "down") => {
      const selected = apiRef.current?.getSelectedRows() ?? [];
      if (selected.length === 0) {
        flash("Select rows first.");
        return;
      }
      bumpRows(selected, signal);
      try {
        await postFeedback(
          selected.map((row) => ({
            questionId: row.questionId,
            postingId: row.postingId,
            kind: "signal",
            signal,
          }))
        );
        flash(`Rated ${selected.length} question${selected.length > 1 ? "s" : ""}.`);
      } catch (error) {
        flash(`Couldn't save: ${error instanceof Error ? error.message : "error"}`);
      }
    },
    [bumpRows, postFeedback, flash]
  );

  const teachSelected = useCallback(() => {
    const selected = apiRef.current?.getSelectedRows() ?? [];
    if (selected.length === 0) {
      flash("Select rows first.");
      return;
    }
    onTeach(selected);
  }, [onTeach, flash]);

  const columnDefs = useMemo<ColDef<QuestionRepositoryRow>[]>(
    () => [
      {
        headerName: "",
        width: 44,
        pinned: "left",
        filter: false,
        sortable: false,
      },
      { field: "jobOrder", headerName: "Job order", minWidth: 180 },
      { field: "type", headerName: "Type", width: 130 },
      { field: "intent", headerName: "Intent", minWidth: 220 },
      {
        field: "text",
        headerName: "Question",
        minWidth: 320,
        flex: 2,
        wrapText: true,
        autoHeight: true,
      },
      { field: "generator", headerName: "Generator", width: 130 },
      { field: "bankStatus", headerName: "Bank status", width: 120 },
      { field: "answersCount", headerName: "Answers", width: 110, filter: "agNumberColumnFilter" },
      { headerName: "👍", width: 80, filter: "agNumberColumnFilter", valueGetter: (p) => p.data?.up ?? 0 },
      { headerName: "👎", width: 80, filter: "agNumberColumnFilter", valueGetter: (p) => p.data?.down ?? 0 },
      { headerName: "Lessons", width: 100, filter: "agNumberColumnFilter", valueGetter: (p) => p.data?.lessons ?? 0 },
      {
        headerName: "Teach",
        width: 130,
        cellRenderer: ActionsCell,
        filter: false,
        sortable: false,
        pinned: "right",
      },
      { field: "source", headerName: "JD source", minWidth: 180 },
      { field: "createdAt", headerName: "Created", width: 180 },
    ],
    []
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      wrapText: true,
      autoHeight: true,
      cellStyle: {
        lineHeight: 1.4,
        paddingTop: "8px",
        paddingBottom: "8px",
        whiteSpace: "normal",
      },
    }),
    []
  );

  const gridContext = useMemo<GridContext>(
    () => ({ onRate, onTeach }),
    [onRate, onTeach]
  );

  const onGridReady = useCallback(
    (event: GridReadyEvent<QuestionRepositoryRow>) => {
      apiRef.current = event.api;
    },
    []
  );

  const exportCsv = useCallback(() => {
    apiRef.current?.exportDataAsCsv({ fileName: "spark-question-repository.csv" });
  }, []);

  const onGroupBy = useCallback((field: string) => {
    apiRef.current?.applyColumnState({
      state: field ? [{ colId: field, sort: "asc" }] : [],
      defaultState: { sort: null },
    });
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={quickFilter}
          onChange={(event) => setQuickFilter(event.target.value)}
          placeholder="Search questions, intent, source…"
          className="h-9 w-64 rounded-md border border-[var(--sn-border,#d4d4d8)] px-3 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-[var(--sn-muted,#52525b)]">
          Group by
          <select
            onChange={(event) => onGroupBy(event.target.value)}
            defaultValue="jobOrder"
            className="h-9 rounded-md border border-[var(--sn-border,#d4d4d8)] px-2 text-sm"
          >
            <option value="">None</option>
            {GROUP_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1 text-sm">
          <span className="text-[var(--sn-muted,#52525b)]">Selected:</span>
          <button type="button" onClick={() => rateSelected("up")} className="h-9 rounded-md border px-2 hover:bg-black/5">👍</button>
          <button type="button" onClick={() => rateSelected("down")} className="h-9 rounded-md border px-2 hover:bg-black/5">👎</button>
          <button type="button" onClick={teachSelected} className="h-9 rounded-md border px-3 hover:bg-black/5">✎ Teach</button>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="h-9 rounded-md border border-[var(--sn-border,#d4d4d8)] px-3 text-sm font-medium hover:bg-black/5"
        >
          Export CSV
        </button>
        <span className="ml-auto text-sm text-[var(--sn-muted,#52525b)]">
          {rows.length} questions
        </span>
      </div>

      <div style={{ height: 640, width: "100%" }}>
        <AgGridReact<QuestionRepositoryRow>
          theme={themeQuartz}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          context={gridContext}
          quickFilterText={quickFilter}
          onGridReady={onGridReady}
          rowSelection={{ mode: "multiRow", checkboxes: true, headerCheckbox: true, enableClickSelection: false }}
          pagination
          paginationPageSize={50}
          paginationPageSizeSelector={[25, 50, 100, 200]}
        />
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-md bg-[var(--sn-ink,#18181b)] px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {teachRows.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-[var(--sn-ink)]">
              Teach Roger a lesson
            </h2>
            <p className="mt-1 text-sm text-[var(--sn-muted)]">
              {teachRows.length === 1
                ? "From this question. "
                : `From ${teachRows.length} selected questions. `}
              A generalized takeaway for future banks — it goes to Roger&apos;s
              training queue for approval.
            </p>
            <label className="mt-4 block text-sm font-medium">Lesson</label>
            <textarea
              value={lessonText}
              onChange={(event) => setLessonText(event.target.value)}
              rows={3}
              placeholder="e.g. For payments roles, always ask about idempotency — strong candidates cite it unprompted."
              className="mt-1 w-full rounded-md border border-[var(--sn-border,#d4d4d8)] p-2 text-sm"
            />
            <label className="mt-3 block text-sm font-medium">Applies to</label>
            <input
              value={appliesTo}
              onChange={(event) => setAppliesTo(event.target.value)}
              placeholder="e.g. Python / backend roles"
              className="mt-1 w-full rounded-md border border-[var(--sn-border,#d4d4d8)] p-2 text-sm"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTeachRows([])}
                className="h-9 rounded-md border px-3 text-sm hover:bg-black/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitTeach}
                disabled={busy || !lessonText.trim()}
                className="h-9 rounded-md bg-[var(--sn-ink,#18181b)] px-4 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? "Sending…" : "Propose lesson →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
