export type Locale = 'en' | 'zh'

export const OPENING_COPY = {
  en: {
    loading: 'LOADING',
    clickSound: 'Click to enable sound',
    language: 'Language',
  },
  zh: {
    loading: '加载中',
    clickSound: '点击开启声音',
    language: '语言',
  },
} satisfies Record<Locale, Record<string, string>>
