import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [conversationId, setConversationId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const createConversation = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const isDev = import.meta.env.DEV;
      const url = isDev 
        ? 'http://localhost:3008/api/tavus/create-conversation' 
        : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-conversation`;

      const headers = {
        'Content-Type': 'application/json',
      };

      if (!isDev) {
        headers['Authorization'] = `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
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
        setConversationId(data.conversation_id);
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

  const handleClose = async () => {
    if (conversationId) {
      try {
        await fetch('http://localhost:3008/api/tavus/end-conversation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ conversation_id: conversationId }),
        });
      } catch (error) {
        console.error('Error ending conversation:', error);
      }
      navigate(`/project/${conversationId}`);
    }
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
            title="Tavus AI Conversation"
            allow="camera; microphone"
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
