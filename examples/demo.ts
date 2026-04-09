/**
 * TokenWise Demo — SDK mode
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... npx ts-node examples/demo.ts
 *   or after build:
 *   OPENAI_API_KEY=sk-... node dist/examples/demo.js
 */

import { TokenWise } from '../src/index';

async function main() {
  const tw = new TokenWise({
    apiKey: process.env.OPENAI_API_KEY || '',
    verbose: true,
  });

  console.log('\n🧪 Test 1: Simple question (should route to cheaper model)\n');
  const res1 = await tw.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are a helpful assistant. Answer concisely.' },
      { role: 'user', content: 'What is 2+2?' },
    ],
  });
  console.log('Response:', res1.choices[0].message.content);
  console.log('Model used:', res1.model);

  console.log('\n🧪 Test 2: With tools (should compress tool descriptions)\n');
  const res2 = await tw.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are a helpful assistant that can search the web and send emails.' },
      { role: 'user', content: 'Search for the weather in Seoul' },
    ],
    tools: [
      {
        type: 'function' as const,
        function: {
          name: 'web_search',
          description: 'This function is used to search the web for information. It allows you to find relevant results from across the internet. Use this tool to look up current events, facts, or any information that might be available online.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'The search query to look up on the web', examples: ['weather in Seoul', 'latest news'] },
              max_results: { type: 'number', description: 'Maximum number of results to return', default: 5 },
            },
            required: ['query'],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'send_email',
          description: 'This function is used to send an email message to a recipient. It allows you to compose and send emails with a subject and body. Please note that this tool requires a valid email address.',
          parameters: {
            type: 'object',
            properties: {
              to: { type: 'string', description: 'The email address of the recipient' },
              subject: { type: 'string', description: 'The subject line of the email' },
              body: { type: 'string', description: 'The body content of the email message' },
            },
            required: ['to', 'subject', 'body'],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'calculator',
          description: 'This is a calculator tool that can be used to perform basic mathematical calculations. It essentially evaluates mathematical expressions and returns the result.',
          parameters: {
            type: 'object',
            properties: {
              expression: { type: 'string', description: 'The mathematical expression to evaluate' },
            },
            required: ['expression'],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'read_file',
          description: 'This function allows you to read the contents of a file from the filesystem. Use this tool to access file data. It is important to note that the file must exist at the specified path.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'The file path to read from' },
            },
            required: ['path'],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'write_file',
          description: 'This function is used to write content to a file on the filesystem. It allows you to create new files or overwrite existing ones with the specified content.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'The file path to write to' },
              content: { type: 'string', description: 'The content to write to the file' },
            },
            required: ['path', 'content'],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: 'auto',
  });
  console.log('Response:', JSON.stringify(res2.choices[0].message, null, 2));
  console.log('Model used:', res2.model);

  console.log('\n🧪 Test 3: Complex reasoning (should keep expensive model)\n');
  const res3 = await tw.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are an expert software architect.' },
      { role: 'user', content: 'Analyze and compare microservices vs monolith architecture. Consider scalability, team structure, deployment complexity, and debugging difficulty. Then recommend which approach is better for a startup with 3 engineers building a B2B SaaS product.' },
    ],
  });
  console.log('Response:', res3.choices[0].message.content?.substring(0, 200) + '...');
  console.log('Model used:', res3.model);

  // Print final savings report
  console.log('\n' + tw.printSavings());
}

main().catch(console.error);
