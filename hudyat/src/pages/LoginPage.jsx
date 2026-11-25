import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../routes/authContext.js';
import {
  getAllowedEmailDomain,
  getRoleHomePath,
} from '../services/AuthService.js';

function LoginPage() {
  const { user, loading, login, logout, resetPassword } = useAuth();
  const navigate = useNavigate();
  const emailInputRef = useRef(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const allowedDomain = getAllowedEmailDomain();

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <p className="text-base font-medium text-slate-800" role="status">
          Loading session…
        </p>
      </main>
    );
  }

  if (user) {
    return <Navigate to={getRoleHomePath(user.role)} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');
    setStatusMessage('');
    setIsSubmitting(true);

    try {
      const signedInUser = await login(email, password);
      const targetPath = getRoleHomePath(signedInUser.role);

      if (targetPath === '/login') {
        await logout();
        setErrorMessage(
          'Your account role is not configured. Contact your administrator.',
        );
        return;
      }

      navigate(targetPath, { replace: true });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to log in. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    setErrorMessage('');
    setStatusMessage('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage(
        `Enter your campus email (@${allowedDomain}) above to reset your password.`,
      );
      emailInputRef.current?.focus();
      return;
    }

    setIsResetting(true);
    try {
      await resetPassword(trimmedEmail);
      setStatusMessage(
        `Password reset link sent to ${trimmedEmail.toLowerCase()}. Check your inbox.`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to send password reset email.',
      );
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10">
      <section
        aria-labelledby="login-heading"
        className="w-full max-w-md bg-white border-2 border-slate-900 rounded-xl shadow-sm p-6 sm:p-8"
      >
        <header className="mb-6 text-center">
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

        {errorMessage && (
          <div
            role="alert"
            className="mb-5 rounded-lg border-2 border-red-800 bg-red-50 px-4 py-3 text-sm font-medium text-red-950"
          >
            {errorMessage}
          </div>
        )}

        {statusMessage && (
          <div
            role="status"
            className="mb-5 rounded-lg border-2 border-emerald-800 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950"
          >
            {statusMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
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
              onChange={(event) => setEmail(event.target.value)}
              placeholder={`name@${allowedDomain}`}
              disabled={isSubmitting || isResetting}
              className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3.5 py-2.5 text-base text-slate-950 placeholder:text-slate-600 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800 disabled:bg-slate-100"
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
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              disabled={isSubmitting || isResetting}
              className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3.5 py-2.5 text-base text-slate-950 placeholder:text-slate-600 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800 disabled:bg-slate-100"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isResetting}
            className="w-full min-h-12 min-w-12 rounded-lg bg-slate-950 px-5 py-3 text-base font-bold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-800 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {isSubmitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={isSubmitting || isResetting}
            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg px-4 py-2 text-sm font-bold text-blue-900 underline underline-offset-2 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-800 disabled:opacity-60"
          >
            {isResetting ? 'Sending reset link…' : 'Forgot password?'}
          </button>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;
