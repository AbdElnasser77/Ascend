import { PASSWORD_RULES, isValidEmail, passwordProblem } from "@ascend/shared";
import { ArrowLeft, Check, Circle, Eye, EyeOff, KeyRound, LoaderCircle, LogIn, MailCheck, Send, UserPlus } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ApiError, requestPasswordReset, resetPassword, signIn, signUp, type User } from "../lib/api";

type Mode = "signin" | "signup" | "forgot" | "reset";
type Field = "name" | "email" | "password" | "confirm";

const COPY: Record<Mode, { title: string; lead: string }> = {
  signin: { title: "Welcome back", lead: "Sign in to pick up where you left off." },
  signup: { title: "Start your journey", lead: "Create an account so your progress is saved and follows you to any device." },
  forgot: { title: "Reset your password", lead: "Enter your account’s email and we’ll send you a link to choose a new password." },
  reset: { title: "Choose a new password", lead: "Pick something you haven’t used here before. You’ll be signed in right after." },
};
const MODES = Object.keys(COPY) as Mode[];

/** `#/reset?token=…` from a reset email */
function resetTokenFromUrl() {
  const m = window.location.hash.match(/^#\/reset\?(.*)$/);
  return m ? new URLSearchParams(m[1]).get("token") : null;
}

export function Auth({ onAuthed, notice }: { onAuthed: (u: User) => void; notice?: string }) {
  const [token, setToken] = useState(resetTokenFromUrl);
  const [mode, setMode] = useState<Mode>(token ? "reset" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  // a field shows its error once you've left it, or after you tried to submit
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [tried, setTried] = useState(false);
  const [serverError, setServerError] = useState<{ message: string; field?: string } | null>(notice ? { message: notice } : null);

  const signup = mode === "signup";
  const newPassword = signup || mode === "reset"; // choosing a password: rules + repeat
  const needsEmail = mode !== "reset";
  const needsPassword = mode !== "forgot";

  // client-side checks, mirroring the server (same rules from @ascend/shared)
  const problems: Partial<Record<Field, string>> = {};
  if (signup && !name.trim()) problems.name = "Enter your name";
  if (needsEmail && !isValidEmail(email.trim())) problems.email = email.trim() ? "That doesn’t look like an email address" : "Enter your email";
  if (needsPassword) {
    if (newPassword) {
      const p = passwordProblem(password, signup ? email : "");
      if (p) problems.password = p;
      if (!confirm) problems.confirm = "Repeat your password";
      else if (confirm !== password) problems.confirm = "Passwords don’t match";
    } else if (!password) problems.password = "Enter your password";
  }
  const shown = (f: Field) => (tried || touched[f] ? problems[f] : undefined) ?? (serverError?.field === f ? serverError.message : undefined);
  const generalError = serverError && !serverError.field ? serverError.message : null;

  function switchTo(m: Mode) {
    setMode(m);
    setServerError(null);
    setTouched({});
    setTried(false);
    setSentTo(null);
    if (m !== "reset" && window.location.hash.startsWith("#/reset")) history.replaceState(null, "", "#/");
  }

  // a reset link pasted into a tab that's already open only changes the hash
  useEffect(() => {
    const onHash = () => {
      const t = resetTokenFromUrl();
      if (!t) return;
      setToken(t);
      setMode("reset");
      setServerError(null);
      setTouched({});
      setTried(false);
      setSentTo(null);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setTried(true);
    setServerError(null);
    if (Object.keys(problems).length) {
      // move focus to the first field that needs attention
      const first = (["name", "email", "password", "confirm"] as Field[]).find((f) => problems[f]);
      document.getElementById(`auth-${first}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      if (mode === "forgot") {
        await requestPasswordReset(email.trim());
        setSentTo(email.trim());
      } else if (mode === "reset") {
        const user = await resetPassword(token!, password);
        history.replaceState(null, "", "#/");
        onAuthed(user);
        return;
      } else {
        const user = signup ? await signUp(name.trim(), email.trim(), password) : await signIn(email.trim(), password);
        onAuthed(user);
        return;
      }
    } catch (err) {
      setServerError(
        err instanceof ApiError ? { message: err.message, field: err.field === "token" ? undefined : err.field } : { message: "Can’t reach Ascend right now. Check your connection and try again." },
      );
    }
    setBusy(false);
  }

  const blur = (f: Field) => () => setTouched((t) => ({ ...t, [f]: true }));
  const typing = (set: (v: string) => void, f: Field) => (e: { target: { value: string } }) => {
    set(e.target.value);
    if (serverError?.field === f) setServerError(null);
  };

  const submitLabel = busy
    ? { signin: "Signing in…", signup: "Creating your account…", forgot: "Sending…", reset: "Saving…" }[mode]
    : { signin: "Sign in", signup: "Create account", forgot: "Send reset link", reset: "Save and sign in" }[mode];
  const SubmitIcon = { signin: LogIn, signup: UserPlus, forgot: Send, reset: KeyRound }[mode];

  return (
    <main className="onboarding auth">
      <section className="ob-card auth-card" aria-labelledby="auth-title">
        <div className="ob-body center">
          <img src="/brand/ascend-icon.png" alt="Ascend" className="ob-logo" />
          {/* every version shares one grid cell and crossfades, so the card never jumps */}
          <h1 id="auth-title" className="ob-title auth-swap">
            {MODES.map((m) => (
              <span key={m} className={m === mode ? "on" : ""} aria-hidden={m !== mode}>
                {sentTo && m === "forgot" ? "Check your inbox" : COPY[m].title}
              </span>
            ))}
          </h1>
          <p className="muted ob-lead auth-swap">
            {MODES.map((m) => (
              <span key={m} className={m === mode ? "on" : ""} aria-hidden={m !== mode}>
                {COPY[m].lead}
              </span>
            ))}
          </p>

          {(mode === "signin" || signup) && (
            <div className={`auth-tabs ${signup ? "right" : ""}`} role="tablist" aria-label="Account">
              <button type="button" role="tab" aria-selected={!signup} className={!signup ? "on" : ""} onClick={() => switchTo("signin")}>
                Sign in
              </button>
              <button type="button" role="tab" aria-selected={signup} className={signup ? "on" : ""} onClick={() => switchTo("signup")}>
                Create account
              </button>
            </div>
          )}

          {sentTo ? (
            <div className="auth-sent" role="status">
              <span className="auth-sent-icon" aria-hidden="true">
                <MailCheck size={26} />
              </span>
              <p>
                If an account exists for <strong>{sentTo}</strong>, a reset link is on its way. It works once, for 30 minutes.
              </p>
              <p className="muted small">Nothing yet? Check your spam folder, or send it again.</p>
              <div className="auth-sent-actions">
                <button type="button" className="ob-pill-btn" onClick={() => setSentTo(null)}>
                  Send again
                </button>
                <button type="button" className="ob-pill-btn" onClick={() => switchTo("signin")}>
                  Back to sign in
                </button>
              </div>
            </div>
          ) : (
            <form className="auth-form" onSubmit={submit} noValidate>
              <Reveal open={signup}>
                <Input id="name" label="Name" error={shown("name")}>
                  <input
                    id="auth-name"
                    className="ob-input"
                    autoComplete="name"
                    maxLength={80}
                    value={name}
                    onChange={typing(setName, "name")}
                    onBlur={blur("name")}
                    placeholder="What should we call you?"
                  />
                </Input>
              </Reveal>

              <Reveal open={needsEmail}>
                <Input id="email" label="Email" error={shown("email")}>
                  <input
                    id="auth-email"
                    className="ob-input"
                    type="email"
                    inputMode="email"
                    autoComplete={mode === "reset" ? "off" : "email"}
                    value={email}
                    onChange={typing(setEmail, "email")}
                    onBlur={blur("email")}
                    placeholder="you@example.com"
                  />
                </Input>
              </Reveal>

              <Reveal open={needsPassword}>
                <Input
                  id="password"
                  label={mode === "reset" ? "New password" : "Password"}
                  error={newPassword && !tried ? undefined : shown("password")}
                  extra={
                    mode === "signin" && (
                      <button type="button" className="auth-link" onClick={() => switchTo("forgot")}>
                        Forgot password?
                      </button>
                    )
                  }
                >
                  <span className="auth-pass">
                    <input
                      id="auth-password"
                      className="ob-input"
                      type={show ? "text" : "password"}
                      autoComplete={newPassword ? "new-password" : "current-password"}
                      maxLength={128}
                      value={password}
                      onChange={typing(setPassword, "password")}
                      onBlur={blur("password")}
                      placeholder={newPassword ? "Create a password" : "Your password"}
                    />
                    <button type="button" className="auth-eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide passwords" : "Show passwords"}>
                      {show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </Input>
                {/* live checklist while choosing a password */}
                <Reveal open={newPassword}>
                  <ul className="auth-rules" aria-label="Password requirements">
                    {PASSWORD_RULES.map((r) => {
                      const ok = password.length > 0 && r.test(password, signup ? email : "");
                      return (
                        <li key={r.id} className={ok ? "ok" : tried ? "bad" : ""}>
                          {ok ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : <Circle size={9} aria-hidden="true" />}
                          {r.label}
                          <span className="sr-only">{ok ? " (done)" : " (needed)"}</span>
                        </li>
                      );
                    })}
                  </ul>
                </Reveal>
              </Reveal>

              <Reveal open={newPassword}>
                <Input id="confirm" label="Repeat password" error={shown("confirm")} ok={confirm.length > 0 && confirm === password ? "Passwords match" : undefined}>
                  <input
                    id="auth-confirm"
                    className="ob-input"
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    maxLength={128}
                    value={confirm}
                    onChange={typing(setConfirm, "confirm")}
                    onBlur={blur("confirm")}
                    placeholder="Type it once more"
                  />
                </Input>
              </Reveal>

              {generalError && (
                <p key={generalError} className="auth-error" role="alert">
                  {generalError}
                  {mode === "reset" && /expired|invalid/i.test(generalError) && (
                    <>
                      {" "}
                      <button type="button" className="auth-link inline" onClick={() => switchTo("forgot")}>
                        Send a new link
                      </button>
                    </>
                  )}
                </p>
              )}

              <button type="submit" className="ob-pill-btn wide auth-submit" disabled={busy}>
                <span key={`${mode}-${busy}`} className="auth-submit-label">
                  {busy ? <LoaderCircle size={18} className="spin" aria-hidden="true" /> : <SubmitIcon size={18} aria-hidden="true" />}
                  {submitLabel}
                </span>
              </button>

              {(mode === "forgot" || mode === "reset") && (
                <button type="button" className="auth-link back" onClick={() => switchTo("signin")}>
                  <ArrowLeft size={15} aria-hidden="true" /> Back to sign in
                </button>
              )}
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

/** Opens and closes smoothly; hidden fields are skipped by the keyboard and screen readers. */
function Reveal({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className={`auth-reveal ${open ? "open" : ""}`} inert={!open} aria-hidden={!open}>
      <div>{children}</div>
    </div>
  );
}

function Input({ id, label, error, ok, extra, children }: { id: Field; label: string; error?: string; ok?: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className={`auth-field ${error ? "invalid" : ""}`}>
      <span className="auth-field-top">
        <label htmlFor={`auth-${id}`}>{label}</label>
        {extra}
      </span>
      {children}
      {error ? (
        <small key={error} className="auth-field-msg bad" id={`auth-${id}-msg`} role="alert">
          {error}
        </small>
      ) : ok ? (
        <small className="auth-field-msg good">
          <Check size={12} strokeWidth={3} aria-hidden="true" /> {ok}
        </small>
      ) : null}
    </div>
  );
}
