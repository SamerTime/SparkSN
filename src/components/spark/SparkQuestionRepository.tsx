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
};

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

  const columnDefs = useMemo<ColDef<QuestionRepositoryRow>[]>(
    () => [
      { field: "jobOrder", headerName: "Job order", minWidth: 200 },
      { field: "type", headerName: "Type", width: 140 },
      { field: "intent", headerName: "Intent", minWidth: 240 },
      {
        field: "text",
        headerName: "Question",
        minWidth: 360,
        flex: 2,
        wrapText: true,
        autoHeight: true,
      },
      { field: "generator", headerName: "Generator", width: 140 },
      { field: "bankStatus", headerName: "Bank status", width: 130 },
      {
        field: "answersCount",
        headerName: "Answers",
        width: 120,
        filter: "agNumberColumnFilter",
      },
      { field: "targetSeconds", headerName: "Target (s)", width: 120 },
      { field: "model", headerName: "Model", width: 170 },
      { field: "source", headerName: "JD source", minWidth: 200 },
      { field: "createdAt", headerName: "Created", width: 190 },
      { field: "mcpRunId", headerName: "Run id", width: 160, hide: true },
    ],
    []
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({ sortable: true, filter: true, resizable: true }),
    []
  );

  const onGridReady = useCallback((event: GridReadyEvent<QuestionRepositoryRow>) => {
    apiRef.current = event.api;
  }, []);

  const exportCsv = useCallback(() => {
    apiRef.current?.exportDataAsCsv({ fileName: "spark-question-repository.csv" });
  }, []);

  // AG Grid Community has no row grouping; emulate "group by" by sorting on the
  // chosen column so rows cluster together.
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
          className="h-9 w-72 rounded-md border border-[var(--sn-border,#d4d4d8)] px-3 text-sm"
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
        <button
          type="button"
          onClick={exportCsv}
          className="h-9 rounded-md border border-[var(--sn-border,#d4d4d8)] px-3 text-sm font-medium hover:bg-black/5"
        >
          Export CSV
        </button>
        <span className="ml-auto text-sm text-[var(--sn-muted,#52525b)]">
          {rows.length} questions across all job orders
        </span>
      </div>

      <div style={{ height: 640, width: "100%" }}>
        <AgGridReact<QuestionRepositoryRow>
          theme={themeQuartz}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          quickFilterText={quickFilter}
          onGridReady={onGridReady}
          pagination
          paginationPageSize={50}
          paginationPageSizeSelector={[25, 50, 100, 200]}
        />
      </div>
    </div>
  );
}
