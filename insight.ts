import { DigestClient } from "digest_fetch";
import type { Primitive } from "zod";
import { isMatching, match, P } from "./deps.ts";
import { chart } from "./chart.ts";

export type ApiResult<T> = {
  code: number;
  msg?: string;
  result: T;
};

export interface TableColumn {
  name: string;
  type: string;
  default: string | null;
  comment: string | null;
  nullable: boolean;
  description: string;
  /**
   * json string of ColumnStats
   */
  statistics: string;
  sample_data: string;
  autoincrement?: boolean;
}

export interface ColumnStats {
  count: number;
  unique: number;
  freq: number;
  top?: number;
  mean?: number;
  std?: number;
  min?: number;
  "25%"?: number;
  "50%"?: number;
  "75%"?: number;
  max?: number;
}

export interface TableColumnsDetail {
  table_name: string;
  description: string;
  columns: Record<string, TableColumn>;
  type: string;
  key_attributes: string[];
  entity: string;
  status: string;
  primary_key: string;
}

export type DatabaseSchemaMap = Record<string, TableColumnsDetail>;
export type TableRelationshipMap = Record<string, Relationship[]>;

export interface Relationship {
  referencing_table: string;
  referenced_table: string;
  relationship: "1:N" | "N:1";
  foreign_key_column: string;
  primary_key_column: string;
}

export type TablesSampleDataMap = Record<
  string,
  { table_name: string; sample_data_str: string }
>;

export type EntityMap = Record<string, Entity>;

export type Entity = {
  name: string;
  attributes: string[];
  involved_tables: string[];
  summary: string;
};

export interface DatabaseUnderstanding {
  public_key: string;
  status: "inited" | "done" | string;
  db_schema: DatabaseSchemaMap;
  tables_sample_data: TablesSampleDataMap;
  table_relationship: TableRelationshipMap;
  entity: EntityMap;
  statistics: {
    columns_count: number;
    tables_count: number;
  };
  summary: string;
  short_summary: string;
  summary_keywords: string[];
}

export interface ChartOptions {
  chartName: "BarChart" | "LineChart" | "PieChart";
  title: string;
  option: {
    x?: string;
    y?: string | string[];
    value?: string;
    label?: string;
  };
}

export interface TaskTreeNode {
  breakdown_type: string;
  chartOptions: ChartOptions;
  clarified_task: string;
  columns: { col: string }[];
  description: string;
  level: number;
  parent_task: string;
  parent_task_id: string;
  reason: string;
  recommendations: Array<{ method_name: string; explanation: string }>;
  rows: Primitive[][];
  sql: string;
  sql_error: string;
  task: string;
  task_id: string;
  possibleExplanations?: string[];
  assumptions?: {
    concept: string;
    explanation: string;
    related_columns: string[];
  }[];
  sub_task_list?: string[];

  question_id: string;
  session_context_id: number;
}

export interface QuestionBreakdown {
  question_id: string;
  raw_question: string;
  task_tree: Record<string, TaskTreeNode>;
}

export interface ResolvedQuestionBreakdown extends TaskTreeNode {
  breakdown_type: "Resolve";
}

export interface PendingJob {
  job_id: string;
}

export function isPendingJob(val: unknown): val is PendingJob {
  return isMatching({ job_id: P.string }, val) && Object.keys(val).length === 1;
}

export function isQuestionBreakdown(val: unknown): val is QuestionBreakdown {
  return isMatching(
    {
      question_id: P.string,
      raw_question: P.string,
    },
    val,
  );
}

export function isResolvedQuestionBreakdown(
  val: unknown,
): val is ResolvedQuestionBreakdown {
  return isMatching(
    {
      breakdown_type: "Resolve",
      task_id: P.string,
      parent_task_id: P.string,
    },
    val,
  );
}

export interface ResolvedJob {
  status: "init" | "running" | "failed" | "done";
  result: QuestionBreakdown | ResolvedQuestionBreakdown;
  reason?: string;
}

export function isResolvedJob(val: unknown): val is ResolvedJob {
  return isMatching(
    {
      status: P.union("init", "running", "failed", "done"),
      result: P.any,
      reason: P.string,
    },
    val,
  );
}

export class TiInsightSDK {
  client: DigestClient;
  baseUrl = Deno.env.get("BASE_URL");
  sessionId = Deno.env.get("SESSION_ID");
  publicKey = Deno.env.get("PUBLIC_KEY");
  privateKey = Deno.env.get("PRIVATE_KEY");

  constructor() {
    if (!this.publicKey || !this.privateKey) {
      throw new Error("Keys should be specified in environment variables");
    }
    this.client = new DigestClient(this.publicKey, this.privateKey);
  }

  async breakdownUserQuestion(q: string): Promise<ApiResult<PendingJob>> {
    const res = await this.client.fetch(
      `${this.baseUrl}/session/${this.sessionId}/actions/question_breakdown`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raw_question: q,
        }),
      },
    );

    return await res.json();
  }

  async followupSubtask(
    questionId: string,
    taskId: string,
  ): Promise<ApiResult<PendingJob>> {
    const res = await this.client.fetch(
      `${this.baseUrl}/session/${this.sessionId}/actions/text2sql`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          task_id: taskId,
          question_id: questionId,
        }),
      },
    );

    return await res.json();
  }

  async queryJobDetail(id: string): Promise<ApiResult<ResolvedJob>> {
    const res = await this.client.fetch(`${this.baseUrl}/jobs/${id}`, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return await res.json();
  }
}

export function renderChartfromResolvedData(
  data: ResolvedQuestionBreakdown,
  options?: { w?: number; h?: number },
): string {
  const type = data.chartOptions.chartName;
  const base = {
    width: options?.w,
    height: options?.h,
    options: {
      devicePixelRatio: 1,
      scales: { y: { beginAtZero: true } },
      plugins: {
        title: {
          text: data.chartOptions.title,
        },
      },
    },
  };

  const sqlData = data.rows?.map((row) => {
    return row
      .map((i, index) => ({
        [data.columns?.[index]?.col]: i,
      }))
      .reduce((acc, next) => {
        return { ...acc, ...next };
      }, {} as Record<string, Primitive>);
  });

  return match(type)
    .with("BarChart", () => {
      const { x, y } = data.chartOptions.option;
      const datasets = Array.isArray(y) ? y : [y];
      return chart({
        ...base,
        type: "bar",
        data: {
          labels: sqlData.map((i) => i[x!]) as string[],
          datasets: datasets.map((y) => ({
            label: y,
            data: sqlData.map((i) => i[y!]),
          })),
        },
      });
    })
    .with("LineChart", () => {
      const { x, y } = data.chartOptions.option;
      const datasets = Array.isArray(y) ? y : [y];
      return chart({
        ...base,
        type: "line",
        data: {
          labels: sqlData.map((i) => i[x!]) as string[],
          datasets: datasets.map((y) => ({
            label: y,
            data: sqlData.map((i) => i[y!]),
          })),
        },
      });
    })
    .with("PieChart", () => {
      const { label, value } = data.chartOptions.option;
      return chart({
        ...base,
        type: "pie",
        data: {
          labels: sqlData.map((i) => i[label!]) as string[],
          datasets: sqlData.map((i) => ({
            label: i[label!] as string,
            data: i[value!],
          })),
        },
      });
    })
    .exhaustive();
}
