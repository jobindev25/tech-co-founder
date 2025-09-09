import React from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import * as Icons from 'react-icons/fi';
import {
  ProcessStepContainer,
  StepIndicator,
  StepNumber,
  StepIcon,
  StepContent,
  StepTitle,
  StepDescription,
  ConnectingLine,
} from './ProcessStep.styles';

const ProcessStep = ({
  step,
  title,
  description,
  icon,
  isLast = false,
  delay = 0,
  className,
  ...props
}) => {
  // Dynamically get the icon component from react-icons
  const IconComponent = Icons[icon] || Icons.FiCircle;

  const stepVariants = {
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

  const indicatorVariants = {
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
        type: "spring",
        stiffness: 200,
        damping: 15,
      },
    },
  };

  const contentVariants = {
    hidden: {
      opacity: 0,
      x: -20,
    },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.5,
        ease: [0.4, 0, 0.2, 1],
        delay: delay + 0.3,
      },
    },
  };

  const lineVariants = {
    hidden: {
      scaleY: 0,
    },
    visible: {
      scaleY: 1,
      transition: {
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1],
        delay: delay + 0.5,
      },
    },
  };

  return (
    <ProcessStepContainer
      as={motion.div}
      variants={stepVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      className={className}
      {...props}
    >
      <StepIndicator
        as={motion.div}
        variants={indicatorVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
      >
        <StepNumber>{step}</StepNumber>
        <StepIcon>
          <IconComponent size={20} role="img" aria-hidden="true" />
        </StepIcon>
      </StepIndicator>

      {!isLast && (
        <ConnectingLine
          as={motion.div}
          variants={lineVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        />
      )}

      <StepContent
        as={motion.div}
        variants={contentVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
      >
        <StepTitle as="h3">{title}</StepTitle>
        <StepDescription>{description}</StepDescription>
      </StepContent>
    </ProcessStepContainer>
  );
};

ProcessStep.propTypes = {
  step: PropTypes.number.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  icon: PropTypes.string.isRequired,
  isLast: PropTypes.bool,
  delay: PropTypes.number,
  className: PropTypes.string,
};

export default ProcessStep;