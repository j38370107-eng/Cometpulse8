import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Zap, Shield, Bot, Users, Server, Clock, ExternalLink, ChevronRight, Activity } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../App";

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function Home() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
  }, []);

  const statusColor = stats?.status === "online" ? "var(--success)" : stats?.status === "degraded" ? "var(--warning)" : "var(--danger)";
  const statusLabel = stats?.status ?? "connecting";

  return (
    <div style={{ minHeight:"100vh", overflowX:"hidden" }}>
      {/* Hero */}
      <div className="grid-bg" style={{ position:"relative", borderBottom:"1px solid var(--border)" }}>
        <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 50% 0%, rgba(240,165,0,0.12) 0%, transparent 60%)", pointerEvents:"none" }} />
        <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 24px" }}>
          {/* Navbar */}
          <nav style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 0", borderBottom:"1px solid var(--border)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:8, background:"var(--accent-dim)", border:"2px solid var(--accent)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Zap size={18} color="var(--accent)" />
              </div>
              <span style={{ fontWeight:800, fontSize:18, color:"var(--text-primary)" }}>UtilityPalse</span>
            </div>
            <div style={{ display:"flex", gap:12 }}>
              <a href="https://discord.gg/your-support-server" target="_blank" rel="noreferrer"
                style={{ padding:"8px 14px", borderRadius:8, fontSize:13, fontWeight:500, color:"var(--text-secondary)", border:"1px solid var(--border)", background:"var(--bg-card)" }}>
                Support
              </a>
              {user ? (
                <Link to="/servers" style={{ padding:"8px 16px", borderRadius:8, fontSize:13, fontWeight:700, color:"#000", background:"var(--accent)" }}>
                  Dashboard
                </Link>
              ) : (
                <a href="/api/auth/login" style={{ padding:"8px 16px", borderRadius:8, fontSize:13, fontWeight:700, color:"#000", background:"var(--accent)" }}>
                  Login with Discord
                </a>
              )}
            </div>
          </nav>

          {/* Hero content */}
          <div style={{ textAlign:"center", padding:"72px 0 64px" }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 14px", borderRadius:100, background:"var(--accent-dim)", border:"1px solid rgba(240,165,0,0.3)", marginBottom:24 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:"var(--success)" }} className="pulse-ring" />
              <span style={{ fontSize:12, color:"var(--accent)", fontWeight:600 }}>Bot {statusLabel} · {stats?.guildCount?.toLocaleString() ?? "—"} servers</span>
            </div>

            <h1 style={{ fontSize:56, fontWeight:800, lineHeight:1.1, marginBottom:20, background:"linear-gradient(135deg, #fff 0%, #f0a500 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
              UtilityPalse
            </h1>
            <p style={{ fontSize:20, color:"var(--text-secondary)", maxWidth:560, margin:"0 auto 16px", lineHeight:1.6 }}>
              Advanced Discord Moderation Bot
            </p>
            <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:40, flexWrap:"wrap" }}>
              {["⚡ Protection", "🛡 Auto-Mod", "⚖ Enforcement"].map(t => (
                <span key={t} style={{ padding:"4px 14px", borderRadius:6, fontSize:12, fontWeight:600, background:"var(--accent)", color:"#000" }}>{t}</span>
              ))}
            </div>
            <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
              <a href="/api/auth/login" style={{
                display:"inline-flex", alignItems:"center", gap:8, padding:"13px 28px",
                background:"var(--accent)", color:"#000", borderRadius:10, fontWeight:700, fontSize:15,
              }}>
                <Zap size={16} /> Add to Server <ChevronRight size={14} />
              </a>
              <a href="#features" style={{
                display:"inline-flex", alignItems:"center", gap:8, padding:"13px 28px",
                background:"var(--bg-card)", color:"var(--text-primary)", borderRadius:10,
                fontWeight:600, fontSize:15, border:"1px solid var(--border)",
              }}>
                Learn More
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ background:"var(--bg-secondary)", borderBottom:"1px solid var(--border)" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", padding:"24px", display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:24 }}>
          {[
            { icon: <Server size={20} />, label:"Servers", value: stats?.guildCount?.toLocaleString() ?? "—" },
            { icon: <Users size={20} />, label:"Users", value: stats == null ? "—" : (stats.userCount == null ? "—" : stats.userCount.toLocaleString()) },
            { icon: <Bot size={20} />, label:"Commands", value: stats?.commandCount?.toLocaleString() ?? "60+" },
            { icon: <Clock size={20} />, label:"Uptime", value: stats ? formatUptime(stats.uptimeMs) : "—" },
            { icon: <Activity size={20} />, label:"Status", value: <span style={{ color: statusColor, textTransform:"capitalize" }}>{statusLabel}</span> },
          ].map(({ icon, label, value }) => (
            <div key={label} style={{ textAlign:"center" }}>
              <div style={{ color:"var(--accent)", display:"flex", justifyContent:"center", marginBottom:6 }}>{icon}</div>
              <div style={{ fontSize:22, fontWeight:800, color:"var(--text-primary)", marginBottom:2 }}>{value}</div>
              <div style={{ fontSize:12, color:"var(--text-muted)" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div id="features" style={{ maxWidth:1100, margin:"0 auto", padding:"72px 24px" }}>
        <div style={{ textAlign:"center", marginBottom:48 }}>
          <h2 style={{ fontSize:32, fontWeight:800, color:"var(--text-primary)", marginBottom:12 }}>Everything You Need</h2>
          <p style={{ color:"var(--text-secondary)", fontSize:15 }}>Powerful moderation tools, configured through an easy dashboard</p>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:20 }}>
          {[
            { icon: <Shield size={24} />, title:"Anti-Nuke & Anti-Raid", desc:"Protect your server from mass attacks, bot raids, and nuke attempts with real-time detection." },
            { icon: <Bot size={24} />, title:"Auto-Moderation", desc:"Word filters, spam detection, link filtering, mention limits, and more — all configurable." },
            { icon: <Zap size={24} />, title:"Shortcuts", desc:"Create custom command shortcuts for frequent punishments. One command, all the details preset." },
            { icon: <Users size={24} />, title:"Case Logging", desc:"Every action logged with full case details. Search, filter, and manage your moderation history." },
            { icon: <Activity size={24} />, title:"Server Logging", desc:"Track joins, leaves, edits, and more. Choose exactly what gets logged and where." },
            { icon: <ExternalLink size={24} />, title:"Application Forms", desc:"Create up to 5 custom forms (ban appeals, mod apps, etc.) per server with full submission review." },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{
              background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:12, padding:24,
              transition:"border-color 0.2s, transform 0.2s",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.transform = ""; }}
            >
              <div style={{ color:"var(--accent)", marginBottom:12 }}>{icon}</div>
              <div style={{ fontSize:15, fontWeight:700, color:"var(--text-primary)", marginBottom:8 }}>{title}</div>
              <div style={{ fontSize:13, color:"var(--text-secondary)", lineHeight:1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ background:"var(--bg-secondary)", borderTop:"1px solid var(--border)", padding:"64px 24px", textAlign:"center" }}>
        <h2 style={{ fontSize:28, fontWeight:800, color:"var(--text-primary)", marginBottom:12 }}>Ready to get started?</h2>
        <p style={{ color:"var(--text-secondary)", marginBottom:28, fontSize:14 }}>Add UtilityPalse to your server and configure it in minutes.</p>
        <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
          <a href="/api/auth/login" style={{ padding:"13px 32px", background:"var(--accent)", color:"#000", borderRadius:10, fontWeight:700, fontSize:15, display:"inline-flex", gap:8, alignItems:"center" }}>
            <Zap size={16} /> Invite Bot
          </a>
          <a href="https://discord.gg/your-support-server" target="_blank" rel="noreferrer"
            style={{ padding:"13px 32px", background:"var(--bg-card)", color:"var(--text-primary)", borderRadius:10, fontWeight:600, fontSize:15, border:"1px solid var(--border)", display:"inline-flex", gap:8, alignItems:"center" }}>
            <ExternalLink size={16} /> Support Server
          </a>
        </div>
      </div>

      <footer style={{ padding:"24px", textAlign:"center", color:"var(--text-muted)", fontSize:12, borderTop:"1px solid var(--border)" }}>
        © {new Date().getFullYear()} UtilityPalse · Advanced Discord Moderation
      </footer>
    </div>
  );
}
