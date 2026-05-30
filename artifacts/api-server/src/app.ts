import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { reloadGuildSettings } from "./bot/store/settings";
import { endGiveaway, rerollGiveaway, cancelTimer } from "./bot/giveaway/manager";
import { getGiveaway, saveGiveaway } from "./bot/store/giveaways";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/ping', (req, res) => res.send('OK'));

app.post('/internal/reload/:guildId', async (req: any, res: any) => {
  try {
    await reloadGuildSettings(req.params.guildId);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "reload failed" });
  }
});

app.post('/internal/giveaway-cancel/:guildId/:id', async (req: any, res: any) => {
  try {
    const { guildId, id } = req.params;
    const g = getGiveaway(guildId, id);
    if (!g) return res.status(404).json({ error: "not found" });
    cancelTimer(g);
    const updated = { ...g, cancelled: true, ended: true };
    saveGiveaway(updated);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "cancel failed" });
  }
});

app.get('/internal/giveaway-reroll/:guildId/:id', async (req: any, res: any) => {
  try {
    const { guildId, id } = req.params;
    const winners = await rerollGiveaway(guildId, id);
    res.json({ winners });
  } catch {
    res.status(500).json({ error: "reroll failed" });
  }
});

app.use("/api", router);

export default app;
