export type TranslationInfo = {
  name: string;
  language: string;
  countries: string[];
  flag: string;
  rank: number;
};

export const translationInfo: Record<string, TranslationInfo> = {
  ESV: {
    name: 'English Standard Version',
    language: 'English',
    countries: ['USA'],
    flag: '🇺🇸',
    rank: 1
  },
  
  KJV: {
    name: 'King James Version',
    language: 'English',
    countries: ['United Kingdom'],
    flag: '🇬🇧',
    rank: 1
  },
  JapBungo: {
    name: 'Japanese Bungo',
    language: 'Japanese',
    countries: ['Japan'],
    flag: '🇯🇵',
    rank: 20
  }
};
