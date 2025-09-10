import React from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import * as Icons from 'react-icons/fi';
import {
  FeatureCardContainer,
  FeatureIcon,
  FeatureContent,
  FeatureTitle,
  FeatureDescription,
} from './FeatureCard.styles';

const FeatureCard = ({
  icon,
  title,
  description,
  delay = 0,
  className,
  ...props
}) => {
  // Dynamically get the icon component from react-icons
  const IconComponent = Icons[icon] || Icons.FiCircle;

  const cardVariants = {
    hidden: {
      opacity: 0,
      y: 30,
      scale: 0.95,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.6,
        ease: [0.4, 0, 0.2, 1],
        delay,
      },
    },
  };

  const iconVariants = {
    hidden: {
      scale: 0,
      rotate: -180,
    },
    visible: {
      scale: 1,
      rotate: 0,
      transition: {
        duration: 0.5,
        ease: [0.4, 0, 0.2, 1],
        delay: delay + 0.2,
      },
    },
  };

  const contentVariants = {
    hidden: {
      opacity: 0,
      y: 20,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.4, 0, 0.2, 1],
        delay: delay + 0.3,
      },
    },
  };

  return (
    <FeatureCardContainer
      as={motion.div}
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      whileHover={{
        y: -8,
        scale: 1.02,
        transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
      }}
      className={className}
      {...props}
    >
      <FeatureIcon
        as={motion.div}
        variants={iconVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
      >
        <IconComponent size={32} aria-hidden="true" />
      </FeatureIcon>
      
      <FeatureContent
        as={motion.div}
        variants={contentVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
      >
        <FeatureTitle as="h3">{title}</FeatureTitle>
        <FeatureDescription>{description}</FeatureDescription>
      </FeatureContent>
    </FeatureCardContainer>
  );
};

FeatureCard.propTypes = {
  icon: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  delay: PropTypes.number,
  className: PropTypes.string,
};

export default FeatureCard;