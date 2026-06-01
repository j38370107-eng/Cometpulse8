import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Gift, RefreshCw, XCircle, Trophy, Clock, Users, ChevronDown, ChevronUp, Settings2 } from "lucide-react";

function timeAgo(ms: number): string {
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  const s = Math.floor(abs / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (diff < 0) {
    if (d > 0) return `Ended ${d}d ago`;
    if (h > 0) return `Ended ${h}h ago`;
    if (m > 0) return `Ended ${m}m ago`;
    return "Just ended";
  }
  if (d > 0) return `${d}d ${h % 24}h left`;
  if (h > 0) return `${h}h ${m % 60}m left`;
  if (m > 0) return `${m}m left`;
  return `${s}s left`;
}

function GiveawayCard({ g, guildId, onAction }: { g: any; guildId: string; onAction: () => void }) {
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isActive = !g.ended && !g.cancelled;
  const totalEntries = (g.entries ?? []).reduce((s: number, e: any) => s + e.entries, 0);
  const uniqueEntries = (g.entries ?? []).length;

  const handleCancel = async () => {
    if (!confirm(`Cancel giveaway for "${g.prize}"?`)) return;
    setBusy(true);
    try { await api.guild.cancelGiveaway(guildId, g.id); onAction(); }
    catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  };

  const handleReroll = async () => {
    setBusy(true);
    try {
      const res = await api.guild.rerollGiveaway(guildId, g.id);
      alert(`New winner${res.winners?.length !== 1 ? "s" : ""}: ${(res.winners ?? []).map((w: string) => `<@${w}>`).join(", ") || "none"}`);
      onAction();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  };

  const statusColor = g.cancelled ? "#6b7280" : g.ended ? "#10b981" : "#7c3cfa";
  const statusLabel = g.cancelled ? "Cancelled" : g.ended ? "Ended" : "Active";

  return (
    <div style={{
      background: "var(--bg-card)",
      border: `1px solid ${isActive ? "rgba(124,60,250,0.35)" : "var(--border)"}`,
      borderRadius: 10,
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      boxShadow: isActive ? "0 0 16px rgba(124,60,250,0.08)" : "none",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{
          fontSize: 20, width: 36, height: 36, borderRadius: 8,
          background: isActive ? "rgba(124,60,250,0.15)" : "rgba(255,255,255,0.04)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>🎉</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {g.prize}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Hosted by <span style={{ color: "var(--text-secondary)" }}>{g.hostId}</span>
            {g.partnerInfo && <span> · Partner: <strong>{g.partnerInfo.serverName}</strong></span>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
            background: `${statusColor}22`, color: statusColor,
            border: `1px solid ${statusColor}44`,
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>{statusLabel}</span>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2, display: "flex" }}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatChip icon={<Users size={10} />} label={`${uniqueEntries} unique / ${totalEntries} weighted`} />
        <StatChip icon={<Trophy size={10} />} label={`${g.winnerCount} winner${g.winnerCount !== 1 ? "s" : ""}`} />
        <StatChip icon={<Clock size={10} />} label={timeAgo(g.endTime)} />
        <StatChip icon={null} label={`#${g.channelId}`} />
      </div>

      {g.ended && g.winners && g.winners.length > 0 && (
        <div style={{ fontSize: 11, color: "#10b981", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 6, padding: "6px 10px" }}>
          🏆 Winner{g.winners.length > 1 ? "s" : ""}: {g.winners.map((w: string) => `<@${w}>`).join(", ")}
        </div>
      )}

      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {g.requirements?.requiredRoles?.length > 0 && (
            <ReqLine label="Required roles" value={g.requirements.requiredRoles.map((r: string) => `<@&${r}>`).join(", ")} />
          )}
          {g.requirements?.blacklistRoles?.length > 0 && (
            <ReqLine label="Blacklisted roles" value={g.requirements.blacklistRoles.map((r: string) => `<@&${r}>`).join(", ")} />
          )}
          {g.requirements?.minLevel > 0 && (
            <ReqLine label="Min level" value={String(g.requirements.minLevel)} />
          )}
          {g.requirements?.minDays > 0 && (
            <ReqLine label="Min server age" value={`${g.requirements.minDays} days`} />
          )}
          {g.bonusRoles?.length > 0 && (
            <ReqLine label="Bonus roles" value={g.bonusRoles.map((b: any) => `×${b.entries} <@&${b.roleId}>`).join(", ")} />
          )}
          {g.boosterBonus > 0 && (
            <ReqLine label="Booster bonus" value={`+${g.boosterBonus} entries`} />
          )}
          {g.levelBonuses?.length > 0 && (
            <ReqLine label="Level bonuses" value={g.levelBonuses.map((lb: any) => `Lv${lb.minLevel}+: +${lb.bonusEntries}`).join(", ")} />
          )}
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>ID: {g.id} · Message: {g.messageId}</div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
        {isActive && (
          <ActionBtn
            label="Cancel"
            icon={<XCircle size={12} />}
            color="#ef4444"
            onClick={handleCancel}
            disabled={busy}
          />
        )}
        {g.ended && !g.cancelled && (
          <ActionBtn
            label="Reroll"
            icon={<RefreshCw size={12} />}
            color="#7c3cfa"
            onClick={handleReroll}
            disabled={busy}
          />
        )}
      </div>
    </div>
  );
}

function StatChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-secondary)" }}>
      {icon}
      {label}
    </div>
  );
}

function ReqLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
      <span style={{ color: "var(--text-muted)", minWidth: 110 }}>{label}</span>
      <span style={{ color: "var(--text-secondary)" }}>{value}</span>
    </div>
  );
}

function ActionBtn({ label, icon, color, onClick, disabled }: { label: string; icon: React.ReactNode; color: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
        background: `${color}18`, border: `1px solid ${color}44`, color,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1, transition: "all 0.15s",
      }}
    >
      {icon}{label}
    </button>
  );
}

interface GiveawayConfig {
  announcementChannelId: string | null;
  defaultBoosterBonus: number;
  managerRoles: string[];
  defaultRequiredRoles: string[];
  defaultBlacklistRoles: string[];
  defaultBonusRoles: any[];
  defaultLevelBonuses: any[];
}

export default function Giveaways() {
  const { guildId } = useParams<{ guildId: string }>();
  const [giveaways, setGiveaways] = useState<any[]>([]);
  const [config, setConfig] = useState<GiveawayConfig | null>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "ended" | "config">("active");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState<GiveawayConfig | null>(null);

  const load = async () => {
    if (!guildId) return;
    setLoading(true);
    try {
      const [g, cfg, ch, r] = await Promise.all([
        api.guild.giveaways(guildId),
        api.guild.giveawayConfig(guildId),
        api.guild.channels(guildId),
        api.guild.roles(guildId),
      ]);
      setGiveaways(g);
      setConfig(cfg);
      setDraft(cfg);
      setChannels(ch);
      setRoles(r);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [guildId]);

  const active = giveaways.filter((g) => !g.ended && !g.cancelled);
  const ended = giveaways.filter((g) => g.ended || g.cancelled);

  const saveConfig = async () => {
    if (!guildId || !draft) return;
    setSaving(true);
    try {
      await api.guild.updateGiveawayConfig(guildId, draft);
      setConfig(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const dirty = JSON.stringify(draft) !== JSON.stringify(config);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--accent)" }}>
      <Gift size={24} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div className="dash-page" style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <Gift size={20} color="var(--accent)" />
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Giveaways</h1>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
            Manage giveaways, view entries, configure defaults. Start giveaways in Discord with <code style={{ background: "var(--bg-secondary)", padding: "1px 5px", borderRadius: 4 }}>c!gstart</code>
          </p>
        </div>
        <button
          onClick={load}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600, background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer" }}
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Active", value: active.length, color: "#7c3cfa" },
          { label: "Total entries", value: active.reduce((s, g) => s + (g.entries?.length ?? 0), 0), color: "#3b82f6" },
          { label: "Ended", value: ended.length, color: "#10b981" },
        ].map((stat) => (
          <div key={stat.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {(["active", "ended", "config"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: "none", border: "none", borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === t ? "var(--accent-bright)" : "var(--text-muted)",
              textTransform: "capitalize", transition: "color 0.15s",
              marginBottom: -1,
            }}
          >
            {t === "active" ? `Active (${active.length})` : t === "ended" ? `History (${ended.length})` : "⚙ Config"}
          </button>
        ))}
      </div>

      {/* Active tab */}
      {tab === "active" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {active.length === 0 ? (
            <Empty message="No active giveaways. Start one in Discord with c!gstart." />
          ) : (
            active.map((g) => (
              <GiveawayCard key={g.id} g={g} guildId={guildId!} onAction={load} />
            ))
          )}
        </div>
      )}

      {/* Ended tab */}
      {tab === "ended" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ended.length === 0 ? (
            <Empty message="No past giveaways yet." />
          ) : (
            ended.slice(0, 50).map((g) => (
              <GiveawayCard key={g.id} g={g} guildId={guildId!} onAction={load} />
            ))
          )}
        </div>
      )}

      {/* Config tab */}
      {tab === "config" && draft && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Section title="Announcement Channel" desc="Where to announce giveaway winners by default. Leave blank to announce in the giveaway channel.">
            <select
              value={draft.announcementChannelId ?? ""}
              onChange={(e) => setDraft({ ...draft, announcementChannelId: e.target.value || null })}
              style={selectStyle}
            >
              <option value="">Same channel as giveaway</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </select>
          </Section>

          <Section title="Default Booster Bonus" desc="Extra entries server boosters automatically get. Set to 0 to disable.">
            <input
              type="number" min={0} max={10}
              value={draft.defaultBoosterBonus}
              onChange={(e) => setDraft({ ...draft, defaultBoosterBonus: parseInt(e.target.value) || 0 })}
              style={inputStyle}
            />
          </Section>

          <Section title="Manager Roles" desc="Roles allowed to start/end/cancel giveaways (besides Manage Server).">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {roles.map((r) => {
                const selected = draft.managerRoles.includes(r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() => setDraft({
                      ...draft,
                      managerRoles: selected
                        ? draft.managerRoles.filter((x) => x !== r.id)
                        : [...draft.managerRoles, r.id],
                    })}
                    style={{
                      padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                      cursor: "pointer", transition: "all 0.15s",
                      background: selected ? "rgba(124,60,250,0.2)" : "var(--bg-secondary)",
                      border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                      color: selected ? "var(--accent-bright)" : "var(--text-secondary)",
                    }}
                  >
                    @{r.name}
                  </button>
                );
              })}
              {roles.length === 0 && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>No roles found.</span>}
            </div>
          </Section>

          <Section title="Default Required Roles" desc="Roles members must have to enter any giveaway by default (can be overridden per-giveaway).">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {roles.map((r) => {
                const selected = draft.defaultRequiredRoles.includes(r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() => setDraft({
                      ...draft,
                      defaultRequiredRoles: selected
                        ? draft.defaultRequiredRoles.filter((x) => x !== r.id)
                        : [...draft.defaultRequiredRoles, r.id],
                    })}
                    style={{
                      padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                      cursor: "pointer", transition: "all 0.15s",
                      background: selected ? "rgba(59,130,246,0.2)" : "var(--bg-secondary)",
                      border: `1px solid ${selected ? "#3b82f6" : "var(--border)"}`,
                      color: selected ? "#60a5fa" : "var(--text-secondary)",
                    }}
                  >
                    @{r.name}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Default Blacklisted Roles" desc="Roles that cannot enter any giveaway by default.">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {roles.map((r) => {
                const selected = draft.defaultBlacklistRoles.includes(r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() => setDraft({
                      ...draft,
                      defaultBlacklistRoles: selected
                        ? draft.defaultBlacklistRoles.filter((x) => x !== r.id)
                        : [...draft.defaultBlacklistRoles, r.id],
                    })}
                    style={{
                      padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                      cursor: "pointer", transition: "all 0.15s",
                      background: selected ? "rgba(239,68,68,0.18)" : "var(--bg-secondary)",
                      border: `1px solid ${selected ? "#ef4444" : "var(--border)"}`,
                      color: selected ? "#f87171" : "var(--text-secondary)",
                    }}
                  >
                    @{r.name}
                  </button>
                );
              })}
            </div>
          </Section>

          {dirty && (
            <div style={{
              position: "sticky", bottom: 16,
              display: "flex", justifyContent: "flex-end", gap: 10,
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 10, padding: "10px 16px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
            }}>
              <button
                onClick={() => setDraft(config)}
                style={{ padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, background: "transparent", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer" }}
              >
                Discard
              </button>
              <button
                onClick={saveConfig}
                disabled={saving}
                style={{
                  padding: "7px 18px", borderRadius: 7, fontSize: 12, fontWeight: 700,
                  background: saved ? "#10b981" : "var(--accent)",
                  border: "none", color: "#fff", cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1, transition: "background 0.3s",
                }}
              >
                {saving ? "Saving…" : saved ? "✓ Saved" : "Save Changes"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 18px" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>{title}</div>
      {desc && <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>{desc}</div>}
      {children}
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)", fontSize: 13 }}>
      <Gift size={32} style={{ opacity: 0.3, marginBottom: 10 }} />
      <p style={{ margin: 0 }}>{message}</p>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: "var(--bg-secondary)", border: "1px solid var(--border)",
  borderRadius: 7, color: "var(--text-primary)", fontSize: 12, padding: "7px 10px", width: "100%",
};

const inputStyle: React.CSSProperties = {
  background: "var(--bg-secondary)", border: "1px solid var(--border)",
  borderRadius: 7, color: "var(--text-primary)", fontSize: 12, padding: "7px 10px", width: 80,
};
