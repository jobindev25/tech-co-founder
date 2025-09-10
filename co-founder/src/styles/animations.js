// Animation configurations and utilities
export const animations = {
  // Duration presets
  duration: {
    fast: '0.15s',
    normal: '0.3s',
    slow: '0.6s',
    slower: '0.9s',
  },

  // Easing functions
  easing: {
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },

  // Framer Motion variants
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
  },

  slideUp: {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
  },

  slideInLeft: {
    initial: { opacity: 0, x: -30 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
  },

  slideInRight: {
    initial: { opacity: 0, x: 30 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
  },

  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
  },

  stagger: {
    animate: {
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  },

  // Hover animations
  hover: {
    scale: {
      whileHover: { scale: 1.05 },
      transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
    },
    lift: {
      whileHover: { y: -2 },
      transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
    },
    glow: {
      whileHover: { boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)' },
      transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
    },
  },

  // Button animations
  button: {
    tap: { scale: 0.98 },
    hover: { scale: 1.02 },
    transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] },
  },

  // Features section animations
  features: {
    container: {
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
    },
    header: {
      hidden: { opacity: 0, y: 30 },
      visible: {
        opacity: 1,
        y: 0,
        transition: {
          duration: 0.6,
          ease: [0.4, 0, 0.2, 1],
        },
      },
    },
    grid: {
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
    },
    card: {
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
        },
      },
    },
  },

  // Hero section animations
  hero: {
    container: {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          duration: 0.8,
          ease: [0.4, 0, 0.2, 1],
          staggerChildren: 0.15,
          delayChildren: 0.2,
        },
      },
    },
    title: {
      hidden: { 
        opacity: 0, 
        y: 40,
        scale: 0.95
      },
      visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { 
          duration: 0.8, 
          ease: [0.4, 0, 0.2, 1],
          type: "spring",
          stiffness: 100,
          damping: 15
        },
      },
    },
    subtitle: {
      hidden: { 
        opacity: 0, 
        y: 30,
        filter: "blur(4px)"
      },
      visible: {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        transition: { 
          duration: 0.7, 
          ease: [0.4, 0, 0.2, 1],
          delay: 0.1
        },
      },
    },
    cta: {
      hidden: { 
        opacity: 0, 
        y: 25,
        scale: 0.9
      },
      visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { 
          duration: 0.6, 
          ease: [0.4, 0, 0.2, 1],
          type: "spring",
          stiffness: 120,
          damping: 12
        },
      },
    },
    background: {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          duration: 1.2,
          ease: [0.4, 0, 0.2, 1],
        },
      },
    },
  },
};

// CSS keyframes for styled-components
export const keyframes = {
  fadeIn: `
    from { opacity: 0; }
    to { opacity: 1; }
  `,
  slideUp: `
    from { 
      opacity: 0; 
      transform: translateY(30px); 
    }
    to { 
      opacity: 1; 
      transform: translateY(0); 
    }
  `,
  pulse: `
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  `,
  float: `
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  `,
  shimmer: `
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  `,
  glow: `
    0%, 100% { 
      box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
    }
    50% { 
      box-shadow: 0 0 30px rgba(59, 130, 246, 0.5);
    }
  `,
  breathe: `
    0%, 100% { 
      transform: scale(1);
      opacity: 0.8;
    }
    50% { 
      transform: scale(1.02);
      opacity: 1;
    }
  `,
  gradientShift: `
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  `,
};

// Utility function for reduced motion
export const respectsReducedMotion = (animation) => `
  @media (prefers-reduced-motion: reduce) {
    animation: none;
    transition: none;
  }
  ${animation}
`;
