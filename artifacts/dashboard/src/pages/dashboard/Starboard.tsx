import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Star, Hash, Shield, Eye, EyeOff, Lock, Unlock, Save, RefreshCw } from "lucide-react";

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

export default function Starboard() {
  const { guildId } = useParams<{ guildId: string }>();
  const [cfg, setCfg] = useState<any>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!guildId) return;
    api.guild.starboardConfig(guildId).then(setCfg).catch(() => {});
    api.guild.channels(guildId).then(setChannels).catch(() => {});
  }, [guildId]);

  const save = async () => {
    if (!guildId || !cfg) return;
    setSaving(true);
    try {
      await api.guild.updateStarboardConfig(guildId, cfg);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {}
    setSaving(false);
  };

  const textChannels = channels.filter(c => c.type === 0);

  if (!cfg) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "var(--text-muted)", fontSize: 13 }}>
      Loading starboard settings…
    </div>
  );

  return (
    <div className="dash-page" style={{ maxWidth: 720 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,215,0,0.15)", border: "1.5px solid rgba(255,215,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Star size={18} color="#FFD700" />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Starboard</h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Highlight popular messages with star reactions</p>
        </div>
      </div>

      {/* Status */}
      <div style={card}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, marginTop: 0 }}>Status</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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

      {/* Core Config */}
      <div style={card}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, marginTop: 0 }}>Core Settings</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={label}>Starboard Channel</label>
            <select
              value={cfg.channelId}
              onChange={e => setCfg({ ...cfg, channelId: e.target.value })}
              style={{ ...input }}
            >
              <option value="">— Select channel —</option>
              {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Star Emoji</label>
            <input
              style={input}
              value={cfg.emoji}
              onChange={e => setCfg({ ...cfg, emoji: e.target.value })}
              placeholder="⭐"
            />
          </div>
          <div>
            <label style={label}>Minimum Stars</label>
            <input
              type="number" min={1} max={100}
              style={input}
              value={cfg.threshold}
              onChange={e => setCfg({ ...cfg, threshold: parseInt(e.target.value) || 3 })}
            />
          </div>
          <div>
            <label style={label}>Max Message Age (days, 0 = unlimited)</label>
            <input
              type="number" min={0}
              style={input}
              value={cfg.maxAgeDays}
              onChange={e => setCfg({ ...cfg, maxAgeDays: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>
      </div>

      {/* Behaviour Toggles */}
      <div style={card}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, marginTop: 0 }}>Behaviour</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { key: "selfStar", label: "Allow Self-Star" },
            { key: "ignoreBots", label: "Ignore Bot Messages" },
            { key: "ignoreNsfw", label: "Ignore NSFW Channels" },
          ].map(({ key, label: lbl }) => (
            <button key={key} style={toggle((cfg as any)[key])} onClick={() => setCfg({ ...cfg, [key]: !(cfg as any)[key] })}>
              {(cfg as any)[key] ? "✅" : "❌"} {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Star Levels Info */}
      <div style={card}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12, marginTop: 0 }}>Star Levels</h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>Posts automatically upgrade their icon as star count increases.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          {[
            { stars: 3, icon: "⭐", label: "Posted" },
            { stars: 10, icon: "🌟", label: "Popular" },
            { stars: 25, icon: "💫", label: "Legendary" },
            { stars: 50, icon: "🌠", label: "Hall of Fame" },
          ].map(tier => (
            <div key={tier.stars} style={{ background: "var(--bg-secondary)", borderRadius: 8, padding: "12px", textAlign: "center", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{tier.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{tier.stars}+ stars</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{tier.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button style={btn} onClick={save} disabled={saving}>
          {saving ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={13} />}
          {saved ? "Saved!" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
