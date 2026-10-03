import document from '../../../docs/specs/coraid-prompts.md?raw';
import { extractPrompt } from './prompt-document.ts';

export const QUESTION_SYSTEM_PROMPT = extractPrompt(document, '## 3. CoRAID Internal AI Prompt');
export const TASK_PROPOSAL_PROMPT = extractPrompt(document, '### Internal AI Task Draft Format');
