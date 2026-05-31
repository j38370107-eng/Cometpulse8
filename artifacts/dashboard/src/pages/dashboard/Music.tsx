import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Music, Shield, Volume2, List, Clock, Save, RefreshCw, Hash } from "lucide-react";

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

const COMMANDS = [
  { cmd: "play <query>", desc: "Play a song or playlist by name/URL" },
  { cmd: "skip", desc: "Skip the current song" },
  { cmd: "stop", desc: "Stop music and disconnect" },
  { cmd: "pause / resume", desc: "Pause or resume playback" },
  { cmd: "queue [page]", desc: "View the song queue" },
  { cmd: "np", desc: "Show now-playing embed with controls" },
  { cmd: "volume <0-100>", desc: "Set playback volume" },
  { cmd: "loop [track/queue/off]", desc: "Toggle loop mode" },
  { cmd: "shuffle", desc: "Shuffle the queue" },
  { cmd: "remove <pos>", desc: "Remove a song by position" },
  { cmd: "clearqueue", desc: "Clear the entire queue" },
  { cmd: "search <query>", desc: "Search and pick from 5 results" },
  { cmd: "musicconfig", desc: "View/change music settings" },
];

export default function MusicPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [cfg, setCfg] = useState<any>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!guildId) return;
    api.guild.musicConfig(guildId).then(setCfg).catch(() => {});
    api.guild.channels(guildId).then(setChannels).catch(() => {});
    api.guild.roles(guildId).then(setRoles).catch(() => {});
  }, [guildId]);

  const save = async () => {
    if (!guildId || !cfg) return;
    setSaving(true);
    try {
      await api.guild.updateMusicConfig(guildId, cfg);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {}
    setSaving(false);
  };

  const textChannels = channels.filter(c => c.type === 0);
  const managedRoles = roles.filter(r => !r.managed && r.name !== "@everyone");

  if (!cfg) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "var(--text-muted)", fontSize: 13 }}>
      Loading music settings…
    </div>
  );

  return (
    <div style={{ padding: "24px 28px", maxWidth: 720 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(29,185,84,0.15)", border: "1.5px solid rgba(29,185,84,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Music size={18} color="#1DB954" />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Music</h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Play music from YouTube, Spotify, SoundCloud and more</p>
        </div>
      </div>

      {/* DJ & Channel */}
      <div style={card}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, marginTop: 0 }}>Permissions</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={label}>DJ Role (full control)</label>
            <select value={cfg.djRole} onChange={e => setCfg({ ...cfg, djRole: e.target.value })} style={input}>
              <option value="">— Anyone can control —</option>
              {managedRoles.map(r => <option key={r.id} value={r.id}>@{r.name}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Music Channel (restrict commands)</label>
            <select value={cfg.musicChannel} onChange={e => setCfg({ ...cfg, musicChannel: e.target.value })} style={input}>
              <option value="">— Any channel —</option>
              {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
          </div>
        </div>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10, marginBottom: 0 }}>
          Without a DJ role set, everyone can use all commands. With a DJ role set, non-DJs can only add songs.
        </p>
      </div>

      {/* Playback */}
      <div style={card}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, marginTop: 0 }}>Playback</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={label}>Default Volume ({cfg.defaultVolume}%)</label>
            <input
              type="range" min={1} max={100}
              value={cfg.defaultVolume}
              onChange={e => setCfg({ ...cfg, defaultVolume: parseInt(e.target.value) })}
              style={{ width: "100%", accentColor: "var(--accent)" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
              <span>1%</span><span>{cfg.defaultVolume}%</span><span>100%</span>
            </div>
          </div>
          <div>
            <label style={label}>Vote Skip Threshold (%)</label>
            <input
              type="number" min={1} max={100}
              style={input}
              value={cfg.voteskipPercent}
              onChange={e => setCfg({ ...cfg, voteskipPercent: parseInt(e.target.value) || 50 })}
            />
          </div>
          <div>
            <label style={label}>Max Queue Size</label>
            <input
              type="number" min={1} max={500}
              style={input}
              value={cfg.maxQueueSize}
              onChange={e => setCfg({ ...cfg, maxQueueSize: parseInt(e.target.value) || 100 })}
            />
          </div>
          <div>
            <label style={label}>Auto-Disconnect After (minutes)</label>
            <input
              type="number" min={0}
              style={input}
              value={Math.round(cfg.autoDisconnectMs / 60000)}
              onChange={e => setCfg({ ...cfg, autoDisconnectMs: (parseInt(e.target.value) || 5) * 60000 })}
            />
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <button style={toggle(cfg.announceNowPlaying)} onClick={() => setCfg({ ...cfg, announceNowPlaying: !cfg.announceNowPlaying })}>
            📢 {cfg.announceNowPlaying ? "Announce Now Playing" : "Silent Mode"}
          </button>
        </div>
      </div>

      {/* Commands Reference */}
      <div style={card}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12, marginTop: 0 }}>Commands Reference</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {COMMANDS.map(({ cmd, desc }) => (
            <div key={cmd} style={{ background: "var(--bg-secondary)", borderRadius: 7, padding: "8px 12px", border: "1px solid var(--border)" }}>
              <code style={{ fontSize: 11, color: "var(--accent-bright)", fontFamily: "monospace" }}>c!{cmd}</code>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      <button style={btn} onClick={save} disabled={saving}>
        {saving ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={13} />}
        {saved ? "Saved!" : "Save Changes"}
      </button>
    </div>
  );
}
