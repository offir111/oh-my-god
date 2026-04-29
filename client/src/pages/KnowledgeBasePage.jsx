import React from 'react';
import ArgumentsPage from './ArgumentsPage.jsx';

export default function KnowledgeBasePage() {
  return (
    <ArgumentsPage
      title="מאגר ידע"
      subtitle="חיפוש מצמצם את התוכן המובנה באפליקציה; כל שאלה כללית — «שאל AI» או Enter/🔍 כשאין התאמה (תשובה בעברית ממודל ידע כללי)"
      showSearch
      showKnowledgeAiAssistant
      showBack={false}
      editorsPlacement="top"
    />
  );
}
