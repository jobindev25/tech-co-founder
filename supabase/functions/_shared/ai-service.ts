// AI integration service for conversation analysis and project plan generation

import { 
  ConversationAnalysis, 
  ProjectPlan, 
  AIAnalysisError,
  Feature,
  Component,
  Phase
} from './types.ts';
import { Logger, retryWithBackoff, rateLimiters } from './utils.ts';

// OpenAI API integration
export class OpenAIService {
  private apiKey: string;
  private baseUrl = 'https://api.openai.com/v1';
  private logger: Logger;

  constructor() {
    this.apiKey = Deno.env.get('OPENAI_API_KEY') || '';
    this.logger = new Logger('OpenAIService');
    
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
  }

  private async makeRequest(endpoint: string, body: any): Promise<any> {
    // Check rate limit
    if (!rateLimiters.openai.isAllowed('default')) {
      throw new AIAnalysisError('OpenAI rate limit exceeded');
    }

    const startTime = performance.now();
    
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const responseTime = performance.now() - startTime;
      this.logger.debug('OpenAI API request completed', { 
        endpoint, 
        status: response.status, 
        responseTime: `${responseTime.toFixed(2)}ms` 
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new AIAnalysisError(
          `OpenAI API error: ${response.statusText}`,
          { status: response.status, error: errorData }
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof AIAnalysisError) throw error;
      throw new AIAnalysisError(`OpenAI request failed: ${error.message}`);
    }
  }

  async analyzeConversation(transcript: string, summary?: string): Promise<ConversationAnalysis> {
    const prompt = this.createAnalysisPrompt(transcript, summary);
    
    try {
      const response = await retryWithBackoff(async () => {
        return this.makeRequest('/chat/completions', {
          model: 'gpt-4-1106-preview',
          messages: [
            {
              role: 'system',
              content: 'You are an expert business analyst and technical architect. Analyze conversations to extract project requirements and technical specifications. Always respond with valid JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 2000
        });
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      return this.validateAnalysis(analysis);
    } catch (error) {
      this.logger.error('Conversation analysis failed', error);
      throw new AIAnalysisError(`Failed to analyze conversation: ${error.message}`);
    }
  }

  async generateProjectPlan(analysis: ConversationAnalysis): Promise<ProjectPlan> {
    const prompt = this.createPlanGenerationPrompt(analysis);
    
    try {
      const response = await retryWithBackoff(async () => {
        return this.makeRequest('/chat/completions', {
          model: 'gpt-4-1106-preview',
          messages: [
            {
              role: 'system',
              content: 'You are an expert software architect and project manager. Generate comprehensive, actionable project plans that can be consumed by development APIs. Always respond with valid JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_tokens: 4000
        });
      });

      const plan = JSON.parse(response.choices[0].message.content);
      return this.validateProjectPlan(plan);
    } catch (error) {
      this.logger.error('Project plan generation failed', error);
      throw new AIAnalysisError(`Failed to generate project plan: ${error.message}`);
    }
  }

  private createAnalysisPrompt(transcript: string, summary?: string): string {
    return `
Analyze this conversation transcript and extract structured project information:

TRANSCRIPT:
${transcript}

${summary ? `SUMMARY: ${summary}` : ''}

Extract and return a JSON object with the following structure:
{
  "projectName": "Clear, concise project name",
  "description": "Detailed project description (2-3 sentences)",
  "summary": "Executive summary of the conversation",
  "requirements": ["List of specific functional requirements"],
  "features": ["List of key features to implement"],
  "preferences": {
    "techStack": ["Preferred technologies mentioned"],
    "timeline": "Timeline mentioned or estimated",
    "budget": "Budget constraints if mentioned",
    "complexity": "simple|medium|complex"
  },
  "extractedEntities": {
    "technologies": ["All technologies mentioned"],
    "integrations": ["Third-party services to integrate"],
    "platforms": ["Target platforms (web, mobile, etc.)"]
  }
}

Focus on:
1. Explicit requirements and features mentioned
2. Technical preferences and constraints
3. Business goals and success criteria
4. Timeline and resource constraints
5. Integration requirements

Be specific and actionable. If information is unclear, make reasonable assumptions based on context.
`;
  }

  private createPlanGenerationPrompt(analysis: ConversationAnalysis): string {
    return `
Generate a comprehensive project plan based on this analysis:

PROJECT ANALYSIS:
${JSON.stringify(analysis, null, 2)}

Create a detailed project plan with the following JSON structure:
{
  "name": "${analysis.projectName}",
  "description": "${analysis.description}",
  "techStack": {
    "frontend": ["Primary frontend technologies"],
    "backend": ["Backend technologies and frameworks"],
    "database": "Database technology",
    "deployment": "Deployment platform"
  },
  "features": [
    {
      "id": "unique-feature-id",
      "name": "Feature name",
      "description": "Detailed feature description",
      "priority": "high|medium|low",
      "complexity": 1-10,
      "dependencies": ["other-feature-ids"],
      "acceptanceCriteria": ["Specific acceptance criteria"]
    }
  ],
  "architecture": {
    "type": "monolith|microservices|serverless",
    "components": [
      {
        "name": "Component name",
        "type": "frontend|backend|database|service",
        "description": "Component description",
        "technologies": ["Technologies used"],
        "dependencies": ["Other component names"]
      }
    ]
  },
  "timeline": {
    "estimated_hours": 120,
    "phases": [
      {
        "name": "Phase name",
        "description": "Phase description",
        "estimated_hours": 40,
        "tasks": ["Specific tasks"],
        "dependencies": ["Previous phase names"]
      }
    ]
  },
  "fileStructure": [
    {
      "name": "src",
      "type": "directory",
      "path": "/src",
      "children": [
        {
          "name": "components",
          "type": "directory",
          "path": "/src/components"
        }
      ]
    }
  ],
  "dependencies": [
    {
      "name": "react",
      "version": "^18.0.0",
      "type": "runtime",
      "description": "React framework"
    }
  ],
  "kiroConfig": {
    "projectType": "web-application",
    "buildSettings": {
      "framework": "react",
      "bundler": "vite"
    },
    "deploymentSettings": {
      "platform": "vercel",
      "environment": "production"
    },
    "webhookSettings": {
      "url": "webhook_url_placeholder",
      "events": ["build_started", "build_progress", "build_completed", "build_failed"]
    }
  }
}

Guidelines:
1. Choose modern, production-ready technologies
2. Break features into manageable, testable units
3. Ensure proper dependency ordering
4. Include realistic time estimates
5. Create a logical file structure
6. Specify exact dependency versions
7. Configure for automated deployment

Base technology recommendations on the analysis preferences, but use best practices for:
- React/Next.js for frontend (if web application)
- Node.js/Express or Python/FastAPI for backend
- PostgreSQL or MongoDB for database
- Vercel/Netlify for frontend deployment
- Railway/Render for backend deployment
`;
  }

  private validateAnalysis(analysis: any): ConversationAnalysis {
    const required = ['projectName', 'description', 'requirements', 'features'];
    
    for (const field of required) {
      if (!analysis[field]) {
        throw new AIAnalysisError(`Missing required field in analysis: ${field}`);
      }
    }

    if (!Array.isArray(analysis.requirements) || analysis.requirements.length === 0) {
      throw new AIAnalysisError('Requirements must be a non-empty array');
    }

    if (!Array.isArray(analysis.features) || analysis.features.length === 0) {
      throw new AIAnalysisError('Features must be a non-empty array');
    }

    return analysis as ConversationAnalysis;
  }

  private validateProjectPlan(plan: any): ProjectPlan {
    const required = ['name', 'description', 'techStack', 'features', 'architecture'];
    
    for (const field of required) {
      if (!plan[field]) {
        throw new AIAnalysisError(`Missing required field in project plan: ${field}`);
      }
    }

    // Validate tech stack
    const techStackRequired = ['frontend', 'backend', 'database'];
    for (const field of techStackRequired) {
      if (!plan.techStack[field]) {
        throw new AIAnalysisError(`Missing tech stack field: ${field}`);
      }
    }

    // Validate features
    if (!Array.isArray(plan.features) || plan.features.length === 0) {
      throw new AIAnalysisError('Features must be a non-empty array');
    }

    for (const feature of plan.features) {
      if (!feature.id || !feature.name || !feature.description) {
        throw new AIAnalysisError('Each feature must have id, name, and description');
      }
    }

    return plan as ProjectPlan;
  }
}

// Claude API integration (alternative to OpenAI)
export class ClaudeService {
  private apiKey: string;
  private baseUrl = 'https://api.anthropic.com/v1';
  private logger: Logger;

  constructor() {
    this.apiKey = Deno.env.get('CLAUDE_API_KEY') || '';
    this.logger = new Logger('ClaudeService');
    
    if (!this.apiKey) {
      throw new Error('CLAUDE_API_KEY environment variable is required');
    }
  }

  async analyzeConversation(transcript: string, summary?: string): Promise<ConversationAnalysis> {
    // Similar implementation to OpenAI but using Claude's API
    // This would be implemented if Claude is preferred over OpenAI
    throw new Error('Claude integration not yet implemented');
  }

  async generateProjectPlan(analysis: ConversationAnalysis): Promise<ProjectPlan> {
    // Similar implementation to OpenAI but using Claude's API
    throw new Error('Claude integration not yet implemented');
  }
}

// AI service factory
export class AIService {
  private openai: OpenAIService;
  private claude?: ClaudeService;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('AIService');
    
    try {
      this.openai = new OpenAIService();
    } catch (error) {
      this.logger.warn('OpenAI service not available', error);
    }

    try {
      this.claude = new ClaudeService();
    } catch (error) {
      this.logger.warn('Claude service not available', error);
    }

    if (!this.openai && !this.claude) {
      throw new Error('No AI service available. Configure OPENAI_API_KEY or CLAUDE_API_KEY');
    }
  }

  async analyzeConversation(transcript: string, summary?: string): Promise<ConversationAnalysis> {
    // Try OpenAI first, fallback to Claude
    if (this.openai) {
      try {
        return await this.openai.analyzeConversation(transcript, summary);
      } catch (error) {
        this.logger.warn('OpenAI analysis failed, trying Claude', error);
      }
    }

    if (this.claude) {
      return await this.claude.analyzeConversation(transcript, summary);
    }

    throw new AIAnalysisError('No AI service available for conversation analysis');
  }

  async generateProjectPlan(analysis: ConversationAnalysis): Promise<ProjectPlan> {
    // Try OpenAI first, fallback to Claude
    if (this.openai) {
      try {
        return await this.openai.generateProjectPlan(analysis);
      } catch (error) {
        this.logger.warn('OpenAI plan generation failed, trying Claude', error);
      }
    }

    if (this.claude) {
      return await this.claude.generateProjectPlan(analysis);
    }

    throw new AIAnalysisError('No AI service available for project plan generation');
  }
}

// Export singleton instance
export const aiService = new AIService();