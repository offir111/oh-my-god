import React from 'react';
import ArgumentsPage from './ArgumentsPage.jsx';

export default function KnowledgeBasePage() {
  return (
    <ArgumentsPage
      title="מאגר ידע"
      subtitle="חיפוש מצמצם את התוכן המובנה; שלח או Enter — חיפוש ואם אין התאמה יופנה ל-AI. Alt+Enter — שאל AI ישירות (עברית, ידע כללי)."
      showSearch
      showKnowledgeAiAssistant
      showBack={false}
      showPageCloseX
      editorsPlacement="top"
    />
  );
}
