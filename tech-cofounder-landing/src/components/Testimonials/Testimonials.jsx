import React from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import Container from '../common/Container/Container';
import TestimonialCard from './TestimonialCard';
import {
  TestimonialsSection,
  TestimonialsHeader,
  TestimonialsTitle,
  TestimonialsSubtitle,
  TestimonialsGrid,
} from './Testimonials.styles';

// Testimonial data as defined in the design document
const defaultTestimonials = [
  {
    id: 'testimonial-1',
    quote: 'Tech Co-Founder transformed how we approach software development. The AI CTO capabilities are game-changing.',
    author: 'Sarah Chen',
    title: 'Founder, InnovateLab',
    avatar: '/avatars/sarah-chen.jpg'
  },
  {
    id: 'testimonial-2',
    quote: 'Finally, an AI partner that understands both technical requirements and business needs.',
    author: 'Marcus Rodriguez',
    title: 'CEO, StartupFlow',
    avatar: '/avatars/marcus-rodriguez.jpg'
  },
  {
    id: 'testimonial-3',
    quote: 'The spec-driven development approach saved us months of development time.',
    author: 'Emily Watson',
    title: 'Product Manager, TechVenture',
    avatar: '/avatars/emily-watson.jpg'
  }
];

const Testimonials = ({
  title = "What Our Users Say",
  subtitle = "Hear from founders and developers who've transformed their workflow with AI assistance",
  testimonials = defaultTestimonials,
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
    <TestimonialsSection
      as={motion.section}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={sectionVariants}
      className={className}
      aria-labelledby="testimonials-title"
      {...props}
    >
      <Container maxWidth="desktop" padding="large">
        <TestimonialsHeader
          as={motion.div}
          variants={headerVariants}
        >
          <TestimonialsTitle id="testimonials-title" as="h2">
            {title}
          </TestimonialsTitle>
          <TestimonialsSubtitle>
            {subtitle}
          </TestimonialsSubtitle>
        </TestimonialsHeader>

        <TestimonialsGrid
          as={motion.div}
          variants={gridVariants}
        >
          {testimonials.map((testimonial, index) => (
            <TestimonialCard
              key={testimonial.id}
              quote={testimonial.quote}
              author={testimonial.author}
              title={testimonial.title}
              avatar={testimonial.avatar}
              delay={index * 0.1}
            />
          ))}
        </TestimonialsGrid>
      </Container>
    </TestimonialsSection>
  );
};

Testimonials.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
  testimonials: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      quote: PropTypes.string.isRequired,
      author: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      avatar: PropTypes.string,
    })
  ),
  className: PropTypes.string,
};

export default Testimonials;