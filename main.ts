import { Hono } from "hono/mod.ts";
import { logger } from "hono/middleware.ts";
import { z } from "zod";
import { load } from "std/dotenv/mod.ts";
import {
  chart,
  ChartColors,
  svgResponse,
  transparentize,
  withSvgText,
} from "./chart.ts";
import {
  isPendingJob,
  isQuestionBreakdown,
  isResolvedJob,
  isResolvedQuestionBreakdown,
  PendingJob,
  renderChartfromResolvedData,
  ResolvedJob,
  TiInsightSDK,
} from "./insight.ts";
import { match, P } from "./deps.ts";

await load({ export: true });

const db = await Deno.openKv();
const t = new TiInsightSDK();
const app = new Hono();

app.use("*", logger());

app.get("/", (c) => c.text("Hello Deno!"));

app.get("/example.svg", () => {
  const svg = chart({
    type: "line",
    data: {
      labels: ["Jan", "Fen", "Mar"],
      datasets: [
        {
          label: "Sessions",
          data: [200, 300, 400].map((i) => i * Math.random()),
          borderColor: ChartColors.Red,
          backgroundColor: transparentize(ChartColors.Red, 0.5),
          borderWidth: 1,
        },
        {
          label: "Users",
          data: [200, 300, 400].map((i) => i * Math.random()),
          borderColor: ChartColors.Blue,
          backgroundColor: transparentize(ChartColors.Blue, 0.5),
          borderWidth: 1,
        },
      ],
    },
    options: {
      devicePixelRatio: 1,
      scales: { y: { beginAtZero: true } },
    },
  });

  return svgResponse(svg);
});

const schema = z.object({
  q: z.string().max(500),
  w: z.number().int().positive().lte(2000).optional(),
  h: z.number().int().positive().lte(2000).optional(),
});

/**
 * @example /test_chart?q=top%2010%20albums%20sold
 */
app.get("/test_chart", async (c) => {
  const question = c.req.query("q");
  const width = c.req.query("w");
  const height = c.req.query("h");
  const data = {
    q: question,
    w: width ? Number(width) : undefined,
    h: height ? Number(height) : undefined,
  };

  const result = schema.safeParse(data);
  if (!result.success) {
    return svgResponse(withSvgText("Wrong parmeter"));
  }

  const entry = await db.get(["question", question!]);

  return await match(entry)
    .with({ value: null, versionstamp: null }, async () => {
      const result = await t.breakdownUserQuestion(question!);
      await db.set(["question", question!], result.result);
      return svgResponse(withSvgText("Generating"));
    })
    .with({ value: P.when((val) => isPendingJob(val)) }, async (item) => {
      const res = await t.queryJobDetail((item.value as PendingJob).job_id);
      if (res.result.status === "done" || res.result.status === "failed") {
        await db.set(["question", question!], res.result);
      }
      return svgResponse(withSvgText("Generating"));
    })
    .with({ value: P.when((val) => isResolvedJob(val)) }, async (item) => {
      const resolved = item.value as ResolvedJob;
      if (resolved.status === "failed") {
        return svgResponse(withSvgText(resolved.reason || "Failed"));
      }

      if (isQuestionBreakdown(resolved.result)) {
        const res = await t.followupSubtask("0", resolved.result.question_id);
        await db.set(["question", question!], res.result);
        return svgResponse(withSvgText("Generating"));
      }

      if (isResolvedQuestionBreakdown(resolved.result)) {
        const svg = renderChartfromResolvedData(resolved.result, {
          w: data.w,
          h: data.h,
        });
        return svgResponse(svg);
      }
    })
    .otherwise(() => {
      return svgResponse(withSvgText("Generating"));
    });
});

Deno.serve(app.fetch);
