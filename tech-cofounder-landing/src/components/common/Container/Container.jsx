import React from 'react';
import PropTypes from 'prop-types';
import { StyledContainer } from './Container.styles';

const Container = ({
  children,
  maxWidth = 'desktop',
  padding = 'default',
  centered = true,
  fluid = false,
  as = 'div',
  className,
  ...props
}) => {
  return (
    <StyledContainer
      as={as}
      maxWidth={maxWidth}
      padding={padding}
      centered={centered}
      fluid={fluid}
      className={className}
      {...props}
    >
      {children}
    </StyledContainer>
  );
};

Container.propTypes = {
  children: PropTypes.node.isRequired,
  maxWidth: PropTypes.oneOf(['mobile', 'tablet', 'desktop', 'wide', 'full']),
  padding: PropTypes.oneOf(['none', 'small', 'default', 'large']),
  centered: PropTypes.bool,
  fluid: PropTypes.bool,
  as: PropTypes.string,
  className: PropTypes.string,
};

export default Container;
