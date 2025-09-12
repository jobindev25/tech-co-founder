import React, { useState } from 'react';
import { FiMessageSquare } from 'react-icons/fi';
import { 
  TestimonialCardContainer, 
  QuoteIcon, 
  QuoteText, 
  AuthorSection, 
  AuthorAvatar, 
  AuthorInfo, 
  AuthorName, 
  AuthorTitle 
} from './TestimonialCard.styles';

const TestimonialCard = ({
  quote,
  author,
  title,
  avatar,
  delay = 0,
  className,
  ...props
}) => {
  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    setImageError(true);
  };

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <TestimonialCardContainer className={className} $delay={delay} {...props}>
      <QuoteIcon>
        <FiMessageSquare size={24} role="img" aria-hidden="true" />
      </QuoteIcon>
      <QuoteText>"{quote}"</QuoteText>
      <AuthorSection>
        <AuthorAvatar $hasError={imageError}>
          {!imageError && avatar ? (
            <img
              src={avatar}
              alt={`${author} avatar`}
              onError={handleImageError}
              loading="lazy"
            />
          ) : (
            <span aria-label={`${author} initials`}>
              {getInitials(author)}
            </span>
          )}
        </AuthorAvatar>
        <AuthorInfo>
          <AuthorName>{author}</AuthorName>
          <AuthorTitle>{title}</AuthorTitle>
        </AuthorInfo>
      </AuthorSection>
    </TestimonialCardContainer>
  );
};

export default TestimonialCard;