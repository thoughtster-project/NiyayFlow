export interface SentenceDiff {
  id: string;
  original: string;
  polished: string;
  isChanged: boolean;
  status: 'pending' | 'accepted' | 'rejected';
}

export class DiffEngine {
  splitSentences(text: string): string[] {
    return text
      .split(/\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  generateSentenceDiffs(originalText: string, polishedText: string): SentenceDiff[] {
    const origSentences = this.splitSentences(originalText);
    const polSentences = this.splitSentences(polishedText);
    const maxLen = Math.max(origSentences.length, polSentences.length);
    const diffs: SentenceDiff[] = [];

    for (let i = 0; i < maxLen; i++) {
      const orig = origSentences[i] || '';
      const pol = polSentences[i] || '';
      const isChanged = orig !== pol;

      diffs.push({
        id: `diff-${i}`,
        original: orig,
        polished: pol,
        isChanged,
        status: isChanged ? 'pending' : 'accepted'
      });
    }
    return diffs;
  }
}

export const diffEngine = new DiffEngine();
