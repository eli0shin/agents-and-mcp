import type { ResearchState, InvestigationStrategy, Finding } from './types.js';

function joinFindings(findings: Finding[]): string {
  return findings.map((finding) => finding.content).join('\n');
}

export function buildInitialSearchQueriesPrompt(state: ResearchState): string {
  return `<task>
Generate 4-6 search queries for comprehensive research on the user's question.

Create KEYWORD-BASED search queries (not full sentences) that explore different aspects and angles.
</task>

<user-question>
${state.query}
</user-question>

<examples>
<good_queries>
- "JavaScript async await performance"
- "React server components SSR in nextjs"
- "TypeScript generic constraints"
- "Python machine learning scikit-learn"
- "Docker container orchestration Kubernetes"
- "GraphQL vs REST API performance"
</good_queries>

<bad_queries>
- "How do I use async await in JavaScript?"
- "Show me examples of React server components"
- "Explain TypeScript generics to me"
- "What are the best Python libraries for machine learning?"
- "Can you help me understand Docker containers?"
</bad_queries>
</examples>

<requirements>
- Use 2-6 keywords per query
- Focus on technical terms, concepts, or specific implementations
- Avoid question words (how, what, why, when)
- Avoid conversational phrases
- Each query should target different important and relevant aspects of the topic
- Include relevant technologies, frameworks, or methodologies
</requirements>

Return ONLY valid JSON in this exact format (no explanations, no markdown, no XML tags):

{
  "queries": ["query1", "query2", "query3", ...]
}`;
}

export function buildKnowledgeGapPrompt(state: ResearchState): string {
  const findingsText = joinFindings(state.findings);

  return `Given the research query and initial findings, what key information, perspectives, or aspects are still missing? 
List up to 5 specific knowledge gaps that need to be addressed for comprehensive research.
Format as a simple list, one gap per line.

<query>
${state.query}
</query>

<initial-findings>
${findingsText}
</initial-findings>
`;
}

export function buildResearchPlanPrompt(
  state: ResearchState,
  knowledgeGaps: string[]
): string {
  const findingsText = joinFindings(state.findings);
  const gapsText = knowledgeGaps.join('\n');

  return `Based on the query, initial findings, and identified knowledge gaps, create a comprehensive research plan.

<query>
${state.query}
</query>

<initial-findings>
${findingsText}
</initial-findings>

<knowledge-gaps>
${gapsText}
</knowledge-gaps>

Create a structured research plan that addresses these gaps and provides comprehensive coverage of the topic.

Return ONLY valid JSON in this exact format (no explanations, no markdown, no XML tags):

{
  "researchQuestions": ["3-5 specific research questions to investigate"],
  "investigationStrategies": [
    {
      "question": "The research question this strategy addresses",
      "approach": "How to investigate this question",
      "expectedSources": ["Types of sources to look for"]
    }
  ],
  "synthesisStrategy": "How to combine all findings into a coherent report"
}`;
}

export function buildSpecializedQueriesPrompt(
  strategy: InvestigationStrategy
): string {
  return `<task>
Generate 2-3 specialized KEYWORD-BASED search queries to investigate this research question:

<question>
${strategy.question}
</question>

<approach>
${strategy.approach}
</approach>

<expected-sources>
${strategy.expectedSources.join(', ')}
</expected-sources>
</task>

<examples>
<good_specialized_queries>
- "React performance optimization techniques"
- "Node.js memory leaks debugging tools"
- "PostgreSQL indexing best practices performance"
- "Kubernetes security vulnerabilities CVE"
- "Python async concurrent programming patterns"
</good_specialized_queries>

<bad_specialized_queries>
- "How can I optimize React performance?"
- "What tools help debug Node.js memory leaks?"
- "Show me the best practices for PostgreSQL indexing"
- "Are there security issues with Kubernetes?"
- "Explain Python async programming to me"
</bad_specialized_queries>
</examples>

<requirements>
- Use 2-6 targeted keywords per query
- Focus on technical terms, methodologies, or specific tools
- Avoid question words (how, what, why, when, are, is)
- Avoid conversational phrases
- Include relevant technologies from expectedSources when applicable
- Target authoritative sources like documentation, research papers, or expert analysis
</requirements>

Return ONLY valid JSON in this exact format (no explanations, no markdown, no XML tags):

{
  "queries": ["query1", "query2", "query3"]
}`;
}

export function buildContentRelevancePrompt(
  state: ResearchState,
  params: {
    researchQuestion: string;
    searchQuery: string;
    content: string;
  }
): string {
  return `Determine if this content is strictly relevant to provide an answer to the research inquiry.

<original_query>
${state.query}
</original_query>

<research_question>
${params.researchQuestion}
</research_question>

<search_query>
${params.searchQuery}
</search_query>

<content>
${params.content}
</content>

Return true only if the content contains information that could help answer the research question or original query. Be strict - marketing content, irrelevant articles, artictles about a different but similar topic, or tangential information should be marked as false.`;
}

export function buildContentExtractionPrompt(content: string): string {
  return `Extract the main content body from this page, removing any navigation, headers, footers, sidebars, advertisements, or other page decorations. Keep all substantive content intact - do not summarize or shorten it. Return the complete main article/page content in its entirety.

<content>
${content}
</content>

Return only the main content body, preserving all substantial information and details.`;
}

export function buildResearchSynthesisPrompt(state: ResearchState): string {
  const findingsText = state.findings
    .map((finding) => finding.content)
    .join('\n</finding>\n<finding>\n');
  const synthesisStrategy = state.researchPlan?.synthesisStrategy ?? '';

  return `Synthesize comprehensive research findings for the query following the synthesis strategy.

<query>
${state.query}
</query>

<findings>
<finding>
${findingsText}
</finding>
</findings>

<synthesis-strategy>
${synthesisStrategy}
</synthesis-strategy>


Create a thorough synthesis that:
1. Provides a clear executive summary
2. Presents detailed findings organized logically
3. Identifies key insights and patterns
4. Draws evidence-based conclusions

Focus on accuracy, coherence, and comprehensive coverage of the topic.

Return ONLY valid JSON in this exact format (no explanations, no markdown, no XML tags):

{
  "summary": "Executive summary of key findings (2-3 paragraphs)",
  "content": "Detailed findings and analysis (comprehensive, well-organized)",
  "keyInsights": ["3-5 most important insights discovered"],
  "conclusions": ["Evidence-based conclusions drawn from the research"]
}`;
}
