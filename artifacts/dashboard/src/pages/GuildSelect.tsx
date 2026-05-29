import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth, useMusic } from "../App";
import { Server, ChevronRight, Zap, ExternalLink, Volume2, VolumeX } from "lucide-react";

const INVITE_URL = "https://discord.com/oauth2/authorize?client_id=1507550967275458660&permissions=6293600228863223&integration_type=0&scope=bot";

export default function GuildSelect() {
  const { user } = useAuth();
  const { muted, toggleMute } = useMusic();
  const navigate = useNavigate();
  const [guilds, setGuilds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.auth.guilds().then(setGuilds).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = guilds.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));
  const avatarUrl = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg-primary)" }} className="hex-bg">
      <div style={{ maxWidth:720, margin:"0 auto", padding:"48px 24px" }}>
        {/* Header */}
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <div style={{ width:52, height:52, borderRadius:12, background:"var(--accent-dim)", border:"2px solid var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
            <Zap size={22} color="var(--accent)" />
          </div>
          <h1 style={{ fontSize:26, fontWeight:800, color:"var(--text-primary)", marginBottom:8 }}>Select a Server</h1>
          <p style={{ color:"var(--text-secondary)", fontSize:14 }}>Manage servers where you have admin permissions.</p>
        </div>

        {/* User info */}
        <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
          <img src={avatarUrl} alt="" style={{ width:36, height:36, borderRadius:"50%", border:"2px solid var(--accent)" }} />
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)" }}>Logged in as {user?.tag}</div>
            <div style={{ fontSize:11, color:"var(--text-muted)" }}>Showing servers you can manage</div>
          </div>
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
            <button
              onClick={toggleMute}
              title={muted ? "Unmute music" : "Mute music"}
              style={{
                padding:"6px 8px", background:"var(--bg-input)", border:"1px solid var(--border)",
                borderRadius:6, color: muted ? "var(--text-muted)" : "var(--accent)",
                fontSize:12, cursor:"pointer", display:"flex", alignItems:"center",
              }}
            >
              {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <button onClick={async () => { await api.auth.logout(); window.location.href = "/"; }}
              style={{ padding:"6px 12px", background:"var(--bg-input)", border:"1px solid var(--border)", borderRadius:6, color:"var(--text-secondary)", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
              Logout
            </button>
          </div>
        </div>

        {/* Search */}
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search servers…"
          style={{
            width:"100%", padding:"11px 16px", background:"var(--bg-card)", border:"1px solid var(--border)",
            borderRadius:10, color:"var(--text-primary)", fontSize:14, outline:"none", marginBottom:16,
          }}
          onFocus={e => (e.target.style.borderColor = "var(--accent)")}
          onBlur={e => (e.target.style.borderColor = "var(--border)")}
        />

        {/* Guild list */}
        {loading ? (
          <div style={{ textAlign:"center", padding:48, color:"var(--text-muted)" }}>Loading servers…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:48, color:"var(--text-muted)" }}>
            <Server size={40} style={{ marginBottom:12, opacity:0.3 }} />
            <div>No servers found</div>
            {guilds.length === 0 && (
              <a href="/api/auth/login" style={{ display:"inline-block", marginTop:16, color:"var(--accent)", fontSize:14 }}>Refresh sessions</a>
            )}
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {filtered.map(guild => {
              const icon = guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null;
              return (
                <button
                  key={guild.id}
                  onClick={() => navigate(`/dashboard/${guild.id}`)}
                  style={{
                    display:"flex", alignItems:"center", gap:14, padding:"14px 16px",
                    background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:10,
                    cursor:"pointer", width:"100%", transition:"all 0.15s", textAlign:"left",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLElement).style.background = "var(--bg-card-hover)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.background = "var(--bg-card)"; }}
                >
                  {icon
                    ? <img src={icon} alt="" style={{ width:42, height:42, borderRadius:10, border:"2px solid var(--border)", flexShrink:0 }} />
                    : <div style={{ width:42, height:42, borderRadius:10, background:"var(--accent-dim)", border:"2px solid var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:16, color:"var(--accent)", flexShrink:0 }}>
                        {guild.name[0]}
                      </div>
                  }
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:"var(--text-primary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{guild.name}</div>
                    <div style={{ fontSize:12, color:"var(--text-muted)" }}>ID: {guild.id}</div>
                  </div>
                  <ChevronRight size={18} color="var(--text-muted)" />
                </button>
              );
            })}
          </div>
        )}

        {guilds.length > 0 && (
          <div style={{ marginTop:16, textAlign:"center" }}>
            <a href={INVITE_URL}
              target="_blank" rel="noreferrer"
              style={{ fontSize:13, color:"var(--accent)", display:"inline-flex", alignItems:"center", gap:4 }}>
              <ExternalLink size={13} /> Add bot to a server
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
