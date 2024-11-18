export interface QuizQuestion {
    id: string;
    passage: string;
    options: { book: string; chapter: number; verse: number }[];
    correctAnswer: { book: string; chapter: number; verse: number };
    explanation: string;
  }
  
  export interface LeaderboardEntry {
    id: string;
    name: string;
    score: number;
  }
  
  export interface User {
    id: string;
    name: string;
  }