import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from 'ai';
import { createQuestionSession, type QuestionMessage } from './question-branch.ts';
import { createId } from './id.ts';

// Local demo default. Live mode must also supply a key at runtime, never in a bundle.
export const QUESTION_BRANCH_MOCK = true;

export function createBranchChatSession(options: {
  branchId: string;
  mainContext: string;
  branchContext: string;
  messages: UIMessage[];
  mock?: boolean;
  apiKey?: string;
}) {
  const transcript: QuestionMessage[] = options.messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role as QuestionMessage['role'],
      content: message.parts
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('\n'),
    }));
  return createQuestionSession({
    mock: options.mock ?? QUESTION_BRANCH_MOCK,
    apiKey: options.apiKey,
    initialState: {
      mainContext: options.mainContext,
      branches: {
        [options.branchId]: {
          id: options.branchId,
          mainContext: options.branchContext,
          messages: transcript,
          revision: transcript.length,
        },
      },
      previews: {},
    },
  });
}

/** Implements the AI SDK transport protocol locally; no request reaches /api/chat. */
export async function branchChatResponse(options: {
  branchId: string;
  mainContext: string;
  branchContext: string;
  messages: UIMessage[];
  signal?: AbortSignal;
  mock?: boolean;
  apiKey?: string;
}): Promise<Response> {
  const question = options.messages.at(-1);
  if (!question || question.role !== 'user' || question.parts.some((part) => part.type !== 'text')) {
    throw new Error('Question Branch supports text questions only');
  }
  const session = createBranchChatSession({ ...options, messages: options.messages.slice(0, -1) });
  const answer = await session.sendMessage(
    options.branchId,
    question.parts.filter((part) => part.type === 'text').map((part) => part.text).join('\n'),
    options.signal,
  );
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: ({ writer }) => {
        const id = createId();
        writer.write({ type: 'start', messageId: createId() });
        writer.write({ type: 'text-start', id });
        writer.write({ type: 'text-delta', id, delta: answer.content });
        writer.write({ type: 'text-end', id });
        writer.write({ type: 'finish', finishReason: 'stop' });
      },
    }),
  });
}
