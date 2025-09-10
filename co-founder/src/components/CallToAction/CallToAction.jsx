import React from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import Container from '../common/Container/Container';
import Button from '../common/Button/Button';
import {
  CTASection,
  CTAContent,
  CTATitle,
  CTASubtitle,
  CTAButtonWrapper,
} from './CallToAction.styles';

const CallToAction = ({
  title = "Ready to Transform Your Development Process?",
  subtitle = "Join thousands of founders who've accelerated their software development with AI assistance. Start building your next project today.",
  buttonText = "Get Started",
  buttonVariant = "primary",
  buttonSize = "large",
  onButtonClick,
  className,
  ...props
}) => {
  const sectionVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.6,
        ease: [0.4, 0, 0.2, 1],
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  };

  const contentVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.4, 0, 0.2, 1],
      },
    },
  };

  const buttonVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.5,
        ease: [0.4, 0, 0.2, 1],
        delay: 0.2,
      },
    },
  };

  const handleButtonClick = (e) => {
    if (onButtonClick) {
      onButtonClick(e);
    }
  };

  return (
    <CTASection
      as={motion.section}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      variants={sectionVariants}
      className={className}
      aria-labelledby="cta-title"
      {...props}
    >
      <Container maxWidth="desktop" padding="large">
        <CTAContent
          as={motion.div}
          variants={contentVariants}
        >
          <CTATitle id="cta-title" as="h2">
            {title}
          </CTATitle>
          <CTASubtitle>
            {subtitle}
          </CTASubtitle>
          <CTAButtonWrapper
            as={motion.div}
            variants={buttonVariants}
          >
            <Button
              variant={buttonVariant}
              size={buttonSize}
              onClick={handleButtonClick}
              ariaLabel={`${buttonText} - Start your AI development journey`}
            >
              {buttonText}
            </Button>
          </CTAButtonWrapper>
        </CTAContent>
      </Container>
    </CTASection>
  );
};

CallToAction.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
  buttonText: PropTypes.string,
  buttonVariant: PropTypes.oneOf(['primary', 'secondary', 'outline', 'ghost', 'danger']),
  buttonSize: PropTypes.oneOf(['small', 'medium', 'large']),
  onButtonClick: PropTypes.func,
  className: PropTypes.string,
};

export default CallToAction;