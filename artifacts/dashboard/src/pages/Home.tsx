import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Zap, Shield, Gift, Wrench, Users, Server, Clock, Activity, ExternalLink, ChevronRight } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../App";

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const FEATURES = [
  { icon: "⚡", label: "LEVELING", desc: "XP system with leaderboards, rank cards, level roles, and configurable multipliers." },
  { icon: "👋", label: "WELCOMING", desc: "Custom welcome messages, DMs, and role assignment on join and leave." },
  { icon: "🎁", label: "GIVEAWAYS", desc: "Easy giveaway creation with re-roll, end, bonus entries, and winner management." },
  { icon: "⭐", label: "STARBOARD", desc: "Auto-highlight popular messages with star reactions. Star levels, custom emoji, and leaderboard." },
  { icon: "💡", label: "SUGGESTIONS", desc: "Community suggestions with vote buttons, staff review, DM notifications, and discussion threads." },
  { icon: "🎛️", label: "ROLE PANELS", desc: "Button, dropdown, and reaction role panels. Assign roles on click or reaction in any channel." },
];

function HexGrid() {
  return (
    <svg
      style={{ position: "absolute", top: 0, right: 0, width: "55%", height: "100%", opacity: 0.35, pointerEvents: "none" }}
      viewBox="0 0 600 500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer dashed hexagon */}
      <polygon
        points="450,60 560,120 560,340 450,400 340,340 340,120"
        stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="8 6" fill="none"
        style={{ animation: "dash-move 3s linear infinite" }}
      />
      {/* Inner dashed hexagon */}
      <polygon
        points="450,130 510,165 510,295 450,330 390,295 390,165"
        stroke="#7c3aed" strokeWidth="1" strokeDasharray="5 5" fill="none"
        style={{ animation: "dash-move 4s linear infinite reverse" }}
      />
      {/* Corner dots */}
      {[[450,60],[560,120],[560,340],[450,400],[340,340],[340,120]].map(([cx,cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="5" fill="#8b5cf6" opacity="0.9" />
      ))}
      {/* Center glowing orb */}
      <circle cx="450" cy="230" r="18" fill="#7c3aed" opacity="0.25" className="glow-orb" />
      <circle cx="450" cy="230" r="9" fill="#a78bfa" opacity="0.8" className="glow-orb" />
      {/* Connection lines */}
      <line x1="340" y1="120" x2="450" y2="230" stroke="#8b5cf6" strokeWidth="0.8" strokeDasharray="4 4" opacity="0.5" />
      <line x1="560" y1="120" x2="450" y2="230" stroke="#8b5cf6" strokeWidth="0.8" strokeDasharray="4 4" opacity="0.5" />
      <line x1="450" y1="400" x2="450" y2="230" stroke="#8b5cf6" strokeWidth="0.8" strokeDasharray="4 4" opacity="0.5" />
      {/* Small accent dots */}
      <circle cx="340" cy="120" r="3.5" fill="#a78bfa" />
      <circle cx="560" cy="120" r="3.5" fill="#a78bfa" />
      <circle cx="450" cy="400" r="3.5" fill="#a78bfa" />
      <circle cx="200" cy="80" r="2.5" fill="#8b5cf6" opacity="0.6" />
      <circle cx="150" cy="200" r="2" fill="#8b5cf6" opacity="0.4" />
    </svg>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
  }, []);

  const statusColor = stats?.status === "online" ? "var(--success)" : stats?.status === "degraded" ? "var(--warning)" : "#555";
  const statusLabel = stats?.status ?? "connecting";

  return (
    <div style={{ minHeight: "100vh", overflowX: "hidden" }}>

      {/* Hero */}
      <div style={{ position: "relative", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", overflow: "hidden", minHeight: 480 }}>
        {/* Dot grid overlay */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "radial-gradient(circle, rgba(139,92,246,0.12) 1px, transparent 1px)",
          backgroundSize: "30px 30px",
        }} />
        {/* Purple radial glow top-right */}
        <div style={{
          position: "absolute", top: -80, right: "20%", width: 400, height: 400,
          borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.22) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <HexGrid />

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", position: "relative", zIndex: 2 }}>
          {/* Navbar */}
          <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 0", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--accent-dim)", border: "2px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Zap size={18} color="var(--accent)" />
              </div>
              <span style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: 16, color: "var(--text-primary)", letterSpacing: "0.04em" }}>
                CometPulse
              </span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <a
                href="https://discord.gg/your-support-server"
                target="_blank" rel="noreferrer"
                style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", border: "1px solid var(--border)", background: "var(--bg-card)" }}
              >
                Support
              </a>
              {user ? (
                <Link to="/servers" style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, color: "#fff", background: "var(--accent)" }}>
                  Dashboard
                </Link>
              ) : (
                <a href="/api/auth/login" style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, color: "#fff", background: "var(--accent)" }}>
                  Login with Discord
                </a>
              )}
            </div>
          </nav>

          {/* Hero content */}
          <div style={{ padding: "68px 0 72px" }}>
            {/* Status pill */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px", borderRadius: 100, background: "var(--accent-dim)", border: "1px solid rgba(139,92,246,0.3)", marginBottom: 28 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor }} className="pulse-ring" />
              <span style={{ fontSize: 12, color: "var(--accent-bright)", fontWeight: 600 }}>
                Bot {statusLabel} · {stats?.guildCount?.toLocaleString() ?? "—"} servers
              </span>
            </div>

            <h1 style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: 64, fontWeight: 900, lineHeight: 1.05, marginBottom: 16,
              color: "#fff",
              letterSpacing: "-0.01em",
            }}>
              CometPulse
            </h1>
            <p style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 40, letterSpacing: "0.18em", fontWeight: 500, textTransform: "uppercase" }}>
              Advanced Discord Utility Bot
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a href="/api/auth/login" style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 28px",
                background: "var(--accent)", color: "#fff", borderRadius: 10, fontWeight: 700, fontSize: 15,
                boxShadow: "0 0 24px rgba(139,92,246,0.4)",
              }}>
                <Zap size={16} /> Add to Server <ChevronRight size={14} />
              </a>
              <a href="#features" style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 28px",
                background: "transparent", color: "var(--text-primary)", borderRadius: 10,
                fontWeight: 600, fontSize: 15, border: "1px solid var(--border)",
              }}>
                Learn More
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      <div id="features" style={{ background: "var(--bg-primary)", padding: "72px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: "var(--text-primary)", marginBottom: 12 }}>
              Everything Your Server Needs
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>
              Powerful features, easy to configure from one dashboard
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
            {FEATURES.map(({ icon, label, desc }) => (
              <div
                key={label}
                style={{
                  background: "var(--bg-card)",
                  border: "1.5px solid var(--border)",
                  borderRadius: 14,
                  padding: "28px 22px",
                  transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
                  cursor: "default",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = "var(--accent)";
                  el.style.boxShadow = "0 0 20px rgba(139,92,246,0.2)";
                  el.style.transform = "translateY(-3px)";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = "var(--border)";
                  el.style.boxShadow = "";
                  el.style.transform = "";
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 14 }}>{icon}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "0.12em", marginBottom: 10 }}>{label}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ background: "var(--bg-secondary)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 24 }}>
          {[
            { icon: <Server size={20} />, label: "Servers", value: stats?.guildCount?.toLocaleString() ?? "—" },
            { icon: <Users size={20} />, label: "Users", value: stats?.userCount?.toLocaleString() ?? "—" },
            { icon: <Clock size={20} />, label: "Uptime", value: stats ? formatUptime(stats.uptimeMs) : "—" },
            { icon: <Activity size={20} />, label: "Status", value: <span style={{ color: statusColor, textTransform: "capitalize" }}>{statusLabel}</span> },
          ].map(({ icon, label, value }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ color: "var(--accent)", display: "flex", justifyContent: "center", marginBottom: 8 }}>{icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 3 }}>{value}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ background: "var(--bg-primary)", padding: "72px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: 30, fontWeight: 800, color: "var(--text-primary)", marginBottom: 12 }}>Ready to get started?</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: 32, fontSize: 15 }}>
          Add CometPulse to your server and configure everything in minutes.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/api/auth/login" style={{
            padding: "13px 32px", background: "var(--accent)", color: "#fff", borderRadius: 10,
            fontWeight: 700, fontSize: 15, display: "inline-flex", gap: 8, alignItems: "center",
            boxShadow: "0 0 24px rgba(139,92,246,0.35)",
          }}>
            <Zap size={16} /> Invite Bot
          </a>
          <a href="https://discord.gg/your-support-server" target="_blank" rel="noreferrer"
            style={{
              padding: "13px 32px", background: "var(--bg-card)", color: "var(--text-primary)",
              borderRadius: 10, fontWeight: 600, fontSize: 15, border: "1px solid var(--border)",
              display: "inline-flex", gap: 8, alignItems: "center",
            }}>
            <ExternalLink size={16} /> Support Server
          </a>
        </div>
      </div>

      <footer style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: 12, borderTop: "1px solid var(--border)" }}>
        © {new Date().getFullYear()} CometPulse · Advanced Discord Utility Bot
      </footer>
    </div>
  );
}
