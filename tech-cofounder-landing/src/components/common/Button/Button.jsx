import React from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import { StyledButton, ButtonContent, LoadingSpinner } from './Button.styles';
import { animations } from '../../../styles/animations';

const Button = ({
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  onClick,
  type = 'button',
  ariaLabel,
  className,
  ...props
}) => {
  const handleClick = (e) => {
    if (disabled || loading) {
      e.preventDefault();
      return;
    }
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <StyledButton
      as={motion.button}
      variant={variant}
      size={size}
      disabled={disabled || loading}
      fullWidth={fullWidth}
      onClick={handleClick}
      type={type}
      aria-label={ariaLabel}
      className={className}
      whileHover={disabled || loading ? {} : animations.button.hover}
      whileTap={disabled || loading ? {} : animations.button.tap}
      transition={animations.button.transition}
      {...props}
    >
      <ButtonContent loading={loading}>
        {loading && <LoadingSpinner />}
        {children}
      </ButtonContent>
    </StyledButton>
  );
};

Button.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary', 'outline', 'ghost', 'danger']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  fullWidth: PropTypes.bool,
  onClick: PropTypes.func,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  ariaLabel: PropTypes.string,
  className: PropTypes.string,
};

export default Button;
