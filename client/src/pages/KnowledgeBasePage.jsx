import React from 'react';
import ArgumentsPage from './ArgumentsPage.jsx';

export default function KnowledgeBasePage() {
  return (
    <ArgumentsPage
      title="מאגר ידע"
      subtitle="חיפוש טענות עם 🔍 — באותה שורה לחץ «שאל AI» לשאלה כללית; התשובה תופיע מתחת לקטגוריות"
      showSearch
      showKnowledgeAiAssistant
      showBack={false}
      editorsPlacement="top"
    />
  );
}
