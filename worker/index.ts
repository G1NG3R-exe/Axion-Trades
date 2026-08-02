/** Cloudflare Worker entry point with scheduled handler for auto-run paper trading. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { advancePaperAccount, createInitialPaper, getPaperStream, PaperAccount, ModelWeights } from "../app/paper-trading";
import { getD1 } from "../db";

interface Env {
  ASSETS: {
    fetch(input: Request | URL | string, init?: RequestInit): Promise<Response>;
  };
  DB: unknown;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config
const imageConfig = { dangerouslyAllowSVG: false };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runAutoPaperTrading(env));
  },
};

async function runAutoPaperTrading(env: Env): Promise<void> {
  try {
    const now = new Date();
    const etTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const hour = etTime.getHours();
    const minute = etTime.getMinutes();
    const dayOfWeek = etTime.getDay(); // 0 = Sunday, 6 = Saturday

    // Only run on weekdays during market hours (9:30-16:00 ET)
    if (dayOfWeek === 0 || dayOfWeek === 6) return;
    if (hour < 9 || (hour === 9 && minute < 30)) return;
    if (hour >= 16) return;

    const d1 = getD1();

    // Find users with autoRun enabled
    const users = await d1
      .prepare(
        `SELECT a.id, a.username, s.payload
         FROM accounts a
         INNER JOIN account_states s ON s.account_id = a.id
         WHERE JSON_EXTRACT(s.payload, '$.preferences.autoRun') = 1`
      )
      .all<{ id: string; username: string; payload: string }>();

    if (!users.results?.length) return;

    const paperStream = getPaperStream();
    if (!paperStream.length) {
      console.log("No paper stream data available");
      return;
    }

    for (const user of users.results) {
      try {
        const state = JSON.parse(user.payload);
        const paper = state.paper;
        const preferences = state.preferences;
        const model = state.model;

        if (!paper || !preferences?.autoRun) continue;

        // Find current bar index
        const lastBarTimestamp = paper.lastBarTimestamp;
        let barIndex = 0;
        if (lastBarTimestamp) {
          const idx = paperStream.findIndex((bar) => bar.timestamp === lastBarTimestamp);
          if (idx >= 0) barIndex = idx + 1;
        }

        if (barIndex >= paperStream.length) {
          // Session complete, reset for next day
          continue;
        }

        const bar = paperStream[barIndex];
        const weights = model as ModelWeights;
        const advancedPaper = advancePaperAccount(paper, bar, weights);

        // Update state
        state.paper = {
          ...advancedPaper,
          lastBarTimestamp: bar.timestamp,
        };

        // Save back to D1
        await d1
          .prepare(
            `UPDATE account_states SET payload = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE account_id = ?`
          )
          .bind(JSON.stringify(state), user.id)
          .run();
      } catch (error) {
        console.error(`Auto-run failed for user ${user.username}:`, error);
      }
    }
  } catch (error) {
    console.error("Auto-run scheduled task failed:", error);
  }
}

export default worker;