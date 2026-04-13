export interface Article {
  title: string;
  subtitle: string;
  body: string;
  translationBody?: string;
  date: string;
  difficulty: string;
  wordCount: number;
  imageUrl?: string;
}

export interface Vocabulary {
  id: string;
  word: string;
  definition: string;
  context: string;
  paragraphIndex?: number;
}

export interface Note {
  id: string;
  text: string;
  comment: string;
  paragraphIndex?: number;
}

export type AppMode = 'input' | 'read' | 'layout';
