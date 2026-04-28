import React from 'react';
import ArgumentsPage from './ArgumentsPage.jsx';

export default function KnowledgeBasePage() {
  return (
    <ArgumentsPage
      title="מאגר ידע"
      subtitle="ויקיפדיה של טענות בעד אמונה ובעד מדע — עם חיפוש מהיר לפי נושא, טענה או כותב"
      showSearch
      showBack={false}
      editorsPlacement="top"
    />
  );
}
