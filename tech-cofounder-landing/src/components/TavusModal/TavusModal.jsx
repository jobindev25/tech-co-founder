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
      // For local development, use mock data
      if (import.meta.env.DEV) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const mockData = {
          conversation_url: 'https://demo.tavus.io/conversation/demo-tech-cofounder',
          conversation_id: 'demo-conversation-id'
        };
        
        setConversationUrl(mockData.conversation_url);
        if (onConversationStart) {
          onConversationStart(mockData);
        }
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          conversation_name: `Tech Co-Founder Session ${Date.now()}`,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Failed to create conversation: ${response.statusText}`;
        
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // Use default error message
        }
        
        throw new Error(errorMessage);
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
      // Open Tavus in a new window instead of iframe due to X-Frame-Options
      window.open(conversationUrl, '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
      handleClose();
      return (
        <VideoContainer>
          <LoadingText>Opening AI conversation in new window...</LoadingText>
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