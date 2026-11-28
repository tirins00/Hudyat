import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import LoginFormCard from '../components/auth/LoginFormCard.jsx';
import LoadingCard from '../components/ui/LoadingCard.jsx';
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
    return <LoadingCard fullScreen message="Loading session…" />;
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
    <LoginFormCard
      emailInputRef={emailInputRef}
      email={email}
      onEmailChange={setEmail}
      password={password}
      onPasswordChange={setPassword}
      allowedDomain={allowedDomain}
      errorMessage={errorMessage}
      statusMessage={statusMessage}
      isSubmitting={isSubmitting}
      isResetting={isResetting}
      onSubmit={handleSubmit}
      onForgotPassword={handleForgotPassword}
    />
  );
}

export default LoginPage;
