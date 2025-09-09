import React from 'react';
import PropTypes from 'prop-types';
import Container from '../common/Container/Container';
import {
  FooterSection,
  FooterContent,
  FooterLinks,
  FooterLink,
  Copyright,
} from './Footer.styles';

const Footer = ({
  links = [
    { id: 'terms', label: 'Terms', href: '/terms' },
    { id: 'privacy', label: 'Privacy', href: '/privacy' },
    { id: 'contact', label: 'Contact', href: '/contact' }
  ],
  companyName = 'Tech Co-Founder',
  className,
  ...props
}) => {
  const currentYear = new Date().getFullYear();

  return (
    <FooterSection
      className={className}
      role="contentinfo"
      aria-label="Site footer"
      {...props}
    >
      <Container maxWidth="desktop" padding="large">
        <FooterContent>
          <FooterLinks>
            {links.map((link) => (
              <FooterLink
                key={link.id}
                href={link.href}
                aria-label={`${link.label} page`}
              >
                {link.label}
              </FooterLink>
            ))}
          </FooterLinks>
          <Copyright>
            © {currentYear} {companyName}. All rights reserved.
          </Copyright>
        </FooterContent>
      </Container>
    </FooterSection>
  );
};

Footer.propTypes = {
  links: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      href: PropTypes.string.isRequired,
    })
  ),
  companyName: PropTypes.string,
  className: PropTypes.string,
};

export default Footer;