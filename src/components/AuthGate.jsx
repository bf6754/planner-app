import { useState, useEffect } from "react";
import C from "../theme.js";
import { supabase, signInWithEmail, signOut } from "../data/supabase.js";

export default function AuthGate({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true); // resolving initial session
  const [email,   setEmail]   = useState("");
  const [sent,    setSent]    = useState(false);
  const [sending, setSending] = useState(false);
  const [err,     setErr]     = useState("");

  useEffect(() => {
    // Pick up session from URL hash (magic-link redirect) or existing cookie
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSend(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true); setErr("");
    const error = await signInWithEmail(email.trim());
    setSending(false);
    if (error) setErr(error.message);
    else setSent(true);
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: C.bg, fontFamily: "'Inter','Helvetica Neue',Helvetica,Arial,sans-serif" }}>
        <span style={{ color: C.sub, fontSize: 14 }}>Loading…</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: C.bg, fontFamily: "'Inter','Helvetica Neue',Helvetica,Arial,sans-serif" }}>
        <div style={{ background: C.card, borderRadius: 14, padding: "32px 28px", width: "100%", maxWidth: 360, boxShadow: "0 8px 32px rgba(40,42,52,0.10)" }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3, marginBottom: 6 }}>Weekly</div>
          {sent ? (
            <>
              <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.5, marginBottom: 4 }}>
                Check your email — we sent a magic link to
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.accent, wordBreak: "break-all", marginBottom: 20 }}>{email}</div>
              <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.5 }}>
                Click the link in the email to sign in. You can close this tab.
              </div>
              <button onClick={() => { setSent(false); setEmail(""); }}
                style={{ marginTop: 20, fontSize: 12.5, color: C.sub, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                Use a different email
              </button>
            </>
          ) : (
            <form onSubmit={handleSend}>
              <div style={{ fontSize: 13.5, color: C.sub, marginBottom: 20, lineHeight: 1.5 }}>
                Enter your email to get a sign-in link — no password needed.
              </div>
              <input
                type="email" required autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{ width: "100%", border: `1px solid ${C.line2}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, fontFamily: "inherit", outline: "none", color: C.ink, background: C.bg, boxSizing: "border-box", marginBottom: 12 }}
              />
              {err && <div style={{ fontSize: 12, color: "#c0392b", marginBottom: 8 }}>{err}</div>}
              <button type="submit" disabled={sending}
                style={{ width: "100%", background: C.accent, color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 14, fontWeight: 600, cursor: sending ? "default" : "pointer", fontFamily: "inherit", opacity: sending ? 0.7 : 1 }}>
                {sending ? "Sending…" : "Send magic link"}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Authenticated: render the app, pass user + signOut down
  return children(user, signOut);
}
