import styled, { keyframes, css } from 'styled-components';

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

export const DashboardContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, ${props => props.theme.colors.primary}10 0%, ${props => props.theme.colors.secondary}10 100%);
  padding: 2rem 0;
`;

export const DashboardHeader = styled.div`
  text-align: center;
  margin-bottom: 3rem;
  animation: ${slideIn} 0.6s ease-out;
`;

export const ProjectTitle = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 1rem;
  
  @media (max-width: ${props => props.theme.breakpoints.tablet}) {
    font-size: 2rem;
  }
`;

export const ProjectDescription = styled.p`
  font-size: 1.2rem;
  color: ${props => props.theme.colors.text.secondary};
  max-width: 600px;
  margin: 0 auto 1rem;
  line-height: 1.6;
`;

export const ConnectionStatus = styled.div.withConfig({
  shouldForwardProp: (prop) => !['color'].includes(prop),
})`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: ${props => props.theme.colors.background.secondary};
  border-radius: 20px;
  font-size: 0.9rem;
  color: ${props => props.color || props.theme.colors.text.secondary};
  border: 1px solid ${props => props.color || props.theme.colors.border}20;
`;

export const ProgressSection = styled.div`
  margin-bottom: 3rem;
`;

export const StageList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 800px;
  margin: 0 auto;
`;

export const StageItem = styled.div.withConfig({
  shouldForwardProp: (prop) => !['status'].includes(prop),
})`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: ${props => props.theme.colors.background.primary};
  border-radius: 12px;
  border: 2px solid ${props => {
    switch (props.status) {
      case 'completed': return props.theme.colors.success;
      case 'in_progress': return props.theme.colors.primary;
      case 'failed': return props.theme.colors.error;
      default: return props.theme.colors.border;
    }
  }};
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  
  ${props => props.status === 'in_progress' && css`
    animation: ${pulse} 2s infinite;
  `}
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 15px -3px rgba(0, 0, 0, 0.1);
  }
`;

export const StageIcon = styled.div`
  font-size: 2rem;
  min-width: 3rem;
  text-align: center;
`;

export const StageContent = styled.div`
  flex: 1;
`;

export const StageName = styled.h3`
  font-size: 1.2rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 0.5rem;
`;

export const StageStatus = styled.p.withConfig({
  shouldForwardProp: (prop) => !['status'].includes(prop),
})`
  font-size: 0.9rem;
  color: ${props => {
    switch (props.status) {
      case 'completed': return props.theme.colors.success;
      case 'in_progress': return props.theme.colors.primary;
      case 'failed': return props.theme.colors.error;
      default: return props.theme.colors.text.secondary;
    }
  }};
  font-weight: 500;
  text-transform: capitalize;
`;

export const ProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background: ${props => props.theme.colors.border};
  border-radius: 4px;
  margin-top: 0.5rem;
  overflow: hidden;
`;

export const ProgressFill = styled.div.withConfig({
  shouldForwardProp: (prop) => !['progress'].includes(prop),
})`
  height: 100%;
  background: ${props => props.theme.colors.primary};
  border-radius: 4px;
  width: ${props => props.progress}%;
  transition: width 0.3s ease;
`;

export const ActivityFeed = styled.div`
  max-width: 600px;
  margin: 0 auto;
  
  h3 {
    font-size: 1.5rem;
    font-weight: 600;
    color: ${props => props.theme.colors.text.primary};
    margin-bottom: 1rem;
    text-align: center;
  }
`;

export const ActivityItem = styled.div.withConfig({
  shouldForwardProp: (prop) => !['type'].includes(prop),
})`
  display: flex;
  gap: 1rem;
  padding: 1rem;
  margin-bottom: 0.5rem;
  background: ${props => props.theme.colors.background.primary};
  border-radius: 8px;
  border-left: 4px solid ${props => {
    switch (props.type) {
      case 'success': return props.theme.colors.success;
      case 'error': return props.theme.colors.error;
      default: return props.theme.colors.primary;
    }
  }};
`;

export const ActivityTime = styled.span`
  font-size: 0.8rem;
  color: ${props => props.theme.colors.text.secondary};
  min-width: 80px;
  font-family: monospace;
`;

export const ActivityMessage = styled.span`
  font-size: 0.9rem;
  color: ${props => props.theme.colors.text.primary};
  flex: 1;
`;

export const CompletionSection = styled.div`
  text-align: center;
  padding: 3rem 0;
`;

export const DeliverableCard = styled.div`
  background: ${props => props.theme.colors.background.primary};
  border-radius: 12px;
  padding: 2rem;
  border: 2px solid ${props => props.theme.colors.success};
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
  
  &:hover {
    transform: translateY(-4px);
  }
`;

export const DeliverableTitle = styled.h3`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 0.5rem;
`;

export const DeliverableDescription = styled.p`
  font-size: 1rem;
  color: ${props => props.theme.colors.text.secondary};
  margin-bottom: 1.5rem;
  line-height: 1.5;
`;

export const DeliverableLink = styled.a`
  display: inline-block;
  padding: 0.75rem 2rem;
  background: ${props => props.theme.colors.primary};
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.3s ease;
  
  &:hover {
    background: ${props => props.theme.colors.primaryDark};
    transform: translateY(-2px);
  }
`;

export const ErrorSection = styled.div`
  background: ${props => props.theme.colors.error}10;
  border: 2px solid ${props => props.theme.colors.error};
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
  text-align: center;
`;

export const ErrorMessage = styled.h3`
  font-size: 1.3rem;
  font-weight: 600;
  color: ${props => props.theme.colors.error};
  margin-bottom: 1rem;
`;

export const ErrorDetails = styled.p`
  font-size: 1rem;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 1.5rem;
  line-height: 1.5;
`;

export const LoadingSpinner = styled.div`
  width: 40px;
  height: 40px;
  border: 4px solid ${props => props.theme.colors.border};
  border-top: 4px solid ${props => props.theme.colors.primary};
  border-radius: 50%;
  animation: ${spin} 1s linear infinite;
  margin: 0 auto 1rem;
`;
