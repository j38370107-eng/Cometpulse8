import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { UserPlus, MessageSquare, DoorOpen, Shield, Mail, Link, Trophy, RefreshCw } from "lucide-react";

const VARIABLES = [
  { v: "{user}", desc: "Mentions the user" },
  { v: "{username}", desc: "Plain username" },
  { v: "{server}", desc: "Server name" },
  { v: "{count}", desc: "Member number" },
  { v: "{inviter}", desc: "Who invited them" },
];

const GOODBYE_VARS = [
  { v: "{user}", desc: "Username (left)" },
  { v: "{username}", desc: "Plain username" },
  { v: "{server}", desc: "Server name" },
  { v: "{duration}", desc: "Time in server" },
  { v: "{roles}", desc: "Their top roles" },
  { v: "{inviter}", desc: "Who invited them" },
];

type Tab = "welcome" | "goodbye" | "autorole" | "dm" | "invites";

interface Config {
  welcomeEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeEmbed: boolean;
  welcomeMessage: string;
  welcomeEmbedColor: string;
  welcomeEmbedTitle: string;
  welcomeEmbedFooter: string;
  goodbyeEnabled: boolean;
  goodbyeChannelId: string | null;
  goodbyeEmbed: boolean;
  goodbyeMessage: string;
  goodbyeEmbedColor: string;
  goodbyeEmbedTitle: string;
  goodbyeEmbedFooter: string;
  autoRoleEnabled: boolean;
  autoRoles: string[];
  botAutoRoles: string[];
  dmEnabled: boolean;
  dmMessage: string;
  showInviter: boolean;
}

export default function Welcome() {
  const { guildId } = useParams<{ guildId: string }>();
  const [draft, setDraft] = useState<Config | null>(null);
  const [saved, setSaved] = useState<Config | null>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [tab, setTab] = useState<Tab>("welcome");

  const load = async () => {
    if (!guildId) return;
    setLoading(true);
    try {
      const [cfg, ch, ro, lb] = await Promise.all([
        api.guild.welcomeConfig(guildId),
        api.guild.channels(guildId),
        api.guild.roles(guildId),
        api.guild.inviteLeaderboard(guildId),
      ]);
      setDraft(cfg);
      setSaved(cfg);
      setChannels(ch.filter((c: any) => c.type === 0));
      setRoles(ro.filter((r: any) => r.name !== "@everyone"));
      setLeaderboard(lb);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [guildId]);

  const set = (patch: Partial<Config>) => setDraft((d) => d ? { ...d, ...patch } : d);

  const save = async () => {
    if (!guildId || !draft) return;
    setSaving(true);
    try {
      await api.guild.updateWelcomeConfig(guildId, draft);
      setSaved(draft);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  if (loading || !draft) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--accent)" }}>
      <UserPlus size={24} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "welcome", label: "Welcome", icon: <UserPlus size={13} /> },
    { id: "goodbye", label: "Goodbye", icon: <DoorOpen size={13} /> },
    { id: "autorole", label: "Auto-Role", icon: <Shield size={13} /> },
    { id: "dm", label: "DM", icon: <Mail size={13} /> },
    { id: "invites", label: "Invites", icon: <Link size={13} /> },
  ];

  return (
    <div className="dash-page" style={{ maxWidth: 860, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <UserPlus size={20} color="var(--accent)" />
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Welcome System</h1>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
            Welcome & goodbye messages, auto-roles, DMs, and invite tracking.
          </p>
        </div>
        <button onClick={load} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600, background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer" }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
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

      {/* ── WELCOME TAB ────────────────────────────────────────────────── */}
      {tab === "welcome" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <Row>
              <Label>Enable welcome messages</Label>
              <Toggle checked={draft.welcomeEnabled} onChange={(v) => set({ welcomeEnabled: v })} />
            </Row>
          </Card>

          <Card>
            <FieldLabel>Welcome channel</FieldLabel>
            <select value={draft.welcomeChannelId ?? ""} onChange={(e) => set({ welcomeChannelId: e.target.value || null })} style={selectSty}>
              <option value="">— None —</option>
              {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
          </Card>

          <Card>
            <Row>
              <Label>Send as embed</Label>
              <Toggle checked={draft.welcomeEmbed} onChange={(v) => set({ welcomeEmbed: v })} />
            </Row>
          </Card>

          <Card>
            <FieldLabel>Message</FieldLabel>
            <textarea value={draft.welcomeMessage} onChange={(e) => set({ welcomeMessage: e.target.value })} rows={3} style={textareaSty} />
            <VarHints vars={VARIABLES} />
          </Card>

          {draft.welcomeEmbed && (
            <Card>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <FieldLabel>Embed title</FieldLabel>
                  <input value={draft.welcomeEmbedTitle} onChange={(e) => set({ welcomeEmbedTitle: e.target.value })} style={inputSty} placeholder="e.g. 👋 Welcome!" />
                </div>
                <div>
                  <FieldLabel>Embed color</FieldLabel>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="color" value={draft.welcomeEmbedColor} onChange={(e) => set({ welcomeEmbedColor: e.target.value })}
                      style={{ width: 40, height: 34, border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", background: "none", padding: 2 }} />
                    <input value={draft.welcomeEmbedColor} onChange={(e) => set({ welcomeEmbedColor: e.target.value })} style={{ ...inputSty, width: 90 }} />
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <FieldLabel>Embed footer</FieldLabel>
                <input value={draft.welcomeEmbedFooter} onChange={(e) => set({ welcomeEmbedFooter: e.target.value })} style={inputSty} placeholder="Optional footer text…" />
              </div>
            </Card>
          )}

          <Card>
            <Row>
              <Label>Show inviter in welcome message</Label>
              <Toggle checked={draft.showInviter} onChange={(v) => set({ showInviter: v })} />
            </Row>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "8px 0 0" }}>Adds a field showing who invited the new member (requires Manage Server permission for the bot).</p>
          </Card>
        </div>
      )}

      {/* ── GOODBYE TAB ───────────────────────────────────────────────── */}
      {tab === "goodbye" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <Row>
              <Label>Enable goodbye messages</Label>
              <Toggle checked={draft.goodbyeEnabled} onChange={(v) => set({ goodbyeEnabled: v })} />
            </Row>
          </Card>

          <Card>
            <FieldLabel>Goodbye channel</FieldLabel>
            <select value={draft.goodbyeChannelId ?? ""} onChange={(e) => set({ goodbyeChannelId: e.target.value || null })} style={selectSty}>
              <option value="">— None —</option>
              {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
          </Card>

          <Card>
            <Row>
              <Label>Send as embed</Label>
              <Toggle checked={draft.goodbyeEmbed} onChange={(v) => set({ goodbyeEmbed: v })} />
            </Row>
          </Card>

          <Card>
            <FieldLabel>Message</FieldLabel>
            <textarea value={draft.goodbyeMessage} onChange={(e) => set({ goodbyeMessage: e.target.value })} rows={3} style={textareaSty} />
            <VarHints vars={GOODBYE_VARS} />
          </Card>

          {draft.goodbyeEmbed && (
            <Card>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <FieldLabel>Embed title</FieldLabel>
                  <input value={draft.goodbyeEmbedTitle} onChange={(e) => set({ goodbyeEmbedTitle: e.target.value })} style={inputSty} placeholder="e.g. Goodbye" />
                </div>
                <div>
                  <FieldLabel>Embed color</FieldLabel>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="color" value={draft.goodbyeEmbedColor} onChange={(e) => set({ goodbyeEmbedColor: e.target.value })}
                      style={{ width: 40, height: 34, border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", background: "none", padding: 2 }} />
                    <input value={draft.goodbyeEmbedColor} onChange={(e) => set({ goodbyeEmbedColor: e.target.value })} style={{ ...inputSty, width: 90 }} />
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <FieldLabel>Embed footer</FieldLabel>
                <input value={draft.goodbyeEmbedFooter} onChange={(e) => set({ goodbyeEmbedFooter: e.target.value })} style={inputSty} placeholder="Optional footer text…" />
              </div>
            </Card>
          )}

          <Card>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>Goodbye embed includes automatically</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[
                "⏱ How long they were in the server",
                "🎭 Their top roles (up to 5)",
                "📨 Who originally invited them",
              ].map((item) => (
                <div key={item} style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "var(--accent)" }}>✓</span> {item}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── AUTO-ROLE TAB ─────────────────────────────────────────────── */}
      {tab === "autorole" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <Row>
              <Label>Enable auto-role on join</Label>
              <Toggle checked={draft.autoRoleEnabled} onChange={(v) => set({ autoRoleEnabled: v })} />
            </Row>
          </Card>

          <Card>
            <FieldLabel>Roles for humans</FieldLabel>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 10px" }}>Assigned to real users (non-bots) when they join.</p>
            <RolePicker
              all={roles}
              selected={draft.autoRoles}
              onChange={(ids) => set({ autoRoles: ids })}
              color="#7c3cfa"
            />
          </Card>

          <Card>
            <FieldLabel>Roles for bots</FieldLabel>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 10px" }}>Assigned to bots when they are added to the server.</p>
            <RolePicker
              all={roles}
              selected={draft.botAutoRoles}
              onChange={(ids) => set({ botAutoRoles: ids })}
              color="#f59e0b"
            />
          </Card>
        </div>
      )}

      {/* ── DM TAB ────────────────────────────────────────────────────── */}
      {tab === "dm" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <Row>
              <Label>Send DM on join</Label>
              <Toggle checked={draft.dmEnabled} onChange={(v) => set({ dmEnabled: v })} />
            </Row>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "8px 0 0" }}>Sends a private message to new members. Will silently fail if they have DMs disabled.</p>
          </Card>

          <Card>
            <FieldLabel>DM message</FieldLabel>
            <textarea value={draft.dmMessage} onChange={(e) => set({ dmMessage: e.target.value })} rows={5} style={textareaSty} />
            <VarHints vars={VARIABLES.filter((v) => v.v !== "{count}" && v.v !== "{inviter}")} />
          </Card>
        </div>
      )}

      {/* ── INVITES TAB ───────────────────────────────────────────────── */}
      {tab === "invites" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Trophy size={14} color="var(--accent)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Invite Leaderboard</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>{leaderboard.length} inviters tracked</span>
            </div>

            {leaderboard.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)", fontSize: 12 }}>
                No invite data yet. Invite tracking starts automatically once the bot is in your server.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {leaderboard.map((r, i) => {
                  const real = Math.max(0, r.count - (r.fakeCount ?? 0));
                  const medals = ["🥇", "🥈", "🥉"];
                  return (
                    <div key={r.inviterId} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 8,
                      background: i < 3 ? "rgba(124,60,250,0.06)" : "var(--bg-secondary)",
                      border: `1px solid ${i < 3 ? "rgba(124,60,250,0.18)" : "var(--border)"}`,
                    }}>
                      <span style={{ fontSize: 16, minWidth: 28 }}>{medals[i] ?? `#${i + 1}`}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.inviterTag}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>{r.inviterId}</div>
                      </div>
                      <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
                        <StatPill label="Real" value={real} color="#10b981" />
                        <StatPill label="Total" value={r.count} color="#7c3cfa" />
                        {(r.fakeCount ?? 0) > 0 && <StatPill label="Fake" value={r.fakeCount} color="#ef4444" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>How invite tracking works</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                ["📨 Tracks which invite link each new member used", "Automatically on every join"],
                ["👤 Records who invited each member", "Use c!whoinvited @user to look up"],
                ["🏆 Leaderboard of top inviters", "Use c!inviteleaderboard in Discord"],
                ["⚠️ Fake invite detection", "Members who leave within 1 hour are flagged as fake"],
              ].map(([title, desc]) => (
                <div key={title} style={{ display: "flex", gap: 10, padding: "8px 10px", background: "var(--bg-secondary)", borderRadius: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 600, flex: 1 }}>{title}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{desc}</span>
                </div>
              ))}
            </div>
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
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>{children}</div>;
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

function VarHints({ vars }: { vars: { v: string; desc: string }[] }) {
  return (
    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
      {vars.map(({ v, desc }) => (
        <span key={v} title={desc} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "rgba(124,60,250,0.12)", border: "1px solid rgba(124,60,250,0.25)", color: "var(--accent-bright)", cursor: "default", fontFamily: "monospace" }}>
          {v}
        </span>
      ))}
      <span style={{ fontSize: 10, color: "var(--text-muted)", alignSelf: "center" }}>hover for description</span>
    </div>
  );
}

function RolePicker({ all, selected, onChange, color }: { all: any[]; selected: string[]; onChange: (ids: string[]) => void; color: string }) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {all.map((r) => {
        const active = selected.includes(r.id);
        return (
          <button key={r.id} onClick={() => toggle(r.id)} style={{
            padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
            background: active ? `${color}22` : "var(--bg-secondary)",
            border: `1px solid ${active ? color : "var(--border)"}`,
            color: active ? color : "var(--text-secondary)",
          }}>
            @{r.name}
          </button>
        );
      })}
      {all.length === 0 && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>No roles found.</span>}
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
    </div>
  );
}

const selectSty: React.CSSProperties = {
  background: "var(--bg-secondary)", border: "1px solid var(--border)",
  borderRadius: 7, color: "var(--text-primary)", fontSize: 12, padding: "8px 10px", width: "100%",
};

const inputSty: React.CSSProperties = {
  background: "var(--bg-secondary)", border: "1px solid var(--border)",
  borderRadius: 7, color: "var(--text-primary)", fontSize: 12, padding: "8px 10px", width: "100%",
  outline: "none", boxSizing: "border-box",
};

const textareaSty: React.CSSProperties = {
  background: "var(--bg-secondary)", border: "1px solid var(--border)",
  borderRadius: 7, color: "var(--text-primary)", fontSize: 12, padding: "8px 10px", width: "100%",
  outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box",
};
