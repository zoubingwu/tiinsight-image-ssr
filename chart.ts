/**
 * Following code is from https://github.com/denoland/fresh_charts
 */
import {
  ChartJs,
  colors,
  Rect2D,
  SvgCanvas,
  SvgCanvas2DGradient,
} from "./deps.ts";

class ChartSvgCanvas extends SvgCanvas {
  public override clearRect(x: number, y: number, w: number, h: number): void {
    this.save();
    this.fillStyle = "transparent";
    this.fillRect(x, y, w, h);
    this.restore();
  }

  public resetTransform() {
    this.setTransform(1, 0, 0, 1, 0, 0);
  }
}

export type ChartOptions<TType extends ChartJs.ChartType = ChartJs.ChartType> =
  Omit<
    ChartJs.ChartOptions<TType>,
    | "responsive"
    | "responsiveAnimationDuration"
    | "events"
    | "legendCallback"
    | "onHover"
    | "onClick"
    | "onResize"
    | "hover"
    | "animation"
  >;

export interface ChartConfiguration<
  TType extends ChartJs.ChartType = ChartJs.ChartType,
  TData = ChartJs.DefaultDataPoint<TType>,
  TLabel = unknown,
> {
  /** The width, in pixels, of the chart.
   *
   * Defaults to `600`.
   */
  width?: number;
  /** The height, in pixels, of the chart.
   *
   * Defaults to `400`.
   */
  height?: number;
  /** The type of chart.
   *
   * Defaults to `"line"`.
   */
  type?: ChartJs.ChartType;
  /** Data to be rendered in the chart. */
  data: ChartJs.ChartData<TType, TData, TLabel>;
  /** Options which can be configured on the chart. */
  options?: ChartOptions;
  /** Chart plugins to be registered for the chart. */
  plugins?: ChartJs.Plugin[];
  /** CSS class for the <svg> element of the chart. */
  svgClass?: string;
  /** CSS style for the <svg> element of the chart */
  svgStyle?: string;
}

interface SvgCanvasExtras {
  canvas?: {
    width: number;
    height: number;
    style: Record<string, string>;
  };
  resetTransform?(): void;
}

export function chart<
  TType extends ChartJs.ChartType = ChartJs.ChartType,
  TData = ChartJs.DefaultDataPoint<TType>,
  TLabel = unknown,
>(
  {
    width = 600,
    height = 400,
    type = "bar",
    data,
    options = {},
    plugins,
    svgClass,
    svgStyle,
  }: ChartConfiguration<TType, TData, TLabel> = { data: { datasets: [] } },
): string {
  Object.assign(options, {
    animation: false,
    events: [],
    responsive: false,
  });

  const ctx: ChartSvgCanvas & SvgCanvasExtras = new ChartSvgCanvas();
  ctx.canvas = {
    width,
    height,
    style: { width: `${width}px`, height: `${height}px` },
  };
  ctx.fontHeightRatio = 2;
  // deno-lint-ignore no-explicit-any
  const el: HTMLCanvasElement = { getContext: () => ctx } as any;
  const savedGradient = globalThis.CanvasGradient;
  globalThis.CanvasGradient = SvgCanvas2DGradient as typeof CanvasGradient;

  try {
    new ChartJs.Chart(el, { type, data, options, plugins });
  } finally {
    if (savedGradient) {
      globalThis.CanvasGradient = savedGradient;
    }
  }

  let svg = ctx.render(new Rect2D(0, 0, width, height), "px");

  if (svgStyle) {
    svg = svg.replace(
      "<svg ",
      `<svg style="${svgStyle.replaceAll('"', "&quot;")}" `,
    );
  }
  if (svgClass) {
    svg = svg.replace(
      "<svg ",
      `<svg class="${svgClass.replaceAll('"', "&quot;")}" `,
    );
  }

  return svg;
}

/** A set of CSS RGB colors which can be used with charts. */
export enum ChartColors {
  Red = "rgb(255, 99, 132)",
  Orange = "rgb(255, 159, 64)",
  Yellow = "rgb(255, 205, 86)",
  Green = "rgb(75, 192, 192)",
  Blue = "rgb(54, 162, 235)",
  Purple = "rgb(153, 102, 255)",
  Grey = "rgb(201, 203, 207)",
}

/**
 * A utility function which takes a CSS string color value and applies the
 * percentage of opacity to it and returns a new CSS string color value.
 *
 * If the opacity is not provided, it defaults to 50%.
 */
export function transparentize(value: string, opacity?: number) {
  const alpha = opacity === undefined ? 0.5 : 1 - opacity;
  return colors(value).alpha(alpha).rgbString();
}

export function withSvgText(
  text: string,
  options?: { w?: number; h?: number },
): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${
      options?.w ?? 600
    }" height="${options?.h ?? 400}" viewBox="0 0 300 200" fill="none">`,
    '<rect width="100%" height="100%" fill="gainsboro" />',
    `<text x="150" y="50" fill="gray" text-anchor="middle" alignment-baseline="middle">${text}</text>`,
    "</svg>",
  ].join("");
}

export function svgResponse(svg: string) {
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml",
    },
  });
}
