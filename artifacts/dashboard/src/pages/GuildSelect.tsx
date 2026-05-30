import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth, useMusic } from "../App";
import { Server, ChevronRight, Zap, ExternalLink, Volume2, VolumeX, RefreshCw, Crown, ShieldCheck } from "lucide-react";

const INVITE_URL = "https://discord.com/oauth2/authorize?client_id=1507550967275458660&permissions=6293600228863223&integration_type=0&scope=bot";

export default function GuildSelect() {
  const { user } = useAuth();
  const { muted, toggleMute } = useMusic();
  const navigate = useNavigate();
  const [guilds, setGuilds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    // Always refresh from Discord on mount so permissions are up to date
    api.auth.refreshGuilds()
      .then(setGuilds)
      .catch(() => api.auth.guilds().then(setGuilds).catch(() => {}))
      .finally(() => setLoading(false));
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const fresh = await api.auth.refreshGuilds();
      setGuilds(fresh);
    } catch {
      // fall back to cached list silently
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = guilds.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));
  const avatarUrl = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }} className="hex-bg">
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: "var(--accent-dim)", border: "2px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Zap size={22} color="var(--accent)" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>Select a Server</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <ShieldCheck size={14} color="var(--accent)" />
            Servers where you have <strong style={{ color: "var(--text-primary)" }}>Manage Server</strong> permission
          </p>
        </div>

        {/* User info bar */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <img src={avatarUrl} alt="" style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid var(--accent)" }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Logged in as {user?.tag}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {guilds.length} manageable server{guilds.length !== 1 ? "s" : ""}
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh server list"
              style={{
                padding: "6px 10px", background: "var(--bg-input)", border: "1px solid var(--border)",
                borderRadius: 6, color: refreshing ? "var(--text-muted)" : "var(--accent)",
                fontSize: 12, cursor: refreshing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit",
              }}
            >
              <RefreshCw size={13} style={{ animation: refreshing ? "spin 0.7s linear infinite" : "none" }} />
              {refreshing ? "Refreshing…" : "Refresh"}
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </button>
            <button
              onClick={toggleMute}
              title={muted ? "Unmute music" : "Mute music"}
              style={{ padding: "6px 8px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 6, color: muted ? "var(--text-muted)" : "var(--accent)", cursor: "pointer", display: "flex", alignItems: "center" }}
            >
              {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <button
              onClick={async () => { await api.auth.logout(); window.location.href = "/"; }}
              style={{ padding: "6px 12px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-secondary)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Permission info */}
        <div style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldCheck size={13} color="var(--accent)" style={{ flexShrink: 0 }} />
          <span>
            Anyone with <strong style={{ color: "var(--text-primary)" }}>Manage Server</strong> or <strong style={{ color: "var(--text-primary)" }}>Administrator</strong> in a server can access its dashboard.
            Don't see a server? Click <strong style={{ color: "var(--accent)" }}>Refresh</strong> or re-login.
          </span>
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search servers…"
          style={{
            width: "100%", padding: "11px 16px", background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: 10, color: "var(--text-primary)", fontSize: 14, outline: "none", marginBottom: 16,
          }}
          onFocus={e => (e.target.style.borderColor = "var(--accent)")}
          onBlur={e => (e.target.style.borderColor = "var(--border)")}
        />

        {/* Guild list */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>Loading servers…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
            <Server size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <div style={{ marginBottom: 8 }}>
              {search ? "No servers match your search" : "No servers found"}
            </div>
            {!search && guilds.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                You need <strong>Manage Server</strong> permission in a server that has CometPulse.
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(guild => {
              const icon = guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null;
              const isOwner = guild.owner === true;
              const ADMINISTRATOR = 0x8n;
              const isAdmin = guild.permissions ? (BigInt(guild.permissions) & ADMINISTRATOR) !== 0n : false;

              return (
                <button
                  key={guild.id}
                  onClick={() => navigate(`/dashboard/${guild.id}`)}
                  style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                    background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10,
                    cursor: "pointer", width: "100%", transition: "all 0.15s", textAlign: "left",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                    (e.currentTarget as HTMLElement).style.background = "var(--bg-card-hover)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                    (e.currentTarget as HTMLElement).style.background = "var(--bg-card)";
                  }}
                >
                  {icon
                    ? <img src={icon} alt="" style={{ width: 42, height: 42, borderRadius: 10, border: "2px solid var(--border)", flexShrink: 0 }} />
                    : <div style={{ width: 42, height: 42, borderRadius: 10, background: "var(--accent-dim)", border: "2px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, color: "var(--accent)", flexShrink: 0 }}>
                        {guild.name[0]}
                      </div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {guild.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                      {isOwner
                        ? <><Crown size={10} color="#fbbf24" /> <span style={{ color: "#fbbf24" }}>Owner</span></>
                        : isAdmin
                          ? <><ShieldCheck size={10} color="var(--accent)" /> <span style={{ color: "var(--accent)" }}>Administrator</span></>
                          : <><ShieldCheck size={10} /> <span>Manage Server</span></>
                      }
                    </div>
                  </div>
                  <ChevronRight size={18} color="var(--text-muted)" />
                </button>
              );
            })}
          </div>
        )}

        {guilds.length > 0 && (
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <a
              href={INVITE_URL}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 13, color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <ExternalLink size={13} /> Add bot to another server
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
