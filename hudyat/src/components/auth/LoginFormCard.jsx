import Button from '../ui/Button.jsx';
import ErrorBanner from '../ui/ErrorBanner.jsx';
import StatusBanner from '../ui/StatusBanner.jsx';

/**
 * Centered authentication card for HUDYAT campus sign-in and password reset.
 */
export default function LoginFormCard({
  emailInputRef,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  allowedDomain,
  errorMessage,
  statusMessage,
  isSubmitting,
  isResetting,
  onSubmit,
  onForgotPassword,
}) {
  const busy = isSubmitting || isResetting;

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10">
      <section
        aria-labelledby="login-heading"
        className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 space-y-5"
      >
        <header className="text-center">
          <h1
            id="login-heading"
            className="text-3xl font-extrabold tracking-widest text-slate-950"
          >
            HUDYAT
          </h1>
          <p className="mt-1 text-base font-medium text-slate-700">
            Campus drill system
          </p>
        </header>

        <ErrorBanner message={errorMessage} />
        <StatusBanner tone="success" message={statusMessage} />

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="campus-email"
              className="block text-sm font-bold text-slate-900 mb-1.5"
            >
              Campus email
            </label>
            <input
              ref={emailInputRef}
              id="campus-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder={`name@${allowedDomain}`}
              disabled={busy}
              className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-950 placeholder:text-slate-500 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20 disabled:bg-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="campus-password"
              className="block text-sm font-bold text-slate-900 mb-1.5"
            >
              Password
            </label>
            <input
              id="campus-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="Enter your password"
              disabled={busy}
              className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-950 placeholder:text-slate-500 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20 disabled:bg-slate-100"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={busy}
            className="text-base"
          >
            {isSubmitting ? 'Logging in…' : 'Log in'}
          </Button>
        </form>

        <div className="text-center">
          <Button
            variant="ghost"
            onClick={onForgotPassword}
            disabled={busy}
            className="text-blue-900 underline underline-offset-2"
          >
            {isResetting ? 'Sending reset link…' : 'Forgot password?'}
          </Button>
        </div>
      </section>
    </main>
  );
}
