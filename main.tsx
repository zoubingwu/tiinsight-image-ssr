import { Hono } from "hono/mod.ts";
import { logger } from "hono/middleware.ts";
import { chart, ChartColors, transparentize } from "./chart.ts";

const app = new Hono();
app.use("*", logger());

app.get("/", (c) => c.text("Hello Deno!"));

app.get("/example.svg", () => {
  const svg = chart({
    type: "line",
    data: {
      labels: ["Jan", "Fen", "Mar"],
      datasets: [{
        label: "Sessions",
        data: [200, 300, 400].map((i) => i * Math.random()),
        borderColor: ChartColors.Red,
        backgroundColor: transparentize(ChartColors.Red, 0.5),
        borderWidth: 1,
      }, {
        label: "Users",
        data: [200, 300, 400].map((i) => i * Math.random()),
        borderColor: ChartColors.Blue,
        backgroundColor: transparentize(ChartColors.Blue, 0.5),
        borderWidth: 1,
      }],
    },
    options: {
      devicePixelRatio: 1,
      scales: { y: { beginAtZero: true } },
    },
  });

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml",
    },
  });
});

Deno.serve(app.fetch);
