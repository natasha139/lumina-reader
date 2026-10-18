export interface Paragraph {
  id: string;
  en: string;
  zh: string;
}

export interface Article {
  paragraphs?: Paragraph[];
  title: string;
  subtitle: string;
  body: string;
  translationBody?: string;
  date: string;
  difficulty: string;
  wordCount: number;
  imageUrl?: string;
}

export interface VocabularyOccurrence {
  sourceText: string;
  originalContext: string;
  context: string;
  paragraphId?: string;
  paragraphIndex?: number;
}

export interface Vocabulary {
  id: string;
  word: string;
  definition: string;
  context: string;
  paragraphIndex?: number;
  color?: string;
  phonetic?: string;
  partOfSpeech?: string;
  collocations?: string;
  sourceText?: string;
  originalContext?: string;
  paragraphId?: string;
  occurrences?: VocabularyOccurrence[];
}

export type NoteKind = 'sentence' | 'expression' | 'question';

export interface Note {
  id: string;
  text: string;
  comment: string;
  originalText?: string;
  rewrite?: string;
  kind?: NoteKind;
  paragraphId?: string;
  paragraphIndex?: number;
  color?: string;
}

export type AppMode = 'library' | 'input' | 'read' | 'layout';

export type DesignStyle = 'academic' | 'editorial' | 'handwritten';
