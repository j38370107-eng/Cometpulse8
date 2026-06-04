import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Hash, RefreshCw, Trophy, AlertTriangle, RotateCcw, BarChart2 } from "lucide-react";

type Tab = "settings" | "behavior" | "milestones" | "stats";

const MODES = [
  { value: "normal",  label: "Normal",       desc: "1 2 3 4…" },
  { value: "math",    label: "Math",         desc: "2+1 for 3" },
  { value: "roman",   label: "Roman",        desc: "I II III…" },
  { value: "binary",  label: "Binary",       desc: "1 10 11 100…" },
  { value: "hex",     label: "Hexadecimal",  desc: "1 2 … A B C…" },
  { value: "letters", label: "Letters",      desc: "A B C … Z AA…" },
];

const PUNISHMENTS = [
  { value: "nothing", label: "Nothing" },
  { value: "warn",    label: "DM Warning" },
  { value: "timeout", label: "60s Timeout + DM" },
];

interface Config {
  channelId: string | null;
  mode: string;
  resetOnFail: boolean;
  deleteWrong: boolean;
  milestoneInterval: number;
  milestoneRoleId: string | null;
  milestoneEmoji: string;
  failPunishment: string;
  reactEmoji: string;
  updateTopic: boolean;
  noSameUserTwice: boolean;
  checkpointInterval: number;
}

interface State {
  currentCount: number;
  highScore: number;
  lastUserId: string | null;
  totalFails: number;
  lastFailUserId: string | null;
}

interface UserStat {
  userId: string;
  contributions: number;
  fails: number;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Counting() {
  const { guildId } = useParams<{ guildId: string }>();
  const [draft, setDraft] = useState<Config | null>(null);
  const [saved, setSaved] = useState<Config | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [stats, setStats] = useState<UserStat[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [tab, setTab] = useState<Tab>("settings");
  const [setCountVal, setSetCountVal] = useState("");
  const [adminMsg, setAdminMsg] = useState("");
  const [statsTab, setStatsTab] = useState<"contributions" | "fails">("contributions");

  const load = async () => {
    if (!guildId) return;
    setLoading(true);
    try {
      const [cfg, st, sts, ch, ro] = await Promise.all([
        api.guild.countingConfig(guildId),
        api.guild.countingState(guildId),
        api.guild.countingStats(guildId),
        api.guild.channels(guildId),
        api.guild.roles(guildId),
      ]);
      setDraft(cfg);
      setSaved(cfg);
      setState(st);
      setStats(sts);
      setChannels(ch.filter((c: any) => c.type === 0));
      setRoles(ro.filter((r: any) => r.name !== "@everyone"));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [guildId]);

  const set = (patch: Partial<Config>) => setDraft((d) => d ? { ...d, ...patch } : d);

  const save = async () => {
    if (!guildId || !draft) return;
    setSaving(true);
    try {
      await api.guild.updateCountingConfig(guildId, draft);
      setSaved(draft);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleSetCount = async () => {
    if (!guildId) return;
    const n = parseInt(setCountVal);
    if (isNaN(n) || n < 0) { setAdminMsg("Please enter a valid non-negative number."); return; }
    try {
      await api.guild.countingSetCount(guildId, n);
      setAdminMsg(`✅ Count set to ${n}.`);
      setSetCountVal("");
      await load();
    } catch (e: any) { setAdminMsg(`❌ ${e.message}`); }
  };

  const handleReset = async (resetStats: boolean) => {
    if (!guildId) return;
    if (!confirm(resetStats ? "Reset count AND all stats? This cannot be undone." : "Reset the count to 0?")) return;
    try {
      await api.guild.countingReset(guildId, resetStats);
      setAdminMsg(`✅ Count${resetStats ? " and stats" : ""} reset.`);
      await load();
    } catch (e: any) { setAdminMsg(`❌ ${e.message}`); }
  };

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  if (loading || !draft || !state) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--accent)" }}>
      <Hash size={24} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "settings",   label: "Setup",      icon: <Hash size={13} /> },
    { id: "behavior",   label: "Behavior",   icon: <AlertTriangle size={13} /> },
    { id: "milestones", label: "Milestones", icon: <Trophy size={13} /> },
    { id: "stats",      label: "Stats",      icon: <BarChart2 size={13} /> },
  ];

  const topStats = [...stats].sort((a, b) =>
    statsTab === "fails" ? b.fails - a.fails : b.contributions - a.contributions
  ).slice(0, 10);

  return (
    <div className="dash-page" style={{ maxWidth: 860, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <Hash size={20} color="var(--accent)" />
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Counting</h1>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
            Configure the counting game — modes, fail behavior, milestones, and stats.
          </p>
        </div>
        <button onClick={load} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600, background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer" }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Live stat pills */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Current Count", value: state.currentCount, color: "#7c3cfa" },
          { label: "High Score 🏆", value: state.highScore, color: "#f4c430" },
          { label: "Total Fails", value: state.totalFails, color: "#ef4444" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{value.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: "1px solid var(--border)" }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
            background: "none", border: "none",
            borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
            color: tab === t.id ? "var(--accent-bright)" : "var(--text-muted)",
            marginBottom: -1, transition: "color 0.15s",
          }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── SETUP TAB ─────────────────────────────────────────────────────── */}
      {tab === "settings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <FieldLabel>Counting channel</FieldLabel>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 8px" }}>
              Messages in this channel are treated as counting attempts.
            </p>
            <select value={draft.channelId ?? ""} onChange={(e) => set({ channelId: e.target.value || null })} style={selectSty}>
              <option value="">— Disabled —</option>
              {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
          </Card>

          <Card>
            <FieldLabel>Counting mode</FieldLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              {MODES.map((m) => (
                <button key={m.value} onClick={() => set({ mode: m.value })} style={{
                  padding: "10px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  textAlign: "left", transition: "all 0.15s",
                  background: draft.mode === m.value ? "rgba(124,60,250,0.12)" : "var(--bg-secondary)",
                  border: `1px solid ${draft.mode === m.value ? "var(--accent)" : "var(--border)"}`,
                  color: draft.mode === m.value ? "var(--accent-bright)" : "var(--text-secondary)",
                }}>
                  <div>{m.label}</div>
                  <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.7, marginTop: 2, fontFamily: "monospace" }}>{m.desc}</div>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <Row>
              <div>
                <Label>Block same user twice in a row</Label>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Prevents one person from counting back-to-back.</div>
              </div>
              <Toggle checked={draft.noSameUserTwice} onChange={(v) => set({ noSameUserTwice: v })} />
            </Row>
          </Card>

          <Card>
            <Row>
              <div>
                <Label>Update channel topic</Label>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Shows current count and high score in the channel topic.</div>
              </div>
              <Toggle checked={draft.updateTopic} onChange={(v) => set({ updateTopic: v })} />
            </Row>
          </Card>
        </div>
      )}

      {/* ── BEHAVIOR TAB ──────────────────────────────────────────────────── */}
      {tab === "behavior" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <Row>
              <div>
                <Label>Reset count on fail</Label>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Resets to 0 (or a checkpoint) when the wrong number is entered.</div>
              </div>
              <Toggle checked={draft.resetOnFail} onChange={(v) => set({ resetOnFail: v })} />
            </Row>
          </Card>

          <Card>
            <Row>
              <div>
                <Label>Delete wrong messages</Label>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Automatically deletes incorrect count messages.</div>
              </div>
              <Toggle checked={draft.deleteWrong} onChange={(v) => set({ deleteWrong: v })} />
            </Row>
          </Card>

          <Card>
            <FieldLabel>Fail punishment</FieldLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {PUNISHMENTS.map((p) => (
                <button key={p.value} onClick={() => set({ failPunishment: p.value })} style={{
                  padding: "10px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  textAlign: "left", transition: "all 0.15s",
                  background: draft.failPunishment === p.value ? "rgba(124,60,250,0.12)" : "var(--bg-secondary)",
                  border: `1px solid ${draft.failPunishment === p.value ? "var(--accent)" : "var(--border)"}`,
                  color: draft.failPunishment === p.value ? "var(--accent-bright)" : "var(--text-secondary)",
                }}>
                  {p.label}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <FieldLabel>Correct count reaction emoji</FieldLabel>
            <input
              value={draft.reactEmoji}
              onChange={(e) => set({ reactEmoji: e.target.value })}
              style={{ ...inputSty, maxWidth: 120 }}
              placeholder="✅"
            />
          </Card>

          <Card>
            <FieldLabel>Checkpoint interval</FieldLabel>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 8px" }}>
              On failure, reset to the last checkpoint instead of 0. Set to 0 to disable.
            </p>
            <input
              type="number"
              min={0}
              value={draft.checkpointInterval}
              onChange={(e) => set({ checkpointInterval: parseInt(e.target.value) || 0 })}
              style={{ ...inputSty, maxWidth: 120 }}
              placeholder="0"
            />
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
              {draft.checkpointInterval > 0
                ? `Checkpoints saved every ${draft.checkpointInterval} counts`
                : "Disabled — failures reset to 0"}
            </div>
          </Card>

          {/* Admin actions */}
          <Card>
            <FieldLabel>Admin Controls</FieldLabel>
            {adminMsg && (
              <div style={{ marginBottom: 10, fontSize: 12, padding: "8px 12px", borderRadius: 6, background: "rgba(124,60,250,0.08)", border: "1px solid rgba(124,60,250,0.2)", color: "var(--text-primary)" }}>
                {adminMsg}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Manually set count</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="number"
                    min={0}
                    value={setCountVal}
                    onChange={(e) => setSetCountVal(e.target.value)}
                    placeholder="e.g. 100"
                    style={{ ...inputSty, maxWidth: 140 }}
                  />
                  <button onClick={handleSetCount} style={{ padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, background: "var(--accent)", border: "none", color: "#fff", cursor: "pointer" }}>
                    Set Count
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => handleReset(false)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer" }}>
                  <RotateCcw size={12} /> Reset Count
                </button>
                <button onClick={() => handleReset(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", cursor: "pointer" }}>
                  <RotateCcw size={12} /> Reset Count + Stats
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── MILESTONES TAB ────────────────────────────────────────────────── */}
      {tab === "milestones" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <FieldLabel>Milestone interval</FieldLabel>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 8px" }}>
              Celebrate with a special message every N counts. Set to 0 to disable.
            </p>
            <input
              type="number"
              min={0}
              value={draft.milestoneInterval}
              onChange={(e) => set({ milestoneInterval: parseInt(e.target.value) || 0 })}
              style={{ ...inputSty, maxWidth: 120 }}
              placeholder="100"
            />
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
              {draft.milestoneInterval > 0
                ? `Celebrated at ${draft.milestoneInterval}, ${draft.milestoneInterval * 2}, ${draft.milestoneInterval * 3}…`
                : "Disabled"}
            </div>
          </Card>

          <Card>
            <FieldLabel>Milestone emoji</FieldLabel>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 8px" }}>
              Reaction emoji used on milestone messages.
            </p>
            <input
              value={draft.milestoneEmoji}
              onChange={(e) => set({ milestoneEmoji: e.target.value })}
              style={{ ...inputSty, maxWidth: 120 }}
              placeholder="🎉"
            />
          </Card>

          <Card>
            <FieldLabel>Ping role at milestones</FieldLabel>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 8px" }}>
              Optional role to ping when a milestone is reached.
            </p>
            <select
              value={draft.milestoneRoleId ?? ""}
              onChange={(e) => set({ milestoneRoleId: e.target.value || null })}
              style={selectSty}
            >
              <option value="">— No ping —</option>
              {roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
            </select>
          </Card>

          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>Preview</div>
            <div style={{
              padding: "14px 16px", borderRadius: 8,
              background: "rgba(244,196,48,0.06)", border: "1px solid rgba(244,196,48,0.2)",
            }}>
              <div style={{ fontWeight: 700, color: "#f4c430", marginBottom: 4 }}>
                {draft.milestoneEmoji} Milestone Reached!
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                The count has reached <strong style={{ color: "var(--text-primary)" }}>{draft.milestoneInterval > 0 ? draft.milestoneInterval : "N"}</strong>! Amazing work everyone!
              </div>
              {draft.milestoneRoleId && (
                <div style={{ marginTop: 6, fontSize: 11, color: "var(--accent-bright)" }}>
                  @{roles.find((r) => r.id === draft.milestoneRoleId)?.name ?? "role"} will be pinged
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ── STATS TAB ─────────────────────────────────────────────────────── */}
      {tab === "stats" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 4 }}>
              {[
                { label: "Current Count", value: state.currentCount },
                { label: "High Score", value: state.highScore },
                { label: "Total Fails", value: state.totalFails },
                { label: "Counting Mode", value: draft.mode },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: "10px 14px", borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{String(value)}</div>
                </div>
              ))}
            </div>
            {state.lastUserId && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                Last counter: <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{state.lastUserId}</span>
              </div>
            )}
            {state.lastFailUserId && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                Last to ruin it: <span style={{ color: "#ef4444", fontWeight: 600 }}>{state.lastFailUserId}</span>
              </div>
            )}
          </Card>

          <Card>
            {/* Sub-tabs for leaderboard */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {(["contributions", "fails"] as const).map((t) => (
                <button key={t} onClick={() => setStatsTab(t)} style={{
                  padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
                  background: statsTab === t ? "rgba(124,60,250,0.15)" : "var(--bg-secondary)",
                  border: `1px solid ${statsTab === t ? "var(--accent)" : "var(--border)"}`,
                  color: statsTab === t ? "var(--accent-bright)" : "var(--text-muted)",
                }}>
                  {t === "contributions" ? "🏆 Top Counters" : "💀 Top Failers"}
                </button>
              ))}
            </div>

            {topStats.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px 0", color: "var(--text-muted)", fontSize: 12 }}>
                No counting activity yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {topStats.map((s, i) => {
                  const val = statsTab === "fails" ? s.fails : s.contributions;
                  return (
                    <div key={s.userId} style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8,
                      background: i < 3 ? "rgba(124,60,250,0.05)" : "var(--bg-secondary)",
                      border: `1px solid ${i < 3 ? "rgba(124,60,250,0.15)" : "var(--border)"}`,
                    }}>
                      <span style={{ fontSize: 16, minWidth: 28 }}>{MEDALS[i] ?? `#${i + 1}`}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.userId}
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: statsTab === "fails" ? "#ef4444" : "#7c3cfa", flexShrink: 0 }}>
                        {val.toLocaleString()}
                        <span style={{ fontSize: 10, fontWeight: 400, color: "var(--text-muted)", marginLeft: 4 }}>
                          {statsTab === "fails" ? "fails" : "counts"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Save bar */}
      {dirty && (
        <div style={{
          position: "sticky", bottom: 16, marginTop: 16,
          display: "flex", justifyContent: "flex-end", gap: 10,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 10, padding: "10px 16px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        }}>
          <button onClick={() => setDraft(saved)} style={{ padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, background: "transparent", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer" }}>
            Discard
          </button>
          <button onClick={save} disabled={saving} style={{
            padding: "7px 18px", borderRadius: 7, fontSize: 12, fontWeight: 700,
            background: saveOk ? "#10b981" : "var(--accent)", border: "none", color: "#fff",
            cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, transition: "background 0.3s",
          }}>
            {saving ? "Saving…" : saveOk ? "✓ Saved" : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 18px" }}>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{children}</span>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{children}</div>;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 99, border: "none", cursor: "pointer",
        background: checked ? "var(--accent)" : "var(--border)",
        position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: checked ? 21 : 3,
        width: 16, height: 16, borderRadius: "50%", background: "#fff",
        transition: "left 0.2s",
      }} />
    </button>
  );
}

const selectSty: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: 7, fontSize: 12,
  background: "var(--bg-secondary)", border: "1px solid var(--border)",
  color: "var(--text-primary)", outline: "none", cursor: "pointer",
};

const inputSty: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: 7, fontSize: 12,
  background: "var(--bg-secondary)", border: "1px solid var(--border)",
  color: "var(--text-primary)", outline: "none",
};
