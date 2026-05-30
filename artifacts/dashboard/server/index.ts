import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool, initDb } from "./db.js";
import authRouter from "./routes/auth.js";
import guildsRouter from "./routes/guilds.js";
import statsRouter from "./routes/stats.js";
import applyRouter from "./routes/apply.js";
import giveawaysRouter from "./routes/giveaways.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PgStore = connectPgSimple(session);

app.set("trust proxy", 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new PgStore({ pool, tableName: "session", createTableIfMissing: false }),
    secret: process.env["SESSION_SECRET"] ?? "changeme-set-SESSION_SECRET-in-env",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
    },
  })
);

app.use("/api/auth", authRouter);
app.use("/api/guilds", guildsRouter);
app.use("/api/apply", applyRouter);
app.use("/api/guilds", giveawaysRouter);
app.use("/api", statsRouter);

// process.cwd() is always the project root (artifacts/dashboard),
// regardless of whether this file is running as source (server/) or
// compiled bundle (dist/server/). Using __dirname would double the
// "dist" segment in production and cause ENOENT errors.
const clientDist = path.resolve(process.cwd(), "dist/client");
app.use(express.static(clientDist));
app.get("/{*splat}", (_req: any, res: any) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

const port = Number(process.env["DASHBOARD_PORT"] ?? process.env["PORT"] ?? 4000);

initDb()
  .then(() => {
    app.listen(port, "0.0.0.0", () => {
      console.log(`Dashboard running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize DB:", err);
    process.exit(1);
  });
