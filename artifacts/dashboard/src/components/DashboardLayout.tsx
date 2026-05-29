import { Outlet, useParams, NavLink, useNavigate } from "react-router-dom";
import { useAuth, useMusic } from "../App";
import { api } from "../lib/api";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Settings, Zap, Shield, FileText,
  Bot, Ban, Search, LogOut, ChevronLeft, Bell, Lock,
  ClipboardList, Ticket, ShieldAlert, Users, Info,
  Volume2, VolumeX, SlidersHorizontal, Terminal,
} from "lucide-react";

const INVITE_URL = "https://discord.com/oauth2/authorize?client_id=1507550967275458660&permissions=6293600228863223&integration_type=0&scope=bot";

const NAV_SECTIONS = [
  {
    label: null,
    items: [
      { to: "", label: "Overview", icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: "Moderation",
    items: [
      { to: "moderation", label: "Moderation Config", icon: SlidersHorizontal },
      { to: "cases", label: "Case Log", icon: FileText },
      { to: "punishments", label: "Active Punishments", icon: Ban },
      { to: "punishment-info", label: "Punishment Info", icon: Info },
    ],
  },
  {
    label: "Protection",
    items: [
      { to: "automod", label: "AutoMod", icon: Shield },
      { to: "antinuke", label: "Anti-Nuke", icon: ShieldAlert },
      { to: "antiraid", label: "Anti-Raid", icon: Users },
    ],
  },
  {
    label: "Commands",
    items: [
      { to: "shortcuts", label: "Shortcuts", icon: Zap },
      { to: "commands", label: "Command Modules", icon: Bot },
      { to: "command-perms", label: "Permissions", icon: Lock },
      { to: "custom-commands", label: "Custom Commands", icon: Terminal },
    ],
  },
  {
    label: "Server",
    items: [
      { to: "logging", label: "Server Logging", icon: Bell },
      { to: "audit-log", label: "Audit Log", icon: Search },
      { to: "applications", label: "Applications", icon: ClipboardList },
      { to: "tickets", label: "Tickets", icon: Ticket },
      { to: "settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function DashboardLayout() {
  const { guildId } = useParams<{ guildId: string }>();
  const { user, refetch } = useAuth();
  const { muted, toggleMute } = useMusic();
  const navigate = useNavigate();
  const [guild, setGuild] = useState<any>(null);
  const [botChecked, setBotChecked] = useState(false);

  useEffect(() => {
    api.auth.guilds().then((guilds) => {
      const g = guilds.find((g: any) => g.id === guildId);
      setGuild(g ?? null);
    }).catch(() => {});
  }, [guildId]);

  useEffect(() => {
    if (!guildId) return;
    api.guild.botStatus(guildId).then(({ present }) => {
      if (!present) {
        window.location.href = `${INVITE_URL}&guild_id=${guildId}&disable_guild_select=true`;
      } else {
        setBotChecked(true);
      }
    }).catch(() => setBotChecked(true));
  }, [guildId]);

  const handleLogout = async () => {
    await api.auth.logout();
    refetch();
    navigate("/");
  };

  const avatarUrl = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  const guildIconUrl = guild?.icon
    ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
    : null;

  if (!botChecked) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", color:"var(--accent)", flexDirection:"column", gap:12 }}>
        <Zap size={28} />
        <div style={{ fontSize:14, color:"var(--text-secondary)" }}>Checking bot status…</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Sidebar */}
      <aside style={{
        width: 240, flexShrink: 0, background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border)", display: "flex",
        flexDirection: "column", height: "100%", overflow: "hidden",
        zIndex: 50,
      }}>
        {/* Logo + guild selector */}
        <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:"var(--accent-dim)", border:"1px solid var(--accent)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Zap size={16} color="var(--accent)" />
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:13, color:"var(--text-primary)" }}>UtilityPalse</div>
              <div style={{ fontSize:10, color:"var(--text-muted)" }}>Dashboard</div>
            </div>
          </div>
          <button
            onClick={() => navigate("/servers")}
            style={{
              width:"100%", display:"flex", alignItems:"center", gap:8, padding:"7px 9px",
              background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:8,
              color:"var(--text-primary)", transition:"all 0.2s", cursor:"pointer",
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            {guildIconUrl
              ? <img src={guildIconUrl} alt="" style={{ width:22, height:22, borderRadius:5 }} />
              : <div style={{ width:22, height:22, borderRadius:5, background:"var(--accent-dim)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"var(--accent)" }}>
                  {guild?.name?.[0] ?? "?"}
                </div>
            }
            <span style={{ flex:1, textAlign:"left", fontSize:12, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {guild?.name ?? "Loading…"}
            </span>
            <ChevronLeft size={12} color="var(--text-muted)" style={{ transform:"rotate(-90deg)" }} />
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, overflowY:"auto", padding:"10px 10px" }}>
          {NAV_SECTIONS.map((section, si) => (
            <div key={si} style={{ marginBottom: section.label ? 6 : 2 }}>
              {section.label && (
                <div style={{ fontSize:10, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.08em", padding:"10px 10px 4px" }}>
                  {section.label}
                </div>
              )}
              {section.items.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  style={({ isActive }) => ({
                    display:"flex", alignItems:"center", gap:9, padding:"8px 10px",
                    borderRadius:7, marginBottom:1, fontSize:12, fontWeight:500,
                    color: isActive ? "var(--accent)" : "var(--text-secondary)",
                    background: isActive ? "var(--accent-dim)" : "transparent",
                    border: isActive ? "1px solid rgba(240,165,0,0.2)" : "1px solid transparent",
                    transition:"all 0.15s",
                  })}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--text-primary)"; el.style.background = "var(--bg-card)"; }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement;
                    if (!el.classList.contains("active")) { el.style.color = ""; el.style.background = ""; }
                  }}
                >
                  <Icon size={14} />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User + controls */}
        <div style={{ padding:"10px", borderTop:"1px solid var(--border)", display:"flex", alignItems:"center", gap:9 }}>
          <img src={avatarUrl} alt="" style={{ width:30, height:30, borderRadius:"50%", border:"2px solid var(--accent)" }} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:11, fontWeight:600, color:"var(--text-primary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user?.tag}</div>
            <div style={{ fontSize:10, color:"var(--text-muted)" }}>Server Admin</div>
          </div>
          <button
            onClick={toggleMute}
            title={muted ? "Unmute music" : "Mute music"}
            style={{ background:"none", border:"none", color: muted ? "var(--text-muted)" : "var(--accent)", padding:4, borderRadius:4, display:"flex", cursor:"pointer" }}
            onMouseEnter={e => (e.currentTarget.style.color = muted ? "var(--text-primary)" : "var(--accent)")}
            onMouseLeave={e => (e.currentTarget.style.color = muted ? "var(--text-muted)" : "var(--accent)")}
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <button onClick={handleLogout} style={{ background:"none", border:"none", color:"var(--text-muted)", padding:4, borderRadius:4, display:"flex", cursor:"pointer" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--danger)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex:1, overflow:"auto", background:"var(--bg-primary)" }}>
        <Outlet />
      </main>
    </div>
  );
}
