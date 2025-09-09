import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Modal from '../common/Modal/Modal';
import {
  VideoContainer,
  VideoIframe,
  LoadingContainer,
  LoadingSpinner,
  LoadingText,
  ErrorContainer,
  ErrorMessage,
  RetryButton,
} from './TavusModal.styles';

const TavusModal = ({
  isOpen,
  onClose,
  onConversationStart,
  className,
  ...props
}) => {
  const [conversationUrl, setConversationUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const createConversation = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/tavus/create-conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Add any additional parameters needed for Tavus conversation creation
          persona_id: process.env.REACT_APP_TAVUS_PERSONA_ID,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create conversation: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.conversation_url) {
        setConversationUrl(data.conversation_url);
        if (onConversationStart) {
          onConversationStart(data);
        }
      } else {
        throw new Error('No conversation URL received from server');
      }
    } catch (err) {
      console.error('Error creating Tavus conversation:', err);
      setError(err.message || 'Failed to start conversation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    createConversation();
  };

  const handleClose = () => {
    setConversationUrl(null);
    setError(null);
    setIsLoading(false);
    onClose();
  };

  useEffect(() => {
    if (isOpen && !conversationUrl && !isLoading && !error) {
      createConversation();
    }
  }, [isOpen]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <LoadingContainer>
          <LoadingSpinner />
          <LoadingText>Starting your AI conversation...</LoadingText>
        </LoadingContainer>
      );
    }

    if (error) {
      return (
        <ErrorContainer>
          <ErrorMessage>{error}</ErrorMessage>
          <RetryButton onClick={handleRetry}>
            Try Again
          </RetryButton>
        </ErrorContainer>
      );
    }

    if (conversationUrl) {
      return (
        <VideoContainer>
          <VideoIframe
            src={conversationUrl}
            title="AI Tech Co-Founder Conversation"
            allow="camera; microphone; fullscreen"
            allowFullScreen
          />
        </VideoContainer>
      );
    }

    return null;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Meet Your AI Tech Co-Founder"
      size="fullscreen"
      className={className}
      {...props}
    >
      {renderContent()}
    </Modal>
  );
};

TavusModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConversationStart: PropTypes.func,
  className: PropTypes.string,
};

export default TavusModal;