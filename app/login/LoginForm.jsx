"use client";

import { useActionState, useState } from "react";
import { signIn, signUp } from "./actions";

const initialState = { error: null, success: null };

function Field({ label, ...props }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-bold text-white/80 mb-1.5">{label}</span>
      <input
        {...props}
        className="w-full rounded-xl bg-white/5 border border-white/15 px-4 py-2.5 outline-none focus:border-axis-blue transition"
      />
    </label>
  );
}

export default function LoginForm() {
  const [tab, setTab] = useState("signin");
  const [signInState, signInAction, signInPending] = useActionState(
    async (_prev, formData) => signIn(formData),
    initialState
  );
  const [signUpState, signUpAction, signUpPending] = useActionState(
    async (_prev, formData) => signUp(formData),
    initialState
  );

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8">
      <div className="flex mb-6 rounded-full bg-white/5 p-1">
        <button
          type="button"
          onClick={() => setTab("signin")}
          className={`flex-1 py-2 rounded-full text-sm font-extrabold transition ${
            tab === "signin" ? "bg-axis-blue text-white" : "text-white/60"
          }`}
        >
          Đăng nhập
        </button>
        <button
          type="button"
          onClick={() => setTab("signup")}
          className={`flex-1 py-2 rounded-full text-sm font-extrabold transition ${
            tab === "signup" ? "bg-axis-blue text-white" : "text-white/60"
          }`}
        >
          Đăng ký
        </button>
      </div>

      {tab === "signin" ? (
        <form action={signInAction}>
          <Field label="Email" type="email" name="email" required autoComplete="email" />
          <Field
            label="Mật khẩu"
            type="password"
            name="password"
            required
            autoComplete="current-password"
          />
          {signInState.error && (
            <p className="text-red-400 text-sm mb-4">{signInState.error}</p>
          )}
          <button
            disabled={signInPending}
            className="w-full bg-axis-yellow text-axis-navy font-extrabold py-3 rounded-full hover:scale-[1.02] transition disabled:opacity-60"
          >
            {signInPending ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
      ) : (
        <form action={signUpAction}>
          <Field label="Tên hiển thị" type="text" name="username" required minLength={3} />
          <Field label="Email" type="email" name="email" required autoComplete="email" />
          <Field
            label="Mật khẩu"
            type="password"
            name="password"
            required
            minLength={6}
            autoComplete="new-password"
          />
          {signUpState.error && (
            <p className="text-red-400 text-sm mb-4">{signUpState.error}</p>
          )}
          {signUpState.success && (
            <p className="text-emerald-400 text-sm mb-4">{signUpState.success}</p>
          )}
          <button
            disabled={signUpPending}
            className="w-full bg-axis-yellow text-axis-navy font-extrabold py-3 rounded-full hover:scale-[1.02] transition disabled:opacity-60"
          >
            {signUpPending ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
          </button>
        </form>
      )}
    </div>
  );
}
