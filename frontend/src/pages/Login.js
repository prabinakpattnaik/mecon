import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { formatApiError } from "../api/client";
import { Building2, Lock, Mail, ShieldCheck } from "lucide-react";

const DEMO = [
  { email: "admin@mecon.in", pwd: "Mecon@2026", role: "Administrator" },
  { email: "pc@mecon.in", pwd: "Demo@2026", role: "Project Coordinator" },
  { email: "site@mecon.in", pwd: "Demo@2026", role: "Site Engineer" },
  { email: "qaqc@mecon.in", pwd: "Demo@2026", role: "QA/QC Engineer" },
  { email: "finance@mecon.in", pwd: "Demo@2026", role: "Finance Officer" },
  { email: "contractor@lnt.com", pwd: "Demo@2026", role: "Contractor" },
  { email: "client@sail.in", pwd: "Demo@2026", role: "Client" },
];

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@mecon.in");
  const [password, setPassword] = useState("Mecon@2026");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      nav("/");
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-5">
      {/* Left – brand */}
      <div className="hidden lg:flex lg:col-span-3 login-grid text-white p-12 flex-col justify-between relative">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-blue-600 rounded-sm flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="font-display font-bold text-xl tracking-tight">MECON</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-300">Limited · Govt of India</div>
          </div>
        </div>
        <div className="max-w-xl">
          <div className="text-overline text-slate-300">Integrated Project Monitoring Platform</div>
          <h1 className="font-display text-5xl font-bold tracking-tight mt-3 leading-[1.05]">
            One Command Center for every mega-project
          </h1>
          <p className="text-slate-300 mt-5 text-base leading-relaxed">
            Real-time governance across planning, workflows, drawings, DPR,
            quality, hindrance, finance & analytics — engineered for steel,
            mining, power and heavy-engineering portfolios.
          </p>
          <div className="grid grid-cols-3 gap-6 mt-10 text-xs">
            {[
              { v: "5", l: "Active Mega Projects" },
              { v: "₹31,610 Cr", l: "Portfolio Value" },
              { v: "16", l: "Integrated Modules" },
            ].map((s) => (
              <div key={s.l}>
                <div className="font-display text-2xl font-bold text-white">{s.v}</div>
                <div className="text-overline text-slate-300 mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-widest text-slate-400">
          Restricted Access · Audit Logged · Role-Based Controls
        </div>
      </div>

      {/* Right – form */}
      <div className="lg:col-span-2 flex items-center justify-center bg-white px-8 py-12">
        <div className="w-full max-w-md">
          <div className="text-overline text-blue-700 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5" /> Secure Sign-In
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 mt-2">
            Sign in to your console
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Use your enterprise credentials issued by MECON IT.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="text-overline">Email</label>
              <div className="mt-1 flex items-center border border-slate-300 rounded-sm focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/15">
                <span className="px-3 text-slate-400"><Mail className="w-4 h-4" /></span>
                <input
                  data-testid="login-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1 py-2.5 outline-none text-sm pr-3"
                  placeholder="you@mecon.in"
                />
              </div>
            </div>
            <div>
              <label className="text-overline">Password</label>
              <div className="mt-1 flex items-center border border-slate-300 rounded-sm focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/15">
                <span className="px-3 text-slate-400"><Lock className="w-4 h-4" /></span>
                <input
                  data-testid="login-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="flex-1 py-2.5 outline-none text-sm pr-3"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div data-testid="login-error" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit-button"
              className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-semibold py-2.5 rounded-sm text-sm transition-colors"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div className="mt-8 border-t border-slate-200 pt-5">
            <div className="text-overline mb-2">Demo Accounts</div>
            <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  data-testid={`demo-login-${d.role.toLowerCase().replace(/[^a-z]/g, "-")}`}
                  type="button"
                  onClick={() => { setEmail(d.email); setPassword(d.pwd); }}
                  className="flex items-center justify-between text-left px-3 py-1.5 border border-slate-200 hover:border-blue-600 hover:bg-blue-50 rounded-sm transition-colors text-xs"
                >
                  <span className="font-medium text-slate-800">{d.role}</span>
                  <span className="font-mono text-slate-500">{d.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
