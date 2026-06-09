import { useState, useEffect } from "react";
import C from "../theme.js";
import { supabase, signIn, signUp, signOut } from "../data/supabase.js";

export default function AuthGate({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode,    setMode]    = useState("signin"); // "signin" | "signup"
  const [email,   setEmail]   = useState("");
  const [pw,      setPw]      = useState("");
  const [pw2,     setPw2]     = useState("");
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState("");
  const [info,    setInfo]    = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(""); setInfo("");
    if (mode === "signup" && pw !== pw2) { setErr("Passwords don't match."); return; }
    if (pw.length < 6) { setErr("Password must be at least 6 characters."); return; }
    setBusy(true);
    const error = mode === "signin"
      ? await signIn(email.trim(), pw)
      : await signUp(email.trim(), pw);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    if (mode === "signup") setInfo("Account created! You can now sign in.");
  }

  const inputStyle = {
    width: "100%", border: `1px solid ${C.line2}`, borderRadius: 8,
    padding: "10px 12px", fontSize: 14, fontFamily: "inherit",
    outline: "none", color: C.ink, background: C.bg,
    boxSizing: "border-box", marginBottom: 10,
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: C.bg, fontFamily: "'Inter',sans-serif" }}>
      <span style={{ color: C.sub, fontSize: 14 }}>Loading…</span>
    </div>
  );

  if (!user) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: C.bg, fontFamily: "'Inter','Helvetica Neue',Helvetica,Arial,sans-serif" }}>
      <div style={{ background: C.card, borderRadius: 14, padding: "32px 28px", width: "100%", maxWidth: 360, boxShadow: "0 8px 32px rgba(40,42,52,0.10)" }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3, marginBottom: 20 }}>Weekly</div>
        <form onSubmit={handleSubmit}>
          <input type="email" required autoFocus placeholder="Email" value={email}
            onChange={(e) => { setEmail(e.target.value); setErr(""); }}
            style={inputStyle} />
          <input type="password" required placeholder="Password" value={pw}
            onChange={(e) => { setPw(e.target.value); setErr(""); }}
            style={inputStyle} />
          {mode === "signup" && (
            <input type="password" required placeholder="Confirm password" value={pw2}
              onChange={(e) => { setPw2(e.target.value); setErr(""); }}
              style={inputStyle} />
          )}
          {err  && <div style={{ fontSize: 12.5, color: "#c0392b", marginBottom: 8 }}>{err}</div>}
          {info && <div style={{ fontSize: 12.5, color: C.doneInk, marginBottom: 8 }}>{info}</div>}
          <button type="submit" disabled={busy}
            style={{ width: "100%", background: C.accent, color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 14, fontWeight: 600, cursor: busy ? "default" : "pointer", fontFamily: "inherit", opacity: busy ? 0.7 : 1 }}>
            {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
        <div style={{ marginTop: 16, textAlign: "center", fontSize: 12.5, color: C.sub }}>
          {mode === "signin" ? (
            <>No account? <button onClick={() => { setMode("signup"); setErr(""); setInfo(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.accent, fontFamily: "inherit", fontSize: 12.5, padding: 0 }}>Create one</button></>
          ) : (
            <>Already have one? <button onClick={() => { setMode("signin"); setErr(""); setInfo(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.accent, fontFamily: "inherit", fontSize: 12.5, padding: 0 }}>Sign in</button></>
          )}
        </div>
      </div>
    </div>
  );

  return children(user, signOut);
}
