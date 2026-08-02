// src/utils/tokenCalculator.ts
export function estimateTokens(text: string): number {
  // More accurate for code - code is denser than prose
  // Average token: ~4 chars for code, but with symbols it's ~3.5
  return Math.ceil(text.length / 3.5);
}

export function estimateOutputTokens(
  results: any[],
  mode: 'compact' | 'full'
): number {
  let total = 0;
  
  for (const result of results) {
    // AST summary ~ 200 tokens per file
    total += 200;
    
    // Functions list
    total += (result.functions || []).length * 20;
    
    // Classes list
    total += (result.classes || []).length * 20;
    
    // Chunks
    for (const chunk of (result.chunks || [])) {
      total += estimateTokens(chunk.content || '');
      total += 20; // Metadata overhead
    }
    
    // Source code in full mode
    if (mode === 'full' && result.fileContent) {
      total += estimateTokens(result.fileContent);
    }
  }
  
  return total;
}