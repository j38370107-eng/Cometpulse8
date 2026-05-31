import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Lightbulb, MessageSquare, Clock, Users, Save, RefreshCw, Eye, EyeOff, Lock, Unlock, Bell, BellOff, AtSign } from "lucide-react";

const card: React.CSSProperties = {
  background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12,
  padding: 20, marginBottom: 20,
};
const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" };
const input: React.CSSProperties = {
  width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 13,
  outline: "none", boxSizing: "border-box",
};
const toggle = (on: boolean): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px",
  borderRadius: 20, border: "1.5px solid", cursor: "pointer", fontSize: 12, fontWeight: 600,
  background: on ? "rgba(87,242,135,0.1)" : "var(--bg-secondary)",
  borderColor: on ? "#57F287" : "var(--border)",
  color: on ? "#57F287" : "var(--text-muted)",
  transition: "all 0.2s",
});
const btn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px",
  borderRadius: 8, border: "1.5px solid var(--accent)", background: "var(--accent-dim)",
  color: "var(--accent-bright)", fontSize: 12, fontWeight: 600, cursor: "pointer",
};

export default function Suggestions() {
  const { guildId } = useParams<{ guildId: string }>();
  const [cfg, setCfg] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!guildId) return;
    api.guild.suggestionConfig(guildId).then(setCfg).catch(() => {});
    api.guild.suggestions(guildId).then(setSuggestions).catch(() => {});
    api.guild.channels(guildId).then(setChannels).catch(() => {});
    api.guild.roles(guildId).then(setRoles).catch(() => {});
  }, [guildId]);

  const save = async () => {
    if (!guildId || !cfg) return;
    setSaving(true);
    try {
      await api.guild.updateSuggestionConfig(guildId, cfg);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {}
    setSaving(false);
  };

  const textChannels = channels.filter(c => c.type === 0);
  const managedRoles = roles.filter(r => !r.managed && r.name !== "@everyone");

  const statusCounts = suggestions.reduce((acc: any, s: any) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});

  if (!cfg) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "var(--text-muted)", fontSize: 13 }}>
      Loading suggestion settings…
    </div>
  );

  return (
    <div style={{ padding: "24px 28px", maxWidth: 720 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(88,101,242,0.15)", border: "1.5px solid rgba(88,101,242,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Lightbulb size={18} color="#5865F2" />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Suggestions</h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Collect and review community suggestions</p>
        </div>
      </div>

      {/* Stats */}
      {suggestions.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Total", value: suggestions.length, color: "#5865F2" },
            { label: "Pending", value: statusCounts.pending || 0, color: "#FEE75C" },
            { label: "Approved", value: statusCounts.approved || 0, color: "#57F287" },
            { label: "Denied", value: statusCounts.denied || 0, color: "#ED4245" },
            { label: "Implemented", value: statusCounts.implemented || 0, color: "#1ABC9C" },
          ].map(stat => (
            <div key={stat.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Status */}
      <div style={card}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, marginTop: 0 }}>Status</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={toggle(cfg.enabled)} onClick={() => setCfg({ ...cfg, enabled: !cfg.enabled })}>
            {cfg.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
            {cfg.enabled ? "Enabled" : "Disabled"}
          </button>
          <button style={toggle(cfg.locked)} onClick={() => setCfg({ ...cfg, locked: !cfg.locked })}>
            {cfg.locked ? <Lock size={12} /> : <Unlock size={12} />}
            {cfg.locked ? "Locked" : "Unlocked"}
          </button>
        </div>
      </div>

      {/* Channels & Roles */}
      <div style={card}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, marginTop: 0 }}>Channels & Roles</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={label}>Suggestions Channel</label>
            <select value={cfg.channelId} onChange={e => setCfg({ ...cfg, channelId: e.target.value })} style={input}>
              <option value="">— Select channel —</option>
              {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Staff Role (can approve/deny)</label>
            <select value={cfg.staffRole} onChange={e => setCfg({ ...cfg, staffRole: e.target.value })} style={input}>
              <option value="">— None (Manage Server only) —</option>
              {managedRoles.map(r => <option key={r.id} value={r.id}>@{r.name}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Required Role to Suggest</label>
            <select value={cfg.requiredRole} onChange={e => setCfg({ ...cfg, requiredRole: e.target.value })} style={input}>
              <option value="">— Anyone —</option>
              {managedRoles.map(r => <option key={r.id} value={r.id}>@{r.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Limits */}
      <div style={card}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, marginTop: 0 }}>Limits</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={label}>Cooldown (minutes)</label>
            <input
              type="number" min={0}
              style={input}
              value={Math.round(cfg.cooldownMs / 60000)}
              onChange={e => setCfg({ ...cfg, cooldownMs: (parseInt(e.target.value) || 0) * 60000 })}
            />
          </div>
          <div>
            <label style={label}>Max Open Suggestions Per User</label>
            <input
              type="number" min={1} max={50}
              style={input}
              value={cfg.maxPerUser}
              onChange={e => setCfg({ ...cfg, maxPerUser: parseInt(e.target.value) || 3 })}
            />
          </div>
        </div>
      </div>

      {/* Behaviour */}
      <div style={card}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, marginTop: 0 }}>Behaviour</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { key: "dmNotify", label: "DM Notifications", icon: Bell },
            { key: "threadCreation", label: "Auto-Create Threads", icon: MessageSquare },
            { key: "anonymousEnabled", label: "Anonymous Submissions", icon: AtSign },
          ].map(({ key, label: lbl, icon: Icon }) => (
            <button key={key} style={toggle((cfg as any)[key])} onClick={() => setCfg({ ...cfg, [key]: !(cfg as any)[key] })}>
              <Icon size={12} />
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Recent Suggestions Preview */}
      {suggestions.length > 0 && (
        <div style={card}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12, marginTop: 0 }}>Recent Suggestions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {suggestions.slice(-5).reverse().map((s: any) => {
              const statusColor: Record<string, string> = {
                pending: "#FEE75C", approved: "#57F287", denied: "#ED4245",
                implemented: "#1ABC9C", duplicate: "#99AAB5", under_review: "#5865F2",
              };
              return (
                <div key={s.id} style={{ background: "var(--bg-secondary)", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--border)" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor[s.status] ?? "#99AAB5", flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 12, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <strong>#{String(s.id).padStart(4, "0")}</strong> — {s.content}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
                    👍 {s.upvotes?.length ?? 0} · 👎 {s.downvotes?.length ?? 0}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button style={btn} onClick={save} disabled={saving}>
        {saving ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={13} />}
        {saved ? "Saved!" : "Save Changes"}
      </button>
    </div>
  );
}
