import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cardHover, fadeSlideUp } from '../utils/animations';

interface AnimatedCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: React.ReactNode;
  hover?: boolean;
  delay?: number;
  className?: string;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  hover = true,
  delay = 0,
  className = '',
  ...props
}) => {
  return (
    <motion.div
      className={className}
      variants={fadeSlideUp}
      initial="hidden"
      animate="visible"
      exit="exit"
      whileHover={hover ? "hover" : undefined}
      whileTap={hover ? "tap" : undefined}
      transition={{
        ...fadeSlideUp.visible?.transition,
        delay
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default AnimatedCard;
