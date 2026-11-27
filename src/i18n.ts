export type Locale = 'en' | 'zh'

export const OPENING_COPY = {
  en: {
    loading: 'LOADING',
    enter: 'CLICK TO ENTER PORTFOLIO',
    language: 'Language',
  },
  zh: {
    loading: '加载中',
    enter: '点击进入作品集',
    language: '语言',
  },
} satisfies Record<Locale, Record<string, string>>
