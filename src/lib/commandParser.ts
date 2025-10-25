export interface Command {
  agent: string;
  content: string;
  originalInput: string;
}

export function parseCommand(input: string): Command | null {
  const trimmedInput = input.trim();
  
  // Check if input starts with @
  if (!trimmedInput.startsWith('@')) {
    return null;
  }

  // Extract agent and content
  const parts = trimmedInput.split(' ');
  const agentPart = parts[0].substring(1); // Remove @
  const content = parts.slice(1).join(' ');

  // Validate agent
  const validAgents = ['email', 'illustration', 'assistant'];
  if (!validAgents.includes(agentPart)) {
    return null;
  }

  return {
    agent: agentPart,
    content: content.trim(),
    originalInput: trimmedInput
  };
}

export function getAgentSuggestions(input: string): string[] {
  if (!input.startsWith('@')) {
    return [];
  }

  const validAgents = ['email', 'illustration', 'assistant'];
  const agentPart = input.substring(1).split(' ')[0];
  
  return validAgents.filter(agent => 
    agent.toLowerCase().startsWith(agentPart.toLowerCase())
  );
}
