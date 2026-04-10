import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { SkillCompressor } from './skill-compressor';
import type { CompressedTool } from '../types';

function makeTool(name: string, description: string, parameters?: Record<string, unknown>): CompressedTool {
  return { type: 'function', function: { name, description, parameters } };
}

describe('SkillCompressor', () => {
  describe('description compression', () => {
    it('removes filler phrases', () => {
      const compressor = new SkillCompressor({ filterByRelevance: false, minifySchemas: false });
      const tools = [
        makeTool('search', 'This function is used to search for items in the database'),
      ];
      const result = compressor.optimize(tools);
      assert.ok(!result.tools[0].function.description.includes('This function is used to'));
      assert.ok(result.tools[0].function.description.includes('search'));
    });

    it('removes multiple filler patterns', () => {
      const compressor = new SkillCompressor({ filterByRelevance: false, minifySchemas: false });
      const tools = [
        makeTool('test', 'Use this tool to basically perform a test. Please note that it is essentially a helper.'),
      ];
      const result = compressor.optimize(tools);
      const desc = result.tools[0].function.description;
      assert.ok(!desc.includes('basically'));
      assert.ok(!desc.includes('essentially'));
      assert.ok(!desc.includes('Please note that'));
    });

    it('removes trailing period from single sentence', () => {
      const compressor = new SkillCompressor({ filterByRelevance: false, minifySchemas: false });
      const tools = [makeTool('ping', 'Check server health.')];
      const result = compressor.optimize(tools);
      assert.equal(result.tools[0].function.description, 'Check server health');
    });

    it('keeps periods in multi-sentence descriptions', () => {
      const compressor = new SkillCompressor({ filterByRelevance: false, minifySchemas: false });
      const tools = [makeTool('cmd', 'First sentence. Second sentence.')];
      const result = compressor.optimize(tools);
      assert.ok(result.tools[0].function.description.includes('. '));
    });

    it('handles empty description', () => {
      const compressor = new SkillCompressor({ filterByRelevance: false, minifySchemas: false });
      const tools = [makeTool('noop', '')];
      const result = compressor.optimize(tools);
      assert.equal(result.tools[0].function.description, '');
    });
  });

  describe('relevance filtering', () => {
    it('filters tools by relevance to user message', () => {
      const compressor = new SkillCompressor({ maxTools: 2, compressDescriptions: false, minifySchemas: false });
      const tools = Array.from({ length: 20 }, (_, i) =>
        makeTool(`tool_${i}`, `Description for tool ${i}`)
      );
      tools[5] = makeTool('web_search', 'Search the web for information');
      const result = compressor.optimize(tools, 'search the web for cats');
      assert.ok(result.tools.length <= 2);
      assert.ok(result.tools.some(t => t.function.name === 'web_search'));
    });

    it('does not filter when under maxTools', () => {
      const compressor = new SkillCompressor({ maxTools: 15, compressDescriptions: false, minifySchemas: false });
      const tools = [
        makeTool('a', 'Tool A'),
        makeTool('b', 'Tool B'),
      ];
      const result = compressor.optimize(tools, 'anything');
      assert.equal(result.tools.length, 2);
    });

    it('pads with unscored tools when few are relevant', () => {
      const compressor = new SkillCompressor({ maxTools: 3, compressDescriptions: false, minifySchemas: false });
      const tools = Array.from({ length: 10 }, (_, i) =>
        makeTool(`tool_${i}`, `Generic description ${i}`)
      );
      tools[0] = makeTool('calculator', 'Calculate math expressions');
      const result = compressor.optimize(tools, 'calculate 2+2');
      assert.equal(result.tools.length, 3);
    });
  });

  describe('schema minification', () => {
    it('removes non-essential schema keys', () => {
      const compressor = new SkillCompressor({ filterByRelevance: false, compressDescriptions: false });
      const tools = [
        makeTool('test', 'desc', {
          type: 'object',
          title: 'TestSchema',
          $schema: 'http://json-schema.org/draft-07/schema',
          examples: [{ a: 1 }],
          properties: {
            name: { type: 'string', default: 'hello', description: 'The name' },
          },
        }),
      ];
      const result = compressor.optimize(tools);
      const params = result.tools[0].function.parameters!;
      assert.equal(params['title'], undefined);
      assert.equal(params['$schema'], undefined);
      assert.equal(params['examples'], undefined);
      assert.ok(params['type']);
      assert.ok(params['properties']);
    });

    it('handles tool without parameters', () => {
      const compressor = new SkillCompressor({ filterByRelevance: false, compressDescriptions: false });
      const tools = [makeTool('ping', 'Ping')];
      const result = compressor.optimize(tools);
      assert.equal(result.tools[0].function.parameters, undefined);
    });
  });

  describe('stats tracking', () => {
    it('reports saved tokens', () => {
      const compressor = new SkillCompressor({ filterByRelevance: false });
      const tools = [
        makeTool('test', 'This function is used to basically perform a very important test operation for the purpose of testing.'),
      ];
      const result = compressor.optimize(tools);
      assert.ok(result.stats.savedTokens >= 0);
      assert.ok(result.stats.originalTokens > 0);
    });

    it('tracks cumulative saved tokens', () => {
      const compressor = new SkillCompressor({ filterByRelevance: false });
      const tools = [
        makeTool('a', 'This function is used to do something basically.'),
      ];
      compressor.optimize(tools);
      compressor.optimize(tools);
      assert.ok(compressor.getTotalSavedTokens() >= 0);
    });
  });
});
