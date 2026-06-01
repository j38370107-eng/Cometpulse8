import { ReactNode, CSSProperties, useState } from "react";

interface CardProps { children: ReactNode; style?: CSSProperties; className?: string; }
export function Card({ children, style, className }: CardProps) {
  return (
    <div className={className} style={{
      background:"var(--bg-card)", border:"1px solid var(--border)",
      borderRadius:12, padding:24, ...style
    }}>{children}</div>
  );
}

interface ButtonProps {
  children: ReactNode; onClick?: () => void; variant?: "primary"|"secondary"|"danger"|"ghost";
  size?: "sm"|"md"; disabled?: boolean; type?: "button"|"submit"; style?: CSSProperties; fullWidth?: boolean;
}
export function Button({ children, onClick, variant="primary", size="md", disabled, type="button", style, fullWidth }: ButtonProps) {
  const styles: Record<string, CSSProperties> = {
    primary: { background:"var(--accent)", color:"#000", fontWeight:700 },
    secondary: { background:"var(--bg-input)", color:"var(--text-primary)", border:"1px solid var(--border)" },
    danger: { background:"var(--danger-dim)", color:"var(--danger)", border:"1px solid rgba(239,68,68,0.3)" },
    ghost: { background:"transparent", color:"var(--text-secondary)", border:"1px solid transparent" },
  };
  const sizes: Record<string, CSSProperties> = {
    sm: { padding:"6px 12px", fontSize:12, borderRadius:6 },
    md: { padding:"10px 18px", fontSize:13, borderRadius:8 },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
      fontFamily:"inherit", fontWeight:600, display:"inline-flex", alignItems:"center",
      gap:6, transition:"all 0.15s", outline:"none", width: fullWidth ? "100%" : undefined,
      justifyContent: fullWidth ? "center" : undefined,
      ...styles[variant], ...sizes[size], ...style
    }}>{children}</button>
  );
}

interface InputProps {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; style?: CSSProperties; label?: string; hint?: string;
}
export function Input({ value, onChange, placeholder, type="text", style, label, hint }: InputProps) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      {label && <label style={{ fontSize:12, fontWeight:600, color:"var(--text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em" }}>{label}</label>}
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{
          padding:"10px 14px", background:"var(--bg-input)",
          border:"1px solid var(--border)", borderRadius:8,
          color:"var(--text-primary)", fontSize:13, outline:"none",
          width:"100%", transition:"border-color 0.15s", ...style
        }}
        onFocus={e => (e.target.style.borderColor = "var(--accent)")}
        onBlur={e => (e.target.style.borderColor = "var(--border)")}
      />
      {hint && <div style={{ fontSize:11, color:"var(--text-muted)" }}>{hint}</div>}
    </div>
  );
}

interface TextAreaProps {
  value: string; onChange: (v: string) => void; placeholder?: string;
  rows?: number; style?: CSSProperties; label?: string;
}
export function TextArea({ value, onChange, placeholder, rows=4, style, label }: TextAreaProps) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      {label && <label style={{ fontSize:12, fontWeight:600, color:"var(--text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em" }}>{label}</label>}
      <textarea
        value={value} placeholder={placeholder} rows={rows}
        onChange={e => onChange(e.target.value)}
        style={{
          padding:"10px 14px", background:"var(--bg-input)",
          border:"1px solid var(--border)", borderRadius:8,
          color:"var(--text-primary)", fontSize:13, outline:"none",
          width:"100%", resize:"vertical", transition:"border-color 0.15s", ...style
        }}
        onFocus={e => (e.target.style.borderColor = "var(--accent)")}
        onBlur={e => (e.target.style.borderColor = "var(--border)")}
      />
    </div>
  );
}

interface SelectProps { value: string; onChange: (v: string) => void; label?: string; style?: CSSProperties; children: ReactNode; }
export function Select({ value, onChange, label, style, children }: SelectProps) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      {label && <label style={{ fontSize:12, fontWeight:600, color:"var(--text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em" }}>{label}</label>}
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{
          padding:"10px 14px", background:"var(--bg-input)",
          border:"1px solid var(--border)", borderRadius:8,
          color:"var(--text-primary)", fontSize:13, outline:"none",
          width:"100%", cursor:"pointer", ...style
        }}
        onFocus={e => (e.target.style.borderColor = "var(--accent)")}
        onBlur={e => (e.target.style.borderColor = "var(--border)")}
      >{children}</select>
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <label style={{ display:"inline-flex", alignItems:"center", gap:8, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}>
      <div
        onClick={() => !disabled && onChange(!checked)}
        style={{
          width:40, height:22, borderRadius:11,
          background: checked ? "var(--accent)" : "var(--bg-input)",
          border:`1px solid ${checked ? "var(--accent)" : "var(--border)"}`,
          position:"relative", transition:"all 0.2s", flexShrink:0,
        }}
      >
        <div style={{
          position:"absolute", top:2,
          left: checked ? 19 : 2,
          width:16, height:16, borderRadius:"50%",
          background:"#fff", transition:"left 0.2s",
          boxShadow:"0 1px 4px rgba(0,0,0,0.3)",
        }} />
      </div>
      {label && <span style={{ fontSize:13, color:"var(--text-primary)" }}>{label}</span>}
    </label>
  );
}

export function Badge({ children, color="muted" }: { children: ReactNode; color?: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    muted:   { bg:"var(--bg-input)",     text:"var(--text-muted)" },
    accent:  { bg:"var(--accent-dim)",   text:"var(--accent)" },
    success: { bg:"rgba(34,197,94,0.15)",text:"var(--success)" },
    danger:  { bg:"rgba(239,68,68,0.15)",text:"var(--danger)" },
    warning: { bg:"rgba(245,158,11,0.15)",text:"var(--warning)" },
    info:    { bg:"rgba(59,130,246,0.15)",text:"var(--info)" },
  };
  const c = colors[color] ?? colors.muted;
  return (
    <span style={{
      display:"inline-flex", alignItems:"center",
      padding:"2px 8px", borderRadius:6,
      fontSize:11, fontWeight:700,
      background:c.bg, color:c.text,
    }}>{children}</span>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:28, flexWrap:"wrap", gap:12 }}>
      <div>
        <h1 style={{ fontSize:22, fontWeight:800, color:"var(--text-primary)", marginBottom:4 }}>{title}</h1>
        {subtitle && <div style={{ fontSize:13, color:"var(--text-secondary)" }}>{subtitle}</div>}
      </div>
      {children && <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>{children}</div>}
    </div>
  );
}

export function Toast({ message, type="info", onClose }: { message: string; type?: string; onClose: () => void }) {
  const colors = { success:"var(--success)", error:"var(--danger)", info:"var(--accent)" } as any;
  return (
    <div style={{
      position:"fixed", top:20, right:20, zIndex:9999,
      background:"var(--bg-card)", border:`1px solid ${colors[type] ?? colors.info}`,
      borderRadius:10, padding:"12px 18px",
      display:"flex", alignItems:"center", gap:10,
      boxShadow:"0 8px 32px rgba(0,0,0,0.5)",
      fontSize:13, fontWeight:600, color:"var(--text-primary)",
      maxWidth: "calc(100vw - 40px)",
    }}>
      <div style={{ width:8, height:8, borderRadius:"50%", background:colors[type] ?? colors.info, flexShrink:0 }} />
      {message}
      <button onClick={onClose} style={{ background:"none", border:"none", color:"var(--text-muted)", cursor:"pointer", padding:2, marginLeft:4, fontSize:16 }}>×</button>
    </div>
  );
}

export function useToast() {
  const [state, setState] = useState<{ message: string; type: string } | null>(null);
  const show = (message: string, type = "info") => {
    setState({ message, type });
    setTimeout(() => setState(null), 3500);
  };
  const ToastEl = state ? <Toast message={state.message} type={state.type} onClose={() => setState(null)} /> : null;
  return { show, ToastEl };
}

export function Spinner() {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"60vh" }}>
      <div style={{
        width:32, height:32, borderRadius:"50%",
        border:"3px solid var(--border)",
        borderTopColor:"var(--accent)",
        animation:"spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}

interface ModalProps { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number; }
export function Modal({ open, onClose, title, children, width=480 }: ModalProps) {
  if (!open) return null;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:12 }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.7)" }} />
      <div className="modal-inner" style={{
        position:"relative", background:"var(--bg-card)", border:"1px solid var(--border)",
        borderRadius:12, width:"100%", maxWidth:width, maxHeight:"90dvh", overflow:"auto",
        boxShadow:"0 24px 64px rgba(0,0,0,0.5)",
      }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 20px", borderBottom:"1px solid var(--border)", position:"sticky", top:0, background:"var(--bg-card)", zIndex:1 }}>
          <h2 style={{ fontSize:15, fontWeight:700, color:"var(--text-primary)" }}>{title}</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"var(--text-muted)", fontSize:20, lineHeight:1, padding:4 }}>×</button>
        </div>
        <div style={{ padding:"20px" }}>{children}</div>
      </div>
    </div>
  );
}

export function StatCard({ label, value, icon, color="accent" }: { label: string; value: string|number; icon: ReactNode; color?: string }) {
  const colors: Record<string, string> = { accent:"var(--accent)", success:"var(--success)", danger:"var(--danger)", info:"var(--info)", warning:"var(--warning)" };
  const c = colors[color] ?? colors.accent;
  return (
    <Card style={{ display:"flex", alignItems:"center", gap:16 }}>
      <div style={{ width:44, height:44, borderRadius:10, background:`${c}20`, border:`1px solid ${c}40`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, color:c }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize:22, fontWeight:800, color:"var(--text-primary)" }}>{value}</div>
        <div style={{ fontSize:12, color:"var(--text-secondary)" }}>{label}</div>
      </div>
    </Card>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div style={{ textAlign:"center", padding:"48px 24px" }}>
      <div style={{ color:"var(--text-muted)", marginBottom:12, display:"flex", justifyContent:"center" }}>{icon}</div>
      <div style={{ fontSize:16, fontWeight:700, color:"var(--text-primary)", marginBottom:8 }}>{title}</div>
      {description && <div style={{ fontSize:13, color:"var(--text-secondary)", marginBottom:16 }}>{description}</div>}
      {action}
    </div>
  );
}

interface SaveBarProps { dirty: boolean; saving: boolean; onSave: () => void; onDiscard: () => void; }
export function SaveBar({ dirty, saving, onSave, onDiscard }: SaveBarProps) {
  return (
    <div className="save-bar" style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
      transform: dirty ? "translateY(0)" : "translateY(100%)",
      transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
      background: "var(--bg-card)",
      borderTop: "1px solid var(--accent)",
      boxShadow: "0 -4px 32px rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 32px", gap: 16, flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
        <span className="save-bar-msg" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
          Want to save your changes?
        </span>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          className="save-bar-btn-discard"
          onClick={onDiscard}
          disabled={saving}
          style={{
            padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: 8,
            background: "var(--bg-input)", border: "1px solid var(--border)",
            color: "var(--text-secondary)", cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.5 : 1, fontFamily: "inherit",
          }}
        >
          Discard
        </button>
        <button
          className="save-bar-btn-save"
          onClick={onSave}
          disabled={saving}
          style={{
            padding: "8px 20px", fontSize: 13, fontWeight: 700, borderRadius: 8,
            background: "var(--accent)", border: "none",
            color: "#000", cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1, fontFamily: "inherit",
          }}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
