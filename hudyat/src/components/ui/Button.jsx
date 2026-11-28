import { Link } from 'react-router-dom';

const VARIANT_CLASSES = Object.freeze({
  primary: 'hudyat-btn-primary',
  secondary: 'hudyat-btn-secondary',
  danger: 'hudyat-btn-danger',
  success: 'hudyat-btn-success',
  ghost: 'hudyat-btn-ghost',
});

const SIZE_CLASSES = Object.freeze({
  md: '',
  sm: 'hudyat-btn-sm',
});

/**
 * Standardized Hudyat Button primitive wrapping `.hudyat-btn` variants.
 * Renders a React Router `<Link>` when `to` is provided, otherwise a `<button>`.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  to,
  type = 'button',
  fullWidth = false,
  className = '',
  children,
  ...rest
}) {
  const variantClass = VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary;
  const sizeClass = SIZE_CLASSES[size] || '';
  const widthClass = fullWidth ? 'w-full' : '';
  const classes = ['hudyat-btn', variantClass, sizeClass, widthClass, className]
    .filter(Boolean)
    .join(' ');

  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
