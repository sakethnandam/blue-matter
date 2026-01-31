import * as vscode from 'vscode';

export function getYoutubeApiKey(): string {
  const fromEnv = process.env.UNTITLED_YOUTUBE_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  return vscode.workspace.getConfiguration('untitled').get<string>('youtubeApiKey') ?? '';
}

export function getLlmApiKey(): string {
  const fromEnv = process.env.UNTITLED_LLM_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  return vscode.workspace.getConfiguration('untitled').get<string>('llmApiKey') ?? '';
}

export type LLMProvider = 'openai' | 'anthropic' | 'openrouter';

export function getLlmProvider(): LLMProvider {
  const fromEnv = process.env.UNTITLED_LLM_PROVIDER?.trim().toLowerCase();
  if (fromEnv === 'openai' || fromEnv === 'anthropic' || fromEnv === 'openrouter') return fromEnv;
  const fromSettings = vscode.workspace.getConfiguration('untitled').get<string>('llmProvider') ?? 'openai';
  if (fromSettings === 'anthropic') return 'anthropic';
  if (fromSettings === 'openrouter') return 'openrouter';
  return 'openai';
}

export function getOpenRouterModel(): string {
  const fromEnv = process.env.UNTITLED_OPENROUTER_MODEL?.trim();
  if (fromEnv) return fromEnv;
  return vscode.workspace.getConfiguration('untitled').get<string>('openRouterModel') ?? 'google/gemma-3-4b-it:free';
}
