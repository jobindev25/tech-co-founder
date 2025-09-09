import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FiMenu, FiX } from 'react-icons/fi';
import Container from '../common/Container/Container';
import Button from '../common/Button/Button';
import {
  HeaderSection,
  HeaderContent,
  Logo,
  Nav,
  NavList,
  NavItem,
  NavLink,
  MobileMenuButton,
  MobileMenu,
  HeaderActions,
} from './Header.styles';

const Header = ({
  logo = 'Tech Co-Founder',
  navItems = [
    { id: 'features', label: 'Features', href: '#features' },
    { id: 'how-it-works', label: 'How It Works', href: '#how-it-works' },
    { id: 'testimonials', label: 'Testimonials', href: '#testimonials' },
  ],
  onCtaClick,
  className,
  ...props
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const handleNavClick = (href) => {
    closeMobileMenu();
    
    if (href.startsWith('#')) {
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleCtaClick = () => {
    closeMobileMenu();
    if (onCtaClick) {
      onCtaClick();
    }
  };

  return (
    <HeaderSection
      className={className}
      isScrolled={isScrolled}
      role="banner"
      {...props}
    >
      <Container maxWidth="desktop" padding="medium">
        <HeaderContent>
          <Logo href="/" aria-label="Tech Co-Founder home">
            {logo}
          </Logo>

          <Nav role="navigation" aria-label="Main navigation">
            <NavList>
              {navItems.map((item) => (
                <NavItem key={item.id}>
                  <NavLink
                    href={item.href}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavClick(item.href);
                    }}
                  >
                    {item.label}
                  </NavLink>
                </NavItem>
              ))}
            </NavList>
          </Nav>

          <HeaderActions>
            <Button
              variant="primary"
              size="medium"
              onClick={handleCtaClick}
              ariaLabel="Get started with Tech Co-Founder"
            >
              Get Started
            </Button>
          </HeaderActions>

          <MobileMenuButton
            onClick={toggleMobileMenu}
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
          </MobileMenuButton>
        </HeaderContent>

        <MobileMenu isOpen={isMobileMenuOpen}>
          <NavList>
            {navItems.map((item) => (
              <NavItem key={item.id}>
                <NavLink
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick(item.href);
                  }}
                >
                  {item.label}
                </NavLink>
              </NavItem>
            ))}
            <NavItem>
              <Button
                variant="primary"
                size="medium"
                onClick={handleCtaClick}
                style={{ width: '100%', marginTop: '1rem' }}
              >
                Get Started
              </Button>
            </NavItem>
          </NavList>
        </MobileMenu>
      </Container>
    </HeaderSection>
  );
};

Header.propTypes = {
  logo: PropTypes.string,
  navItems: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      href: PropTypes.string.isRequired,
    })
  ),
  onCtaClick: PropTypes.func,
  className: PropTypes.string,
};

export default Header;