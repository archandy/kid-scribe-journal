import { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'en' | 'ja' | 'ko';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Header
    'app.title': 'Kids Journal',
    'app.subtitle': 'Capture moments, preserve memories',
    
    // Recording Page
    'record.step': 'Step',
    'record.of': 'of',
    'record.prompt1': 'What happened?',
    'record.prompt2': 'How did they behave?',
    'record.prompt3': 'What does that show?',
    'record.tapToStart': 'Tap to start recording your first response',
    'record.tapToContinue': 'Tap to continue to the next question',
    
    // Review Sheet
    'review.title': 'Review & Save',
    'review.description': 'Review your reflection and save to Notion',
    'review.whatHappened': '📝 What happened:',
    'review.howBehaved': '👶 How they behaved:',
    'review.whatShows': '💡 What that shows:',
    'review.summary': '✨ Summary',
    'review.generatingSummary': 'Generating summary...',
    'review.children': 'Children (Optional)',
    'review.saveToNotion': 'Save to Notion',
    'review.savingToNotion': 'Saving to Notion...',
    'review.cancel': 'Cancel',
    'review.savedSuccess': 'Saved to Notion successfully!',
    
    // Auth Page
    'auth.welcome': 'Welcome',
    'auth.description': 'Sign in to save your memories',
    'auth.signIn': 'Sign In',
    'auth.signUp': 'Sign Up',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.fullName': 'Full Name',
    'auth.noAccount': "Don't have an account?",
    'auth.haveAccount': 'Already have an account?',
    'auth.signingIn': 'Signing in...',
    'auth.signingUp': 'Signing up...',
    
    // Settings Page
    'settings.title': 'Settings',
    'settings.notion': 'Notion Integration',
    'settings.notionDesc': 'Connect to Notion to save your entries',
    'settings.connected': 'Connected',
    'settings.notConnected': 'Not Connected',
    'settings.connect': 'Connect to Notion',
    'settings.disconnect': 'Disconnect',
    'settings.account': 'Account',
    'settings.signOut': 'Sign Out',
    
    // Common
    'common.loading': 'Loading...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.back': 'Back',
  },
  ja: {
    // Header
    'app.title': '子供の日記',
    'app.subtitle': '瞬間を記録し、思い出を保存',
    
    // Recording Page
    'record.step': 'ステップ',
    'record.of': '/',
    'record.prompt1': '何が起こりましたか？',
    'record.prompt2': '子供たちはどのように振る舞いましたか？',
    'record.prompt3': 'それは何を示していますか？',
    'record.tapToStart': 'タップして最初の回答を録音',
    'record.tapToContinue': 'タップして次の質問に進む',
    
    // Review Sheet
    'review.title': '確認と保存',
    'review.description': '振り返りを確認してNotionに保存',
    'review.whatHappened': '📝 何が起こったか：',
    'review.howBehaved': '👶 どのように振る舞ったか：',
    'review.whatShows': '💡 それが示すこと：',
    'review.summary': '✨ 要約',
    'review.generatingSummary': '要約を生成中...',
    'review.children': '子供（任意）',
    'review.saveToNotion': 'Notionに保存',
    'review.savingToNotion': 'Notionに保存中...',
    'review.cancel': 'キャンセル',
    'review.savedSuccess': 'Notionへの保存に成功しました！',
    
    // Auth Page
    'auth.welcome': 'ようこそ',
    'auth.description': 'サインインして思い出を保存',
    'auth.signIn': 'サインイン',
    'auth.signUp': 'サインアップ',
    'auth.email': 'メールアドレス',
    'auth.password': 'パスワード',
    'auth.fullName': '氏名',
    'auth.noAccount': 'アカウントをお持ちでないですか？',
    'auth.haveAccount': 'すでにアカウントをお持ちですか？',
    'auth.signingIn': 'サインイン中...',
    'auth.signingUp': 'サインアップ中...',
    
    // Settings Page
    'settings.title': '設定',
    'settings.notion': 'Notion統合',
    'settings.notionDesc': 'Notionに接続してエントリーを保存',
    'settings.connected': '接続済み',
    'settings.notConnected': '未接続',
    'settings.connect': 'Notionに接続',
    'settings.disconnect': '切断',
    'settings.account': 'アカウント',
    'settings.signOut': 'サインアウト',
    
    // Common
    'common.loading': '読み込み中...',
    'common.save': '保存',
    'common.cancel': 'キャンセル',
    'common.back': '戻る',
  },
  ko: {
    // Header
    'app.title': '아이들의 일기',
    'app.subtitle': '순간을 기록하고 추억을 보존',
    
    // Recording Page
    'record.step': '단계',
    'record.of': '/',
    'record.prompt1': '무슨 일이 있었나요?',
    'record.prompt2': '아이들은 어떻게 행동했나요?',
    'record.prompt3': '그것은 무엇을 보여주나요?',
    'record.tapToStart': '첫 번째 응답을 녹음하려면 탭하세요',
    'record.tapToContinue': '다음 질문으로 넘어가려면 탭하세요',
    
    // Review Sheet
    'review.title': '검토 및 저장',
    'review.description': '반성을 검토하고 Notion에 저장',
    'review.whatHappened': '📝 무슨 일이 있었는지:',
    'review.howBehaved': '👶 어떻게 행동했는지:',
    'review.whatShows': '💡 그것이 보여주는 것:',
    'review.summary': '✨ 요약',
    'review.generatingSummary': '요약 생성 중...',
    'review.children': '아이들 (선택사항)',
    'review.saveToNotion': 'Notion에 저장',
    'review.savingToNotion': 'Notion에 저장 중...',
    'review.cancel': '취소',
    'review.savedSuccess': 'Notion에 성공적으로 저장되었습니다!',
    
    // Auth Page
    'auth.welcome': '환영합니다',
    'auth.description': '로그인하여 추억을 저장하세요',
    'auth.signIn': '로그인',
    'auth.signUp': '회원가입',
    'auth.email': '이메일',
    'auth.password': '비밀번호',
    'auth.fullName': '이름',
    'auth.noAccount': '계정이 없으신가요?',
    'auth.haveAccount': '이미 계정이 있으신가요?',
    'auth.signingIn': '로그인 중...',
    'auth.signingUp': '회원가입 중...',
    
    // Settings Page
    'settings.title': '설정',
    'settings.notion': 'Notion 통합',
    'settings.notionDesc': 'Notion에 연결하여 항목 저장',
    'settings.connected': '연결됨',
    'settings.notConnected': '연결되지 않음',
    'settings.connect': 'Notion에 연결',
    'settings.disconnect': '연결 해제',
    'settings.account': '계정',
    'settings.signOut': '로그아웃',
    
    // Common
    'common.loading': '로딩 중...',
    'common.save': '저장',
    'common.cancel': '취소',
    'common.back': '뒤로',
  },
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
