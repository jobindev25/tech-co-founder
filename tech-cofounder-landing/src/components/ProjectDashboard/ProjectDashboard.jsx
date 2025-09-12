import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import Container from '../common/Container/Container';
import Button from '../common/Button/Button';
import {
  DashboardContainer,
  DashboardHeader,
  ProjectTitle,
  ProjectDescription,
  ProgressSection,
  StageList,
  StageItem,
  StageIcon,
  StageContent,
  StageName,
  StageStatus,
  ProgressBar,
  ProgressFill,
  ActivityFeed,
  ActivityItem,
  ActivityTime,
  ActivityMessage,
  CompletionSection,
  DeliverableCard,
  DeliverableTitle,
  DeliverableDescription,
  DeliverableLink,
  ErrorSection,
  ErrorMessage,
  ErrorDetails,
  ConnectionStatus,
  LoadingSpinner
} from './ProjectDashboard.styles';

const PIPELINE_STAGES = [
  { id: 'analysis', name: 'Conversation Analysis', description: 'Analyzing your conversation and extracting requirements' },
  { id: 'planning', name: 'Project Plan Generation', description: 'Creating detailed technical specifications and architecture' },
  { id: 'trigger', name: 'Kiro Build Trigger', description: 'Initiating automated development process' },
  { id: 'building', name: 'Build in Progress', description: 'Generating code and deploying your application' },
  { id: 'complete', name: 'Build Complete', description: 'Your application is ready!' }
];

const ProjectDashboard = () => {
  const { conversationId } = useParams();
  const [projectData, setProjectData] = useState(null);
  const [stages, setStages] = useState({});
  const [activities, setActivities] = useState([]);
  const [wsConnection, setWsConnection] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deliverables, setDeliverables] = useState(null);

  // Initialize stages
  useEffect(() => {
    const initialStages = {};
    PIPELINE_STAGES.forEach(stage => {
      initialStages[stage.id] = {
        status: 'pending',
        progress: 0,
        message: '',
        timestamp: null
      };
    });
    // Set first stage as in progress
    initialStages.analysis.status = 'in_progress';
    setStages(initialStages);
  }, []);

  // Fetch initial project data
  useEffect(() => {
    const fetchProjectData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-project-data?conversation_id=${conversationId}`, {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch project data: ${response.statusText}`);
        }

        const data = await response.json();
        setProjectData(data);
        
        // Add initial activity
        setActivities([{
          id: Date.now(),
          timestamp: new Date().toISOString(),
          message: 'Project dashboard initialized',
          type: 'info'
        }]);

      } catch (err) {
        console.error('Error fetching project data:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (conversationId) {
      fetchProjectData();
    }
  }, [conversationId]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 3;
    
    const connectWebSocket = () => {
      
      try {
        setConnectionStatus('connecting');
        // For development, we'll use a mock WebSocket or skip WebSocket connection
        if (!import.meta.env.VITE_SUPABASE_URL) {
          console.warn('VITE_SUPABASE_URL not configured, skipping WebSocket connection');
          return null;
        }
        
        const wsUrl = `${import.meta.env.VITE_SUPABASE_URL.replace('https://', 'wss://').replace('http://', 'ws://')}/functions/v1/websocket-manager?conversation_id=${conversationId}&user_id=user_${conversationId}&token=temp_token`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('Project WebSocket connected');
          setConnectionStatus('connected');
          setWsConnection(ws);
          reconnectAttempts = 0; // Reset on successful connection
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('Project update received:', message);
            handleWebSocketMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onclose = () => {
          console.log('Project WebSocket disconnected');
          setConnectionStatus('disconnected');
          setWsConnection(null);
          
          // Only attempt to reconnect if we haven't exceeded max attempts
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            console.log(`Attempting to reconnect project WebSocket (${reconnectAttempts}/${maxReconnectAttempts})`);
            setTimeout(connectWebSocket, 3000 * reconnectAttempts);
          } else {
            setConnectionStatus('error');
          }
        };

        ws.onerror = (error) => {
          console.warn('Project WebSocket connection failed:', error.type);
          setConnectionStatus('error');
        };

        return ws;
      } catch (error) {
        console.error('Failed to connect project WebSocket:', error);
        setConnectionStatus('error');
        return null;
      }
    };

    if (conversationId) {
      const ws = connectWebSocket();
      return () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    }
  }, [conversationId]);

  // Handle WebSocket messages
  const handleWebSocketMessage = (message) => {
    const { event_type, data } = message;
    const timestamp = new Date().toISOString();

    // Add activity
    const newActivity = {
      id: Date.now() + Math.random(),
      timestamp,
      message: getActivityMessage(event_type, data),
      type: getActivityType(event_type)
    };
    setActivities(prev => [newActivity, ...prev].slice(0, 50)); // Keep last 50 activities

    // Update stages based on event type
    setStages(prev => {
      const updated = { ...prev };
      
      switch (event_type) {
        case 'analysis_started':
          updated.analysis = { ...updated.analysis, status: 'in_progress', timestamp };
          break;
        case 'analysis_completed':
          updated.analysis = { ...updated.analysis, status: 'completed', timestamp };
          updated.planning = { ...updated.planning, status: 'in_progress' };
          break;
        case 'plan_generation_started':
          updated.planning = { ...updated.planning, status: 'in_progress', timestamp };
          break;
        case 'plan_generation_completed':
          updated.planning = { ...updated.planning, status: 'completed', timestamp };
          updated.trigger = { ...updated.trigger, status: 'in_progress' };
          break;
        case 'build_trigger_started':
          updated.trigger = { ...updated.trigger, status: 'in_progress', timestamp };
          break;
        case 'build_triggered':
          updated.trigger = { ...updated.trigger, status: 'completed', timestamp };
          updated.building = { ...updated.building, status: 'in_progress' };
          break;
        case 'build_started':
          updated.building = { ...updated.building, status: 'in_progress', timestamp };
          break;
        case 'build_progress':
          updated.building = { 
            ...updated.building, 
            status: 'in_progress', 
            progress: data?.progress || 0,
            message: data?.message || 'Building...',
            timestamp 
          };
          break;
        case 'build_completed':
          updated.building = { ...updated.building, status: 'completed', timestamp };
          updated.complete = { ...updated.complete, status: 'completed', timestamp };
          setDeliverables(data?.deliverables || {
            app_url: data?.app_url,
            source_code_url: data?.source_code_url,
            project_summary: data?.project_summary
          });
          break;
        case 'build_failed':
          updated.building = { 
            ...updated.building, 
            status: 'failed', 
            message: data?.error || 'Build failed',
            timestamp 
          };
          setError(data?.error || 'Build failed. Please try again.');
          break;
        default:
          console.log('Unknown event type:', event_type);
      }
      
      return updated;
    });
  };

  const getActivityMessage = (eventType, data) => {
    switch (eventType) {
      case 'analysis_started': return 'Started analyzing your conversation...';
      case 'analysis_completed': return 'Conversation analysis completed successfully';
      case 'plan_generation_started': return 'Generating your project plan...';
      case 'plan_generation_completed': return 'Project plan generated successfully';
      case 'build_trigger_started': return 'Initiating build process...';
      case 'build_triggered': return `Build triggered with ID: ${data?.build_id}`;
      case 'build_started': return 'Build process started';
      case 'build_progress': return data?.message || `Build progress: ${data?.progress || 0}%`;
      case 'file_generated': return `Generated: ${data?.filename}`;
      case 'build_completed': return 'Build completed successfully! 🎉';
      case 'build_failed': return `Build failed: ${data?.error}`;
      default: return `Event: ${eventType}`;
    }
  };

  const getActivityType = (eventType) => {
    if (eventType.includes('failed') || eventType.includes('error')) return 'error';
    if (eventType.includes('completed') || eventType.includes('success')) return 'success';
    return 'info';
  };

  const getStageIcon = (stage, stageData) => {
    switch (stageData.status) {
      case 'completed':
        return '✅';
      case 'in_progress':
        return '🔄';
      case 'failed':
        return '❌';
      default:
        return '⏳';
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#10b981';
      case 'connecting': return '#f59e0b';
      case 'disconnected': return '#ef4444';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const handleRetryBuild = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/retry-build`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conversation_id: conversationId })
      });

      if (!response.ok) {
        throw new Error('Failed to retry build');
      }

      setError(null);
      // Reset stages to retry
      setStages(prev => ({
        ...prev,
        building: { ...prev.building, status: 'in_progress', message: 'Retrying build...' }
      }));
    } catch (err) {
      console.error('Error retrying build:', err);
    }
  };

  if (isLoading) {
    return (
      <DashboardContainer>
        <Container>
          <DashboardHeader>
            <LoadingSpinner />
            <ProjectTitle>Loading your project...</ProjectTitle>
          </DashboardHeader>
        </Container>
      </DashboardContainer>
    );
  }

  const isCompleted = stages.complete?.status === 'completed';
  const hasFailed = Object.values(stages).some(stage => stage.status === 'failed');

  return (
    <DashboardContainer>
      <Container>
        <DashboardHeader>
          <ProjectTitle>
            {projectData?.project_name || `Project ${conversationId}`}
          </ProjectTitle>
          <ProjectDescription>
            {projectData?.project_description || 'Your AI-generated application is being built...'}
          </ProjectDescription>
          <ConnectionStatus color={getConnectionStatusColor()}>
            {connectionStatus === 'connected' && '🟢 Connected'}
            {connectionStatus === 'connecting' && '🟡 Connecting...'}
            {connectionStatus === 'disconnected' && '🔴 Disconnected'}
            {connectionStatus === 'error' && '🔴 Connection Error'}
          </ConnectionStatus>
        </DashboardHeader>

        {error && !isCompleted && (
          <ErrorSection>
            <ErrorMessage>⚠️ Build Error</ErrorMessage>
            <ErrorDetails>{error}</ErrorDetails>
            <Button variant="primary" onClick={handleRetryBuild}>
              Retry Build
            </Button>
          </ErrorSection>
        )}

        {isCompleted ? (
          <CompletionSection>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <ProjectTitle>🎉 Your Project is Ready!</ProjectTitle>
              
              {deliverables && (
                <div style={{ display: 'grid', gap: '1rem', marginTop: '2rem' }}>
                  {deliverables.app_url && (
                    <DeliverableCard>
                      <DeliverableTitle>🚀 Live Application</DeliverableTitle>
                      <DeliverableDescription>
                        Your application is deployed and ready to use
                      </DeliverableDescription>
                      <DeliverableLink 
                        href={deliverables.app_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        View Your App
                      </DeliverableLink>
                    </DeliverableCard>
                  )}
                  
                  {deliverables.source_code_url && (
                    <DeliverableCard>
                      <DeliverableTitle>📁 Source Code</DeliverableTitle>
                      <DeliverableDescription>
                        Access the complete source code of your project
                      </DeliverableDescription>
                      <DeliverableLink 
                        href={deliverables.source_code_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        View Source Code
                      </DeliverableLink>
                    </DeliverableCard>
                  )}
                </div>
              )}
            </motion.div>
          </CompletionSection>
        ) : (
          <ProgressSection>
            <StageList>
              {PIPELINE_STAGES.map((stage, index) => {
                const stageData = stages[stage.id] || { status: 'pending', progress: 0 };
                return (
                  <StageItem key={stage.id} status={stageData.status}>
                    <StageIcon>{getStageIcon(stage, stageData)}</StageIcon>
                    <StageContent>
                      <StageName>{stage.name}</StageName>
                      <StageStatus status={stageData.status}>
                        {stageData.status === 'in_progress' && stageData.message 
                          ? stageData.message 
                          : stageData.status.replace('_', ' ').toUpperCase()}
                      </StageStatus>
                      {stageData.status === 'in_progress' && stageData.progress > 0 && (
                        <ProgressBar>
                          <ProgressFill progress={stageData.progress} />
                        </ProgressBar>
                      )}
                    </StageContent>
                  </StageItem>
                );
              })}
            </StageList>
          </ProgressSection>
        )}

        <ActivityFeed>
          <h3>Activity Feed</h3>
          <AnimatePresence>
            {activities.map((activity) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <ActivityItem type={activity.type}>
                  <ActivityTime>
                    {new Date(activity.timestamp).toLocaleTimeString()}
                  </ActivityTime>
                  <ActivityMessage>{activity.message}</ActivityMessage>
                </ActivityItem>
              </motion.div>
            ))}
          </AnimatePresence>
        </ActivityFeed>
      </Container>
    </DashboardContainer>
  );
};

ProjectDashboard.propTypes = {
  // No props needed as we use useParams
};

export default ProjectDashboard;
