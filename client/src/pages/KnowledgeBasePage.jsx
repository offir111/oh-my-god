import React from 'react';
import ArgumentsPage from './ArgumentsPage.jsx';

export default function KnowledgeBasePage() {
  return (
    <ArgumentsPage
      title="מאגר ידע"
      subtitle=""
      showSearch
      showKnowledgeAiAssistant
      showBack={false}
      showPageCloseX
      editorsPlacement="top"
    />
  );
}
