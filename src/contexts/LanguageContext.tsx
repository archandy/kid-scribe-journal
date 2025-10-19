import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
    'record.prompt1': 'What is it about?',
    'record.prompt2': 'Its details',
    'record.tapToStart': 'Tap to start recording your first response',
    'record.tapToContinue': 'Tap to continue to the next question',
    
    // Review Sheet
    'review.title': 'Review & Save',
    'review.description': 'Review your reflection and save to Notion',
    'review.whatHappened': '📝 What is it about:',
    'review.howBehaved': '📋 Its details:',
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
    'settings.manageChildren': 'Manage Children',
    
    // Children Management
    'children.title': 'Manage Children',
    'children.addChild': 'Add Child',
    'children.editChild': 'Edit Child',
    'children.photoEmoji': 'Photo/Emoji',
    'children.name': 'Name',
    'children.namePlaceholder': 'Enter name',
    'children.birthdate': 'Birthdate',
    'children.selectDate': 'Select date',
    'children.age': 'Age',
    'children.yearsOld': 'years old',
    'children.cancel': 'Cancel',
    'children.save': 'Save',
    'children.saving': 'Saving...',
    'children.delete': 'Delete',
    'children.deleteConfirmTitle': 'Confirm Deletion',
    'children.deleteConfirmDescription': 'Are you sure you want to delete this child?',
    'children.noChildren': 'No children added yet',
    'children.loading': 'Loading...',
    'children.fetchError': 'Failed to fetch children',
    'children.authError': 'Please sign in',
    'children.addSuccess': 'Child added successfully',
    'children.updateSuccess': 'Child updated successfully',
    'children.saveError': 'Failed to save',
    'children.deleteSuccess': 'Child deleted successfully',
    'children.deleteError': 'Failed to delete',
    'children.formDescription': 'Enter your child\'s information',
    
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
    'record.prompt1': 'それは何についてですか？',
    'record.prompt2': 'その詳細',
    'record.tapToStart': 'タップして最初の回答を録音',
    'record.tapToContinue': 'タップして次の質問に進む',
    
    // Review Sheet
    'review.title': '確認と保存',
    'review.description': '振り返りを確認してNotionに保存',
    'review.whatHappened': '📝 それは何についてか：',
    'review.howBehaved': '📋 その詳細：',
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
    'settings.manageChildren': '子どもの管理',
    
    // Children Management
    'children.title': '子どもの管理',
    'children.addChild': '子どもを追加',
    'children.editChild': '子どもを編集',
    'children.photoEmoji': '写真/絵文字',
    'children.name': '名前',
    'children.namePlaceholder': '名前を入力',
    'children.birthdate': '生年月日',
    'children.selectDate': '日付を選択',
    'children.age': '年齢',
    'children.yearsOld': '歳',
    'children.cancel': 'キャンセル',
    'children.save': '保存',
    'children.saving': '保存中...',
    'children.delete': '削除',
    'children.deleteConfirmTitle': '削除の確認',
    'children.deleteConfirmDescription': '本当にこの子どもを削除しますか？',
    'children.noChildren': '子どもが登録されていません',
    'children.loading': '読み込み中...',
    'children.fetchError': '子どもの取得に失敗しました',
    'children.authError': 'サインインしてください',
    'children.addSuccess': '子どもを追加しました',
    'children.updateSuccess': '子どもを更新しました',
    'children.saveError': '保存に失敗しました',
    'children.deleteSuccess': '子どもを削除しました',
    'children.deleteError': '削除に失敗しました',
    'children.formDescription': '子どもの情報を入力してください',
    
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
    'record.prompt1': '그것은 무엇에 관한 것인가요?',
    'record.prompt2': '그 세부사항',
    'record.tapToStart': '첫 번째 응답을 녹음하려면 탭하세요',
    'record.tapToContinue': '다음 질문으로 넘어가려면 탭하세요',
    
    // Review Sheet
    'review.title': '검토 및 저장',
    'review.description': '반성을 검토하고 Notion에 저장',
    'review.whatHappened': '📝 그것은 무엇에 관한 것인지:',
    'review.howBehaved': '📋 그 세부사항:',
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
    'settings.manageChildren': '자녀 관리',
    
    // Children Management
    'children.title': '자녀 관리',
    'children.addChild': '자녀 추가',
    'children.editChild': '자녀 수정',
    'children.photoEmoji': '사진/이모지',
    'children.name': '이름',
    'children.namePlaceholder': '이름을 입력하세요',
    'children.birthdate': '생년월일',
    'children.selectDate': '날짜 선택',
    'children.age': '나이',
    'children.yearsOld': '세',
    'children.cancel': '취소',
    'children.save': '저장',
    'children.saving': '저장 중...',
    'children.delete': '삭제',
    'children.deleteConfirmTitle': '삭제 확인',
    'children.deleteConfirmDescription': '정말로 이 자녀를 삭제하시겠습니까?',
    'children.noChildren': '등록된 자녀가 없습니다',
    'children.loading': '로딩 중...',
    'children.fetchError': '자녀 정보를 가져오는데 실패했습니다',
    'children.authError': '로그인이 필요합니다',
    'children.addSuccess': '자녀가 추가되었습니다',
    'children.updateSuccess': '자녀 정보가 업데이트되었습니다',
    'children.saveError': '저장에 실패했습니다',
    'children.deleteSuccess': '자녀가 삭제되었습니다',
    'children.deleteError': '삭제에 실패했습니다',
    'children.formDescription': '자녀의 정보를 입력하세요',
    
    // Common
    'common.loading': '로딩 중...',
    'common.save': '저장',
    'common.cancel': '취소',
    'common.back': '뒤로',
  },
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>('en');

  // Load language preference from database
  useEffect(() => {
    const loadLanguagePreference = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('language')
          .eq('id', user.id)
          .single();
        
        if (profile?.language) {
          setLanguage(profile.language as Language);
        }
      }
    };

    loadLanguagePreference();
  }, []);

  // Save language preference to database
  const handleSetLanguage = async (lang: Language) => {
    setLanguage(lang);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('profiles')
        .update({ language: lang })
        .eq('id', user.id);
    }
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
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
