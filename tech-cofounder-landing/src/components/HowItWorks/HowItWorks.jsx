import React from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import Container from '../common/Container/Container';
import ProcessStep from './ProcessStep';
import {
  HowItWorksSection,
  SectionHeader,
  SectionTitle,
  SectionSubtitle,
  ProcessContainer,
} from './HowItWorks.styles';

const defaultProcessSteps = [
  {
    id: 'onboarding',
    title: 'Onboarding',
    description: 'Quick setup and project initialization with AI guidance.',
    icon: 'FiUserPlus'
  },
  {
    id: 'planning',
    title: 'Planning',
    description: 'Collaborative project planning and specification creation.',
    icon: 'FiTarget'
  },
  {
    id: 'coding',
    title: 'Coding',
    description: 'AI-powered code generation and development assistance.',
    icon: 'FiCode'
  },
  {
    id: 'deployment',
    title: 'Deployment',
    description: 'Automated deployment and infrastructure management.',
    icon: 'FiRocket'
  },
  {
    id: 'collaboration',
    title: 'Collaboration',
    description: 'Ongoing collaboration and iterative improvements.',
    icon: 'FiRefreshCw'
  }
];

const HowItWorks = ({
  title = 'How It Works',
  subtitle = 'Get started with your AI tech co-founder in just a few simple steps',
  processSteps = defaultProcessSteps,
  className,
  ...props
}) => {
  const headerVariants = {
    hidden: {
      opacity: 0,
      y: 30,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.4, 0, 0.2, 1],
      },
    },
  };

  const containerVariants = {
    hidden: {
      opacity: 0,
    },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.3,
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  return (
    <HowItWorksSection
      as={motion.section}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      className={className}
      aria-labelledby="how-it-works-title"
      {...props}
    >
      <Container>
        <SectionHeader
          as={motion.div}
          variants={headerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          <SectionTitle id="how-it-works-title" as="h2">
            {title}
          </SectionTitle>
          <SectionSubtitle>
            {subtitle}
          </SectionSubtitle>
        </SectionHeader>

        <ProcessContainer
          as={motion.div}
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          {processSteps.map((step, index) => (
            <ProcessStep
              key={step.id}
              step={index + 1}
              title={step.title}
              description={step.description}
              icon={step.icon}
              isLast={index === processSteps.length - 1}
              delay={index * 0.2}
            />
          ))}
        </ProcessContainer>
      </Container>
    </HowItWorksSection>
  );
};

HowItWorks.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
  processSteps: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      description: PropTypes.string.isRequired,
      icon: PropTypes.string.isRequired,
    })
  ),
  className: PropTypes.string,
};

export default HowItWorks;