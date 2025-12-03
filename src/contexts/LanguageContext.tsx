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
    'app.welcome': 'What would you like to do?',
    'app.chooseAction': 'Choose an action to get started',
    
    // Recording Page
    'record.title': 'Record',
    'record.step': 'Step',
    'record.of': 'of',
    'record.prompt1': 'What is it about?',
    'record.prompt2': 'Its details',
    'record.tapToStart': 'Tap to start recording your first response',
    'record.tapToContinue': 'Tap to continue to the next question',
    'record.step2Tip': 'When recording your child\'s moment, try to include what happened, how they reacted, and what that might show about their personality or growth',
    
    // Home Page
    'home.recordNote': 'Record a Note',
    'home.uploadDrawing': 'Upload Drawings',
    'home.recordDescription': 'Capture special moments with voice',
    'home.drawingDescription': 'Save your children\'s artwork',
    'home.menu': 'Menu',
    
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
    'settings.drawingsDescription': 'View and upload your children\'s drawings',
    'settings.viewGallery': 'View Gallery',
    'settings.notesDescription': 'Browse your saved notes and memories',
    'settings.viewNotes': 'View Notes',
    
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
    
    // Drawings Gallery
    'drawings.title': 'Drawings Gallery',
    'drawings.upload': 'Upload Drawing',
    'drawings.selectChild': 'Select Child',
    'drawings.selectFile': 'Select Image',
    'drawings.preview': 'Preview',
    'drawings.uploadButton': 'Upload',
    'drawings.uploading': 'Uploading...',
    'drawings.uploadSuccess': 'Drawing uploaded!',
    'drawings.uploadError': 'Failed to upload',
    'drawings.noDrawings': 'No drawings yet',
    'drawings.deleteConfirm': 'Delete this drawing?',
    'drawings.deleteSuccess': 'Drawing deleted',
    'drawings.deleteError': 'Failed to delete',
    
    // Common
    'common.loading': 'Loading...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.back': 'Back',
    'common.home': 'Home',
    'common.yearsOld': 'years old',
    'common.delete': 'Delete',
    'common.deleting': 'Deleting...',
    
    // Notes Page
    'notes.title': 'Past Notes',
    'notes.subtitle': 'View your saved notes and memories',
    'notes.allChildren': 'All Children',
    'notes.noNotes': 'No notes yet. Start recording to capture your first moment!',
    'notes.deleteTitle': 'Delete Note',
    'notes.deleteDescription': 'Are you sure you want to delete this note? This action cannot be undone.',
    
    // Behavior Insights
    'insights.title': 'Behavior Insights',
    'insights.patterns': 'Overall Behavior Patterns',
    'insights.themes': 'Top Behavioral Themes',
    'insights.encouragement': 'Encouragement for Your Child',
    
    // Family Management
    'family.inviteTitle': 'Invite Family Member',
    'family.inviteDesc': 'Create an invitation link to share with another parent or guardian',
    'family.emailPlaceholder': 'Enter email address',
    'family.generating': 'Generating...',
    'family.generateLink': 'Generate Link',
    'family.invitationLink': 'Invitation Link:',
    'family.shareInstructions': 'Share this link with the person you want to invite. They can use it to join your family.',
    'family.copied': 'Copied!',
    'family.linkCopied': 'Link copied to clipboard',
    'family.pendingTitle': 'Pending Invitations',
    'family.pendingDesc': 'Invitations waiting to be accepted',
    'family.sent': 'Sent',
    'family.copyLink': 'Copy invitation link',
    'family.cancelInvite': 'Cancel invitation',
    'family.membersTitle': 'Family Members',
    'family.membersDesc': 'People who can access and edit your family\'s data',
    'family.owner': 'Owner',
    'family.admin': 'Admin',
    'family.member': 'Member',
    'family.editLabel': 'Edit label',
    'family.cancelInviteTitle': 'Cancel Invitation',
    'family.cancelInviteDesc': 'Are you sure you want to cancel this invitation? The recipient will no longer be able to use this invitation link.',
    'family.keepIt': 'No, keep it',
    'family.cancelIt': 'Yes, cancel it',
    'family.editLabelTitle': 'Edit Member Label',
    'family.editLabelDesc': 'Add a label to identify this family member\'s relationship (e.g., Mom, Dad, Grandma, Uncle)',
    'family.label': 'Label',
    'family.labelPlaceholder': 'e.g., Mom, Dad, Grandma',
    'family.permissionDenied': 'Permission denied',
    'family.onlyOwner': 'Only the family owner can edit labels',
    'family.labelUpdated': 'Label updated',
    'family.labelUpdateSuccess': 'Family member label has been updated',
    'family.labelUpdateError': 'Failed to update label',
    'family.inviteLinkGen': 'Invitation link generated!',
    'family.inviteLinkGenDesc': 'Share this link with your family member.',
    'family.inviteError': 'Failed to send invitation',
    'family.inviteLinkError': 'Failed to generate invitation link',
    'family.inviteCancelled': 'Invitation cancelled',
    'family.inviteCancelledDesc': 'The invitation has been cancelled',
    'family.inviteCancelError': 'Failed to cancel invitation',
    
    // Child Form
    'form.uploading': 'Uploading...',
    'form.uploadPhoto': 'Upload Photo',
    'form.remove': 'Remove',
    'form.year': 'Year',
    'form.month': 'Month',
    'form.day': 'Day',
    
    // Accept Invitation
    'invite.loading': 'Loading invitation...',
    'invite.welcomeTitle': 'Welcome to the Family!',
    'invite.welcomeDesc': 'You\'ve successfully joined. Redirecting you to the app...',
    'invite.errorTitle': 'Unable to Accept Invitation',
    'invite.goHome': 'Go to Home',
    'invite.joinTitle': 'Join Family',
    'invite.joinDesc': 'You\'ve been invited to join a family. Click the button below to accept the invitation and start collaborating.',
    'invite.accept': 'Accept Invitation',
    'invite.accepting': 'Accepting...',
    'invite.invalidLink': 'Invalid invitation link',
    'invite.mustLogin': 'You must be logged in to send invitations',
    'invite.success': 'Success!',
    'invite.successDesc': 'You\'ve joined the family! Redirecting...',
    'invite.errorDesc': 'Failed to accept invitation',
    
    // 404 Page
    'notFound.title': '404',
    'notFound.message': 'Oops! Page not found',
    'notFound.returnHome': 'Return to Home',
    
    // Drawing Analysis
    'analysis.title': 'Drawing Analysis',
    'analysis.description': 'Get AI insights about your child\'s drawings',
    'analysis.analyze': 'Analyze Drawing',
    'analysis.analyzeThis': 'Analyze This Child',
    'analysis.analyzeAll': 'Analyze All',
    'analysis.analyzing': 'Analyzing drawings...',
    'analysis.reportFor': 'Report for',
    'analysis.emotional': 'Emotional Indicators',
    'analysis.personality': 'Personality Traits',
    'analysis.developmental': 'Developmental Signs',
    'analysis.creativity': 'Creativity & Imagination',
    'analysis.error': 'Failed to analyze drawings',
    'analysis.photosAnalyzed': 'photos',
    'analysis.maxPhotos': 'max 10',
    'analysis.savedAnalyses': 'Insights',
    'analysis.noAnalyses': 'No analyses yet. Go to Gallery to analyze your children\'s drawings.',
    'analysis.goToDrawings': 'Go to Gallery',
    'analysis.back': 'Back',
    'analysis.deleteConfirm': 'Delete this analysis?',
    'analysis.deleteSuccess': 'Analysis deleted',
    'analysis.deleteError': 'Failed to delete',
    'analysis.downloadStarted': 'Preparing PDF...',
    'analysis.summary': 'Summary',
    'analysis.saved': 'Analysis saved!',
  },
  ja: {
    // Header
    'app.title': '子供の日記',
    'app.subtitle': '瞬間を記録し、思い出を保存',
    'app.welcome': '何をしますか？',
    'app.chooseAction': '開始するアクションを選択',
    
    // Recording Page
    'record.title': '記録',
    'record.step': 'ステップ',
    'record.of': '/',
    'record.prompt1': 'それは何についてですか？',
    'record.prompt2': 'その詳細',
    'record.tapToStart': 'タップして最初の回答を録音',
    'record.tapToContinue': 'タップして次の質問に進む',
    'record.step2Tip': 'お子様の瞬間を記録するときは、何が起こったか、どのように反応したか、それが性格や成長について何を示しているかを含めてみてください',
    
    // Home Page
    'home.recordNote': 'メモを録音',
    'home.uploadDrawing': '絵をアップロード',
    'home.recordDescription': '声で特別な瞬間を記録',
    'home.drawingDescription': 'お子様のアートワークを保存',
    'home.menu': 'メニュー',
    
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
    'settings.drawingsDescription': '子どもの絵を表示・アップロード',
    'settings.viewGallery': 'ギャラリーを見る',
    'settings.notesDescription': '保存されたノートと思い出を閲覧',
    'settings.viewNotes': 'ノートを見る',
    
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
    
    // Drawings Gallery
    'drawings.title': 'お絵かきギャラリー',
    'drawings.upload': '作品をアップロード',
    'drawings.selectChild': '子どもを選択',
    'drawings.selectFile': '画像を選択',
    'drawings.preview': 'プレビュー',
    'drawings.uploadButton': 'アップロード',
    'drawings.uploading': 'アップロード中...',
    'drawings.uploadSuccess': 'アップロードしました！',
    'drawings.uploadError': 'アップロードに失敗しました',
    'drawings.noDrawings': 'まだ作品がありません',
    'drawings.deleteConfirm': 'この作品を削除しますか？',
    'drawings.deleteSuccess': '作品を削除しました',
    'drawings.deleteError': '削除に失敗しました',
    
    // Common
    'common.loading': '読み込み中...',
    'common.save': '保存',
    'common.cancel': 'キャンセル',
    'common.back': '戻る',
    'common.home': 'ホーム',
    'common.yearsOld': '歳',
    'common.delete': '削除',
    'common.deleting': '削除中...',
    
    // Notes Page
    'notes.title': '過去のノート',
    'notes.subtitle': '保存されたノートと思い出を表示',
    'notes.allChildren': 'すべての子ども',
    'notes.noNotes': 'まだノートがありません。最初の瞬間を記録しましょう！',
    'notes.deleteTitle': 'ノートを削除',
    'notes.deleteDescription': '本当にこのノートを削除しますか？この操作は元に戻せません。',
    
    // Behavior Insights
    'insights.title': '行動インサイト',
    'insights.patterns': '全体的な行動パターン',
    'insights.themes': '主要な行動テーマ',
    'insights.encouragement': '子どもへの励まし',
    
    // Family Management
    'family.inviteTitle': '家族メンバーを招待',
    'family.inviteDesc': '他の保護者と共有するための招待リンクを作成',
    'family.emailPlaceholder': 'メールアドレスを入力',
    'family.generating': '生成中...',
    'family.generateLink': 'リンクを生成',
    'family.invitationLink': '招待リンク：',
    'family.shareInstructions': '招待したい人とこのリンクを共有してください。このリンクを使って家族に参加できます。',
    'family.copied': 'コピーしました！',
    'family.linkCopied': 'リンクをクリップボードにコピーしました',
    'family.pendingTitle': '保留中の招待',
    'family.pendingDesc': '承認待ちの招待',
    'family.sent': '送信済み',
    'family.copyLink': '招待リンクをコピー',
    'family.cancelInvite': '招待をキャンセル',
    'family.membersTitle': '家族メンバー',
    'family.membersDesc': '家族のデータにアクセスして編集できる人',
    'family.owner': 'オーナー',
    'family.admin': '管理者',
    'family.member': 'メンバー',
    'family.editLabel': 'ラベルを編集',
    'family.cancelInviteTitle': '招待をキャンセル',
    'family.cancelInviteDesc': '本当にこの招待をキャンセルしますか？受信者はこの招待リンクを使用できなくなります。',
    'family.keepIt': 'いいえ、保持します',
    'family.cancelIt': 'はい、キャンセルします',
    'family.editLabelTitle': 'メンバーラベルを編集',
    'family.editLabelDesc': 'この家族メンバーの関係を識別するためのラベルを追加（例：ママ、パパ、おばあちゃん、おじさん）',
    'family.label': 'ラベル',
    'family.labelPlaceholder': '例：ママ、パパ、おばあちゃん',
    'family.permissionDenied': '権限がありません',
    'family.onlyOwner': 'ラベルを編集できるのは家族のオーナーのみです',
    'family.labelUpdated': 'ラベルが更新されました',
    'family.labelUpdateSuccess': '家族メンバーのラベルが更新されました',
    'family.labelUpdateError': 'ラベルの更新に失敗しました',
    'family.inviteLinkGen': '招待リンクが生成されました！',
    'family.inviteLinkGenDesc': '家族メンバーとこのリンクを共有してください。',
    'family.inviteError': '招待の送信に失敗しました',
    'family.inviteLinkError': '招待リンクの生成に失敗しました',
    'family.inviteCancelled': '招待がキャンセルされました',
    'family.inviteCancelledDesc': '招待がキャンセルされました',
    'family.inviteCancelError': '招待のキャンセルに失敗しました',
    
    // Child Form
    'form.uploading': 'アップロード中...',
    'form.uploadPhoto': '写真をアップロード',
    'form.remove': '削除',
    'form.year': '年',
    'form.month': '月',
    'form.day': '日',
    
    // Accept Invitation
    'invite.loading': '招待を読み込み中...',
    'invite.welcomeTitle': '家族へようこそ！',
    'invite.welcomeDesc': '正常に参加しました。アプリにリダイレクトしています...',
    'invite.errorTitle': '招待を受け入れることができません',
    'invite.goHome': 'ホームに戻る',
    'invite.joinTitle': '家族に参加',
    'invite.joinDesc': '家族に招待されました。下のボタンをクリックして招待を受け入れ、コラボレーションを開始してください。',
    'invite.accept': '招待を受け入れる',
    'invite.accepting': '受け入れ中...',
    'invite.invalidLink': '無効な招待リンク',
    'invite.mustLogin': '招待を送信するにはログインが必要です',
    'invite.success': '成功！',
    'invite.successDesc': '家族に参加しました！リダイレクト中...',
    'invite.errorDesc': '招待の受け入れに失敗しました',
    
    // 404 Page
    'notFound.title': '404',
    'notFound.message': 'おっと！ページが見つかりません',
    'notFound.returnHome': 'ホームに戻る',
    
    // Drawing Analysis
    'analysis.title': '絵の分析',
    'analysis.description': 'お子様の絵についてAIインサイトを取得',
    'analysis.analyze': '絵を分析',
    'analysis.analyzeThis': 'この子を分析',
    'analysis.analyzeAll': '全員を分析',
    'analysis.analyzing': '絵を分析中...',
    'analysis.reportFor': 'レポート:',
    'analysis.emotional': '感情的な指標',
    'analysis.personality': '性格特性',
    'analysis.developmental': '発達の兆候',
    'analysis.creativity': '創造性と想像力',
    'analysis.error': '絵の分析に失敗しました',
    'analysis.photosAnalyzed': '枚',
    'analysis.maxPhotos': '最大10枚',
    'analysis.savedAnalyses': 'インサイト',
    'analysis.noAnalyses': 'まだ分析がありません。ギャラリーで絵を分析してください。',
    'analysis.goToDrawings': 'ギャラリーへ',
    'analysis.back': '戻る',
    'analysis.deleteConfirm': 'この分析を削除しますか？',
    'analysis.deleteSuccess': '分析を削除しました',
    'analysis.deleteError': '削除に失敗しました',
    'analysis.downloadStarted': 'PDF準備中...',
    'analysis.summary': '要約',
    'analysis.saved': '分析を保存しました！',
  },
  ko: {
    // Header
    'app.title': '아이들의 일기',
    'app.subtitle': '순간을 기록하고 추억을 보존',
    'app.welcome': '무엇을 하시겠어요?',
    'app.chooseAction': '시작할 작업을 선택하세요',
    
    // Recording Page
    'record.title': '기록',
    'record.step': '단계',
    'record.of': '/',
    'record.prompt1': '그것은 무엇에 관한 것인가요?',
    'record.prompt2': '그 세부사항',
    'record.tapToStart': '첫 번째 응답을 녹음하려면 탭하세요',
    'record.tapToContinue': '다음 질문으로 넘어가려면 탭하세요',
    'record.step2Tip': '자녀의 순간을 기록할 때는 무슨 일이 있었는지, 어떻게 반응했는지, 그것이 성격이나 성장에 대해 무엇을 보여주는지 포함해 보세요',
    
    // Home Page
    'home.recordNote': '메모 녹음',
    'home.uploadDrawing': '그림 업로드',
    'home.recordDescription': '음성으로 특별한 순간 기록',
    'home.drawingDescription': '자녀의 작품 저장',
    'home.menu': '메뉴',
    
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
    'settings.drawingsDescription': '자녀의 그림 보기 및 업로드',
    'settings.viewGallery': '갤러리 보기',
    'settings.notesDescription': '저장된 노트와 추억 찾아보기',
    'settings.viewNotes': '노트 보기',
    
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
    
    // Drawings Gallery
    'drawings.title': '그림 갤러리',
    'drawings.upload': '그림 업로드',
    'drawings.selectChild': '자녀 선택',
    'drawings.selectFile': '이미지 선택',
    'drawings.preview': '미리보기',
    'drawings.uploadButton': '업로드',
    'drawings.uploading': '업로드 중...',
    'drawings.uploadSuccess': '업로드 완료!',
    'drawings.uploadError': '업로드 실패',
    'drawings.noDrawings': '아직 그림이 없습니다',
    'drawings.deleteConfirm': '이 그림을 삭제하시겠습니까?',
    'drawings.deleteSuccess': '그림이 삭제되었습니다',
    'drawings.deleteError': '삭제에 실패했습니다',
    
    // Common
    'common.loading': '로딩 중...',
    'common.save': '저장',
    'common.cancel': '취소',
    'common.back': '뒤로',
    'common.home': '홈',
    'common.yearsOld': '살',
    'common.delete': '삭제',
    'common.deleting': '삭제 중...',
    
    // Notes Page
    'notes.title': '과거 노트',
    'notes.subtitle': '저장된 노트와 추억 보기',
    'notes.allChildren': '모든 자녀',
    'notes.noNotes': '아직 노트가 없습니다. 첫 순간을 기록해보세요!',
    'notes.deleteTitle': '노트 삭제',
    'notes.deleteDescription': '정말로 이 노트를 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.',
    
    // Behavior Insights
    'insights.title': '행동 인사이트',
    'insights.patterns': '전체 행동 패턴',
    'insights.themes': '주요 행동 테마',
    'insights.encouragement': '자녀를 위한 격려',
    
    // Family Management
    'family.inviteTitle': '가족 구성원 초대',
    'family.inviteDesc': '다른 부모나 보호자와 공유할 초대 링크 생성',
    'family.emailPlaceholder': '이메일 주소 입력',
    'family.generating': '생성 중...',
    'family.generateLink': '링크 생성',
    'family.invitationLink': '초대 링크:',
    'family.shareInstructions': '초대하려는 사람과 이 링크를 공유하세요. 이 링크를 사용하여 가족에 참여할 수 있습니다.',
    'family.copied': '복사됨!',
    'family.linkCopied': '링크가 클립보드에 복사되었습니다',
    'family.pendingTitle': '대기 중인 초대',
    'family.pendingDesc': '수락 대기 중인 초대',
    'family.sent': '전송됨',
    'family.copyLink': '초대 링크 복사',
    'family.cancelInvite': '초대 취소',
    'family.membersTitle': '가족 구성원',
    'family.membersDesc': '가족 데이터에 액세스하고 편집할 수 있는 사람',
    'family.owner': '소유자',
    'family.admin': '관리자',
    'family.member': '구성원',
    'family.editLabel': '레이블 편집',
    'family.cancelInviteTitle': '초대 취소',
    'family.cancelInviteDesc': '정말로 이 초대를 취소하시겠습니까? 수신자는 더 이상 이 초대 링크를 사용할 수 없습니다.',
    'family.keepIt': '아니오, 유지',
    'family.cancelIt': '예, 취소',
    'family.editLabelTitle': '구성원 레이블 편집',
    'family.editLabelDesc': '이 가족 구성원의 관계를 식별하기 위한 레이블 추가 (예: 엄마, 아빠, 할머니, 삼촌)',
    'family.label': '레이블',
    'family.labelPlaceholder': '예: 엄마, 아빠, 할머니',
    'family.permissionDenied': '권한 거부됨',
    'family.onlyOwner': '가족 소유자만 레이블을 편집할 수 있습니다',
    'family.labelUpdated': '레이블 업데이트됨',
    'family.labelUpdateSuccess': '가족 구성원 레이블이 업데이트되었습니다',
    'family.labelUpdateError': '레이블 업데이트 실패',
    'family.inviteLinkGen': '초대 링크가 생성되었습니다!',
    'family.inviteLinkGenDesc': '가족 구성원과 이 링크를 공유하세요.',
    'family.inviteError': '초대 전송 실패',
    'family.inviteLinkError': '초대 링크 생성 실패',
    'family.inviteCancelled': '초대가 취소되었습니다',
    'family.inviteCancelledDesc': '초대가 취소되었습니다',
    'family.inviteCancelError': '초대 취소 실패',
    
    // Child Form
    'form.uploading': '업로드 중...',
    'form.uploadPhoto': '사진 업로드',
    'form.remove': '제거',
    'form.year': '년',
    'form.month': '월',
    'form.day': '일',
    
    // Accept Invitation
    'invite.loading': '초대 로딩 중...',
    'invite.welcomeTitle': '가족에 오신 것을 환영합니다!',
    'invite.welcomeDesc': '성공적으로 가입되었습니다. 앱으로 리디렉션 중...',
    'invite.errorTitle': '초대를 수락할 수 없습니다',
    'invite.goHome': '홈으로 이동',
    'invite.joinTitle': '가족 참여',
    'invite.joinDesc': '가족에 초대되었습니다. 아래 버튼을 클릭하여 초대를 수락하고 협업을 시작하세요.',
    'invite.accept': '초대 수락',
    'invite.accepting': '수락 중...',
    'invite.invalidLink': '유효하지 않은 초대 링크',
    'invite.mustLogin': '초대를 보내려면 로그인해야 합니다',
    'invite.success': '성공!',
    'invite.successDesc': '가족에 가입했습니다! 리디렉션 중...',
    'invite.errorDesc': '초대 수락 실패',
    
    // 404 Page
    'notFound.title': '404',
    'notFound.message': '앗! 페이지를 찾을 수 없습니다',
    'notFound.returnHome': '홈으로 돌아가기',
    
    // Drawing Analysis
    'analysis.title': '그림 분석',
    'analysis.description': '자녀의 그림에 대한 AI 인사이트 얻기',
    'analysis.analyze': '그림 분석',
    'analysis.analyzeThis': '이 아이 분석',
    'analysis.analyzeAll': '전체 분석',
    'analysis.analyzing': '그림 분석 중...',
    'analysis.reportFor': '보고서:',
    'analysis.emotional': '감정적 지표',
    'analysis.personality': '성격 특성',
    'analysis.developmental': '발달 징후',
    'analysis.creativity': '창의성과 상상력',
    'analysis.error': '그림 분석 실패',
    'analysis.photosAnalyzed': '장',
    'analysis.maxPhotos': '최대 10장',
    'analysis.savedAnalyses': '인사이트',
    'analysis.noAnalyses': '아직 분석이 없습니다. 갤러리에서 자녀의 그림을 분석하세요.',
    'analysis.goToDrawings': '갤러리로 이동',
    'analysis.back': '뒤로',
    'analysis.deleteConfirm': '이 분석을 삭제하시겠습니까?',
    'analysis.deleteSuccess': '분석이 삭제되었습니다',
    'analysis.deleteError': '삭제 실패',
    'analysis.downloadStarted': 'PDF 준비 중...',
    'analysis.summary': '요약',
    'analysis.saved': '분석이 저장되었습니다!',
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
