import { Outlet, useParams, NavLink, useNavigate } from "react-router-dom";
import { useAuth, useMusic } from "../App";
import { api } from "../lib/api";
import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard, Settings, Zap, LogOut, ChevronLeft,
  Volume2, VolumeX, Gift, UserPlus, Layers, Star, Lightbulb, Music,
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
    label: "Modules",
    items: [
      { to: "levels", label: "Levels", icon: Zap },
      { to: "giveaways", label: "Giveaways", icon: Gift },
      { to: "welcome", label: "Welcome", icon: UserPlus },
      { to: "role-panels", label: "Role Panels", icon: Layers },
      { to: "starboard", label: "Starboard", icon: Star },
      { to: "suggestions", label: "Suggestions", icon: Lightbulb },
      { to: "music", label: "Music", icon: Music },
    ],
  },
  {
    label: "Server",
    items: [
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
  const accessCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refresh guild list from Discord and verify the user still has access.
  // Returns true if access is confirmed, false if revoked.
  const verifyAccess = async (id: string): Promise<boolean> => {
    try {
      const guilds = await api.auth.refreshGuilds();
      const match = guilds.find((g: any) => g.id === id);
      if (match) {
        setGuild(match);
        return true;
      }
      // Access revoked — kick to server picker
      navigate("/servers", { replace: true });
      return false;
    } catch {
      // Network error — don't kick, just keep current state
      return true;
    }
  };

  // On mount / guildId change: refresh permissions and set up periodic re-check
  useEffect(() => {
    if (!guildId) return;
    verifyAccess(guildId);

    // Re-check every 5 minutes while the user is on the dashboard
    accessCheckRef.current = setInterval(() => verifyAccess(guildId), 5 * 60 * 1000);
    return () => {
      if (accessCheckRef.current) clearInterval(accessCheckRef.current);
    };
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "var(--accent)", flexDirection: "column", gap: 12 }}>
        <Zap size={28} style={{ filter: "drop-shadow(0 0 8px var(--accent))" }} />
        <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>Checking bot status…</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        height: "100%", overflow: "hidden",
        zIndex: 50,
        boxShadow: "4px 0 24px rgba(0,0,0,0.3)",
      }}>
        {/* Logo + guild selector */}
        <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: "var(--accent-dim)",
              border: "1.5px solid var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 12px rgba(139,92,246,0.3)",
            }}>
              <Zap size={16} color="var(--accent)" />
            </div>
            <div>
              <div style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: 12, color: "var(--text-primary)", letterSpacing: "0.05em" }}>
                CometPulse
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Dashboard</div>
            </div>
          </div>

          <button
            onClick={() => navigate("/servers")}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 8,
              padding: "7px 9px",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text-primary)",
              transition: "all 0.2s",
              cursor: "pointer",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 8px rgba(139,92,246,0.2)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLElement).style.boxShadow = "";
            }}
          >
            {guildIconUrl
              ? <img src={guildIconUrl} alt="" style={{ width: 22, height: 22, borderRadius: 5 }} />
              : <div style={{
                  width: 22, height: 22, borderRadius: 5,
                  background: "var(--accent-dim)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, color: "var(--accent)",
                }}>
                  {guild?.name?.[0] ?? "?"}
                </div>
            }
            <span style={{ flex: 1, textAlign: "left", fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {guild?.name ?? "Loading…"}
            </span>
            <ChevronLeft size={12} color="var(--text-muted)" style={{ transform: "rotate(-90deg)" }} />
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
          {NAV_SECTIONS.map((section, si) => (
            <div key={si} style={{ marginBottom: section.label ? 4 : 2 }}>
              {section.label && (
                <div style={{
                  fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
                  textTransform: "uppercase", letterSpacing: "0.1em",
                  padding: "12px 10px 4px",
                }}>
                  {section.label}
                </div>
              )}
              {section.items.map(({ to, label, icon: Icon, end }: any) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  style={({ isActive }) => ({
                    display: "flex", alignItems: "center", gap: 9,
                    padding: "8px 10px",
                    borderRadius: 8, marginBottom: 1,
                    fontSize: 12, fontWeight: 500,
                    color: isActive ? "var(--accent-bright)" : "var(--text-secondary)",
                    background: isActive ? "var(--accent-dim)" : "transparent",
                    border: isActive ? "1px solid rgba(139,92,246,0.25)" : "1px solid transparent",
                    boxShadow: isActive ? "inset 0 0 12px rgba(139,92,246,0.08)" : "none",
                    transition: "all 0.15s",
                    textDecoration: "none",
                  })}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.color = "var(--text-primary)";
                    el.style.background = "var(--bg-card)";
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement;
                    if (!el.classList.contains("active")) {
                      el.style.color = "";
                      el.style.background = "";
                    }
                  }}
                >
                  <Icon size={14} />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div style={{
          padding: "10px 12px",
          borderTop: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 9,
          background: "var(--bg-card)",
        }}>
          <img src={avatarUrl} alt="" style={{ width: 30, height: 30, borderRadius: "50%", border: "2px solid var(--accent)", boxShadow: "0 0 8px rgba(139,92,246,0.4)" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.tag}</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Server Admin</div>
          </div>
          <button
            onClick={toggleMute}
            title={muted ? "Unmute music" : "Mute music"}
            style={{ background: "none", border: "none", color: muted ? "var(--text-muted)" : "var(--accent)", padding: 4, borderRadius: 4, display: "flex", cursor: "pointer" }}
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <button
            onClick={handleLogout}
            title="Logout"
            style={{ background: "none", border: "none", color: "var(--text-muted)", padding: 4, borderRadius: 4, display: "flex", cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--danger)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: "auto", background: "var(--bg-primary)" }}>
        <Outlet />
      </main>
    </div>
  );
}
