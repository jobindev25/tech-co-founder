import React from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import Container from '../common/Container/Container';
import FeatureCard from './FeatureCard';
import {
  FeaturesSection,
  FeaturesHeader,
  FeaturesTitle,
  FeaturesSubtitle,
  FeaturesGrid,
} from './Features.styles';
import { animations } from '../../styles/animations';

// Feature data as defined in the design document
const defaultFeatures = [
  {
    id: 'conversational-planning',
    title: 'Conversational Planning',
    description: 'Interactive AI CTO to plan and iterate projects with natural language conversations.',
    icon: 'FiMessageSquare'
  },
  {
    id: 'spec-driven-development',
    title: 'Spec-Driven Development',
    description: 'Automated code generation from detailed specifications and requirements.',
    icon: 'FiFileText'
  },
  {
    id: 'seamless-collaboration',
    title: 'Seamless Collaboration',
    description: 'Notion and GitHub integrated workflows for streamlined project management.',
    icon: 'FiUsers'
  },
  {
    id: 'realtime-reviews',
    title: 'Real-time Code Reviews',
    description: 'Instant AI feedback and automated PR reviews for code quality assurance.',
    icon: 'FiCheckCircle'
  }
];

const Features = ({
  title = "Powerful Features for Modern Development",
  subtitle = "Everything you need to build, deploy, and scale your applications with AI assistance",
  features = defaultFeatures,
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
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const headerVariants = {
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

  const gridVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1],
        staggerChildren: 0.15,
        delayChildren: 0.3,
      },
    },
  };

  return (
    <FeaturesSection
      as={motion.section}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={sectionVariants}
      className={className}
      aria-labelledby="features-title"
      {...props}
    >
      <Container maxWidth="desktop" padding="large">
        <FeaturesHeader
          as={motion.div}
          variants={headerVariants}
        >
          <FeaturesTitle id="features-title" as="h2">
            {title}
          </FeaturesTitle>
          <FeaturesSubtitle>
            {subtitle}
          </FeaturesSubtitle>
        </FeaturesHeader>

        <FeaturesGrid
          as={motion.div}
          variants={gridVariants}
        >
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.id}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              delay={index * 0.1}
            />
          ))}
        </FeaturesGrid>
      </Container>
    </FeaturesSection>
  );
};

Features.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
  features: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      description: PropTypes.string.isRequired,
      icon: PropTypes.string.isRequired,
    })
  ),
  className: PropTypes.string,
};

export default Features;