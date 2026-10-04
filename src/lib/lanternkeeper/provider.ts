import 'server-only';

import { serverEnv } from '@/lib/env.server';
import type { BriefingFact, BriefingView } from './briefing';
import { modelFacts } from './model-context';
import {
  buildProviderBody,
  parseProviderOutput,
  type ParsedProviderOutput,
} from './provider-contract';

export type ProviderResult = ParsedProviderOutput & {
  provider: string;
  model: string;
};

export interface LanternkeeperProvider {
  readonly name: string;
  readonly model: string;
  summarize(view: BriefingView, facts: BriefingFact[]): Promise<ProviderResult>;
}

class OpenAIProvider implements LanternkeeperProvider {
  readonly name = 'openai';
  readonly model = serverEnv.OPENAI_MODEL;

  async summarize(view: BriefingView, facts: BriefingFact[]): Promise<ProviderResult> {
    const safeFacts = modelFacts(facts);
    const ids = new Set(safeFacts.map((fact) => fact.id));
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serverEnv.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify(buildProviderBody(this.model, view, safeFacts)),
    });
    if (!response.ok) throw new Error('Provider unavailable');
    return {
      ...parseProviderOutput(await response.json(), ids),
      provider: this.name,
      model: this.model,
    };
  }
}

export function getLanternkeeperProvider(): LanternkeeperProvider | null {
  return serverEnv.OPENAI_API_KEY ? new OpenAIProvider() : null;
}
