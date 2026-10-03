import type { IncomingMessage, ServerResponse } from 'node:http';

export declare function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean>;

export declare const MODEL: string;